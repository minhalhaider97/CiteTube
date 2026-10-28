"""LangGraph Postgres checkpointer (agent memory), one thread per chat."""
import logging
import re
import threading

from langgraph.checkpoint.postgres import PostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_pool: ConnectionPool | None = None
_checkpointer: PostgresSaver | None = None
_init_failed = False


def _conninfo() -> str:
    url = settings.database_url
    if not url:
        raise RuntimeError("No database URL found in settings (expected settings.database_url).")
    # SQLAlchemy URLs look like postgresql+psycopg://...; psycopg wants postgresql://...
    return re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql://", str(url))


def get_checkpointer() -> PostgresSaver | None:
    """Lazily create the pool + saver. Returns None (stateless mode) if setup fails."""
    global _pool, _checkpointer, _init_failed
    if _checkpointer is not None or _init_failed:
        return _checkpointer
    with _lock:
        if _checkpointer is not None or _init_failed:
            return _checkpointer
        try:
            _pool = ConnectionPool(
                conninfo=_conninfo(),
                min_size=1,
                max_size=5,
                kwargs={
                    "autocommit": True,      # required by PostgresSaver
                    "prepare_threshold": 0,  # required for Supabase's pgbouncer poolers
                    "row_factory": dict_row,
                },
                open=True,
            )
            saver = PostgresSaver(_pool)
            saver.setup()                    # creates the checkpoint tables if missing
            _checkpointer = saver
            logger.info("LangGraph Postgres checkpointer ready.")
        except Exception:
            _init_failed = True
            logger.exception(
                "Could not initialise the checkpointer; the agent will fall back to "
                "rebuilding memory from the messages table on every request."
            )
        return _checkpointer


def delete_thread_memory(thread_id: str) -> None:
    """Remove a chat's checkpoints (call when the chat is deleted)."""
    saver = get_checkpointer()
    if saver is None:
        return
    try:
        saver.delete_thread(thread_id)
    except Exception:
        logger.exception("Failed to delete checkpoints for thread %s", thread_id)


def close_checkpointer() -> None:
    global _pool, _checkpointer
    if _pool is not None:
        _pool.close()
    _pool = None
    _checkpointer = None
