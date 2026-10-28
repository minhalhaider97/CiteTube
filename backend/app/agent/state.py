from typing import Annotated, Any, TypedDict
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    # inputs / memory (persisted by the checkpointer, one thread per chat)
    question: str
    messages: Annotated[list[AnyMessage], add_messages]   # conversation memory

    # planning
    standalone_question: str
    todo: list[str]
    task_idx: int
    current_task: str
    current_query: str

    # retrieval loop
    chunks: list[dict[str, Any]]           # reranked chunks for the current task
    doc_grade: str                         # "yes" | "no"
    retry_count: int

    # accumulated across tasks
    sources: list[dict[str, Any]]          # global, de-duplicated; citation number = index + 1
    sub_answers: list[dict[str, Any]]

    # final answer loop
    final_answer: str
    feedback: str                          # unsupported claims from the auditor
    synth_attempts: int
    grounded: str                          # "yes" | "no"
