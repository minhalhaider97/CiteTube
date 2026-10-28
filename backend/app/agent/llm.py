"""Thin Groq/LangChain helpers shared by every graph node."""
import re
from functools import lru_cache
from typing import Type, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from pydantic import BaseModel

from app.core.config import settings

T = TypeVar("T", bound=BaseModel)

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def strip_think(text: str) -> str:
    """Reasoning models (e.g. Qwen3) can leak <think> blocks; remove them."""
    return _THINK_RE.sub("", text or "").strip()


# Tasks that default to the fast model (when `groq_fast_model` is set).
# Everything else (answer, synthesis, audit) defaults to the main model.
FAST_ROLES = {"condense", "planner", "doc_grader", "rewrite"}


def resolve_model(role: str) -> str:
    """
    Pick the model for a task, in this order:
      1. settings.groq_task_models[role]    e.g. {"audit": "llama-3.3-70b-versatile"}
      2. settings.groq_fast_model           for roles in FAST_ROLES
      3. settings.groq_chat_model           (main model)
    Roles: condense, planner, doc_grader, rewrite, answer, synthesis, audit.
    """
    overrides = getattr(settings, "groq_task_models", None) or {}
    if role in overrides:
        return overrides[role]
    main_model = getattr(settings, "groq_chat_model", "qwen/qwen3.8-27b")
    if role in FAST_ROLES:
        return getattr(settings, "groq_fast_model", None) or main_model
    return main_model


@lru_cache(maxsize=32)
def get_llm(temperature: float = 0.0, max_tokens: int = 400, role: str = "answer") -> ChatGroq:
    """
    max_tokens is ALWAYS set: Groq counts the requested output budget against your
    tokens-per-minute limit, so an unset value can get a request rejected outright.

    Optional settings (add to config.py / .env only if you want them):
      groq_fast_model        -> smaller model for condense / planner / doc_grader / rewrite
      groq_task_models       -> per-task overrides, e.g. {"audit": "some-model"}
      groq_reasoning_effort  -> e.g. "none" to switch Qwen3's reasoning off
    """
    api_key = getattr(settings, "groq_api_key", None)
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is missing from environment variables.")

    model_name = resolve_model(role)

    kwargs: dict = {}
    if "qwen3" in model_name.lower():
        effort = getattr(settings, "groq_reasoning_effort", None)
        if effort:
            kwargs["model_kwargs"] = {"reasoning_effort": effort}
        if effort != "none":
            # Hide chain-of-thought so structured outputs / answers stay clean.
            # If your langchain-groq version rejects this argument, delete it.
            kwargs["reasoning_format"] = "hidden"

    return ChatGroq(
        model=model_name,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
        max_retries=4,          # Groq's client backs off and retries on 429
        **kwargs,
    )


def invoke_text(
    system: str,
    user: str,
    temperature: float = 0.0,
    max_tokens: int = 400,
    role: str = "answer",
) -> str:
    llm = get_llm(temperature, max_tokens, role)
    resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    return strip_think(resp.content)


def invoke_structured(
    schema: Type[T], system: str, user: str, role: str, max_tokens: int = 200
) -> T:
    llm = get_llm(0.0, max_tokens, role).with_structured_output(schema, method="function_calling")
    return llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])