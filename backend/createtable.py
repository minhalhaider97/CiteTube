from app.db.base import Base
from app.db.session import engine

# Import every model so it is registered with Base.metadata.
from app.db import models  # noqa: F401


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


if __name__ == "__main__":
    create_tables()