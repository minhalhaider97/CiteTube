import logging
import re
from uuid import UUID

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from app.agent.checkpointer import get_checkpointer
from app.agent.nodes import AgentNodes
from app.agent.state import AgentState
from app.db.models.video import Video
from app.rag.citations import format_citations

logger = logging.getLogger(__name__)

_CITE_RE = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")


def build_graph(db: Session, video_id: UUID, checkpointer=None):
    n = AgentNodes(db, video_id)
    g = StateGraph(AgentState)

    g.add_node("condense_query", n.condense_query)
    g.add_node("planner", n.planner)
    g.add_node("retrieve", n.retrieve)
    g.add_node("grade_docs", n.grade_docs)
    g.add_node("rewrite_query", n.rewrite_query)
    g.add_node("execute_task", n.execute_task)
    g.add_node("synthesize_final", n.synthesize_final)
    g.add_node("grade_generation", n.grade_generation)
    g.add_node("finalize", n.finalize)

    g.add_edge(START, "condense_query")
    g.add_edge("condense_query", "planner")
    g.add_edge("planner", "retrieve")
    g.add_edge("retrieve", "grade_docs")
    g.add_conditional_edges(
        "grade_docs",
        n.route_after_grade_docs,
        {"execute_task": "execute_task", "rewrite_query": "rewrite_query"},
    )
    g.add_edge("rewrite_query", "retrieve")
    g.add_conditional_edges(          # router_next in the diagram
        "execute_task",
        n.route_next,
        {"retrieve": "retrieve", "synthesize_final": "synthesize_final"},
    )
    g.add_edge("synthesize_final", "grade_generation")
    g.add_conditional_edges(
        "grade_generation",
        n.route_after_grade_generation,
        {"synthesize_final": "synthesize_final", "end": "finalize"},
    )
    g.add_edge("finalize", END)
    return g.compile(checkpointer=checkpointer)


def _cited_sources(answer: str, sources: list[dict]) -> list[tuple[int, dict]]:
    numbers: set[int] = set()
    for match in _CITE_RE.findall(answer):
        numbers.update(int(x) for x in re.split(r"\s*,\s*", match))
    return [(num, sources[num - 1]) for num in sorted(numbers) if 1 <= num <= len(sources)]


def _to_messages(history: list[dict[str, str]]) -> list:
    return [
        HumanMessage(content=m["content"]) if m["role"] == "user" else AIMessage(content=m["content"])
        for m in history
    ]


def run_agent(
    db: Session,
    video_id: UUID,
    question: str,
    thread_id: str,
    db_history: list[dict[str, str]] | None = None,
) -> dict:
    """
    Run the agentic RAG graph for one chat turn.

    Memory: the checkpointer stores the conversation under thread_id (= chat id).
    If the thread has no checkpoint yet (a chat created before this feature, or the
    checkpointer is unavailable) the memory is seeded from `db_history` (messages table).
    """
    checkpointer = get_checkpointer()
    graph = build_graph(db, video_id, checkpointer)
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 80}

    has_memory = False
    if checkpointer is not None:
        has_memory = bool(graph.get_state(config).values.get("messages"))

    messages = [] if has_memory else _to_messages(db_history or [])
    messages.append(HumanMessage(content=question))

    # Per-turn fields are reset explicitly: checkpointed state from the previous turn
    # would otherwise leak in (e.g. a stale auditor `feedback`).
    final = graph.invoke(
        {
            "question": question,
            "messages": messages,
            "final_answer": "",
            "feedback": "",
            "grounded": "",
            "doc_grade": "",
            "chunks": [],
        },
        config=config,
    )

    video = db.get(Video, video_id)
    yt_video_id = video.youtube_video_id if video else ""

    answer = final.get("final_answer", "")
    cited = _cited_sources(answer, final.get("sources", []))
    citations = format_citations([s for _, s in cited], yt_video_id)
    for (num, _), citation in zip(cited, citations):
        citation["index"] = num   # matches the [n] markers in the answer text

    return {
        "answer": answer,
        "citations": citations,
        "sub_questions": final.get("todo", []),
        "standalone_question": final.get("standalone_question", question),
        "grounded": final.get("grounded") == "yes",
    }
