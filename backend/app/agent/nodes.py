import logging
from typing import Any
from uuid import UUID

from langchain_core.messages import AIMessage
from sqlalchemy.orm import Session

from app.agent import prompts
from app.agent.llm import invoke_structured, invoke_text
from app.agent.memory import HISTORY_LIMIT, MAX_CHARS_PER_MESSAGE
from app.agent.schemas import DocGrade, GenerationGrade, Plan
from app.agent.state import AgentState
from app.rag.chain import retrieve_chunks
from app.rag.prompt import format_time

logger = logging.getLogger(__name__)

MAX_TASKS = 3
MAX_RETRIEVAL_RETRIES = 2   # "Retry >= 2" in the diagram
MAX_SYNTH_ATTEMPTS = 2      # first synthesis + one regeneration after a failed audit


# ---------- helpers ----------

def _format_history(history: list[dict[str, str]]) -> str:
    return "\n".join(f"{m['role'].capitalize()}: {m['content']}" for m in history)


def _history_from_messages(messages: list) -> list[dict[str, str]]:
    """Previous turns from the checkpointed messages (the last message is the current question)."""
    prior = messages[:-1][-HISTORY_LIMIT:]
    out = []
    for m in prior:
        role = "user" if m.type == "human" else "assistant"
        out.append({"role": role, "content": str(m.content)[:MAX_CHARS_PER_MESSAGE]})
    return out


def _register_sources(sources: list[dict], chunks: list[dict]) -> tuple[list[dict], list[int]]:
    """Add new chunks to the global source list; return (sources, global numbers for `chunks`)."""
    sources = list(sources)
    index = {str(s["chunk_id"]): i + 1 for i, s in enumerate(sources)}
    numbers: list[int] = []
    for chunk in chunks:
        cid = str(chunk["chunk_id"])
        if cid not in index:
            sources.append(chunk)
            index[cid] = len(sources)
        numbers.append(index[cid])
    return sources, numbers


def _format_sources(chunks: list[dict], numbers: list[int], max_chars: int | None = None) -> str:
    blocks = []
    for n, c in zip(numbers, chunks):
        text = c["content"] if max_chars is None else c["content"][:max_chars]
        blocks.append(
            f"[{n}] Timestamp: {format_time(c['start_seconds'])} - {format_time(c['end_seconds'])}\n"
            f"Content: {text}"
        )
    return "\n\n".join(blocks)


class AgentNodes:
    """Graph nodes. The DB session and video id are bound per request, not stored in graph state."""

    def __init__(self, db: Session, video_id: UUID):
        self.db = db
        self.video_id = video_id

    # ---------- nodes ----------

    def condense_query(self, state: AgentState) -> dict[str, Any]:
        question = state["question"]
        history = _history_from_messages(state.get("messages") or [])
        if not history:
            return {"standalone_question": question}
        try:
            out = invoke_text(
                prompts.CONDENSE_SYSTEM,
                f"Chat history:\n{_format_history(history)}\n\nLatest message: {question}",
                max_tokens=100,
                role="condense",
            )
        except Exception:
            logger.exception("condense_query failed; using the raw question")
            out = question
        return {"standalone_question": out or question}

    def planner(self, state: AgentState) -> dict[str, Any]:
        question = state["standalone_question"]
        try:
            plan = invoke_structured(Plan, prompts.PLANNER_SYSTEM, f"Question: {question}", role="planner")
            tasks = [t.strip() for t in plan.tasks if t and t.strip()][:MAX_TASKS]
        except Exception:
            logger.exception("planner failed; falling back to a single task")
            tasks = []
        if not tasks:
            tasks = [question]
        return {
            "todo": tasks,
            "task_idx": 0,
            "current_task": tasks[0],
            "current_query": tasks[0],
            "retry_count": 0,
            "sources": [],
            "sub_answers": [],
            "synth_attempts": 0,
        }

    def retrieve(self, state: AgentState) -> dict[str, Any]:
        chunks = retrieve_chunks(self.db, self.video_id, state["current_query"])
        return {"chunks": chunks}

    def grade_docs(self, state: AgentState) -> dict[str, Any]:
        chunks = state.get("chunks") or []
        if not chunks:
            return {"doc_grade": "no"}
        numbers = list(range(1, len(chunks) + 1))
        try:
            grade = invoke_structured(
                DocGrade,
                prompts.DOC_GRADER_SYSTEM,
                f"Question: {state['current_task']}\n\nExcerpts:\n{_format_sources(chunks, numbers, 500)}",
                role="doc_grader",
            )
            return {"doc_grade": grade.score}
        except Exception:
            logger.exception("grade_docs failed; assuming relevant")
            return {"doc_grade": "yes"}

    def rewrite_query(self, state: AgentState) -> dict[str, Any]:
        try:
            new_query = invoke_text(
                prompts.REWRITE_SYSTEM,
                f"Original question: {state['current_task']}\nPrevious search query: {state['current_query']}",
                temperature=0.3,
                max_tokens=60,
                role="rewrite",
            )
        except Exception:
            logger.exception("rewrite_query failed; keeping the previous query")
            new_query = state["current_query"]
        return {
            "current_query": new_query or state["current_query"],
            "retry_count": state.get("retry_count", 0) + 1,
        }

    def execute_task(self, state: AgentState) -> dict[str, Any]:
        task = state["current_task"]
        chunks = state.get("chunks") or []
        sources, numbers = _register_sources(state.get("sources", []), chunks)

        if chunks:
            answer = invoke_text(
                prompts.EXECUTE_SYSTEM,
                f"Excerpts:\n{_format_sources(chunks, numbers)}\n\nSub-question: {task}",
                temperature=0.2,
                max_tokens=350,
                role="answer",
            )
        else:
            answer = "No relevant transcript excerpts were found for this sub-question."

        sub_answers = list(state.get("sub_answers", [])) + [
            {"task": task, "answer": answer, "numbers": numbers}
        ]

        next_idx = state.get("task_idx", 0) + 1
        todo = state["todo"]
        update: dict[str, Any] = {
            "sources": sources,
            "sub_answers": sub_answers,
            "task_idx": next_idx,
            "retry_count": 0,
        }
        if next_idx < len(todo):
            update["current_task"] = todo[next_idx]
            update["current_query"] = todo[next_idx]
        return update

    def synthesize_final(self, state: AgentState) -> dict[str, Any]:
        sources = state.get("sources", [])
        numbers = list(range(1, len(sources) + 1))
        sub_block = "\n\n".join(
            f"Sub-question: {s['task']}\nSub-answer: {s['answer']}" for s in state["sub_answers"]
        )
        user = (
            f"User question: {state['standalone_question']}\n\n"
            f"Sub-answers:\n{sub_block}\n\n"
            f"Numbered excerpts:\n{_format_sources(sources, numbers)}"
        )
        if state.get("feedback"):
            user += (
                "\n\nYour previous draft contained claims not supported by the excerpts:\n"
                f"{state['feedback']}\nRewrite the answer and remove or correct those claims."
            )
        answer = invoke_text(prompts.SYNTH_SYSTEM, user, temperature=0.2, max_tokens=500, role="synthesis")
        return {
            "final_answer": answer,
            "synth_attempts": state.get("synth_attempts", 0) + 1,
        }

    def grade_generation(self, state: AgentState) -> dict[str, Any]:
        sources = state.get("sources", [])
        numbers = list(range(1, len(sources) + 1))
        try:
            grade = invoke_structured(
                GenerationGrade,
                prompts.GEN_GRADER_SYSTEM,
                f"EXCERPTS:\n{_format_sources(sources, numbers)}\n\nANSWER:\n{state['final_answer']}",
                role="audit",
            )
            return {"grounded": grade.score, "feedback": grade.unsupported_claims}
        except Exception:
            logger.exception("grade_generation failed; accepting the answer")
            return {"grounded": "yes", "feedback": ""}

    def finalize(self, state: AgentState) -> dict[str, Any]:
        """Not an LLM node: writes the answer into memory so the next turn can see it."""
        return {"messages": [AIMessage(content=state.get("final_answer", ""))]}

    # ---------- routers (conditional edges) ----------

    @staticmethod
    def route_after_grade_docs(state: AgentState) -> str:
        if state.get("doc_grade") == "yes" or state.get("retry_count", 0) >= MAX_RETRIEVAL_RETRIES:
            return "execute_task"
        return "rewrite_query"

    @staticmethod
    def route_next(state: AgentState) -> str:
        return "retrieve" if state.get("task_idx", 0) < len(state["todo"]) else "synthesize_final"

    @staticmethod
    def route_after_grade_generation(state: AgentState) -> str:
        if state.get("grounded") == "yes" or state.get("synth_attempts", 0) >= MAX_SYNTH_ATTEMPTS:
            return "end"
        return "synthesize_final"