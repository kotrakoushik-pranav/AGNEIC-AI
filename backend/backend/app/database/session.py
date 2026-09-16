from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings

# SQLite needs check_same_thread=False for multi-threaded use (FastAPI/uvicorn).
# For PostgreSQL this kwarg is silently ignored.
_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    # pool_pre_ping keeps the connection healthy across idle periods
    pool_pre_ping=True,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Shared declarative base — all ORM models inherit from this
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and guarantees cleanup."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
