"""
Pytest configuration for the Aegis AI backend test suite.

Uses an in-memory SQLite database so tests are fully isolated from any
production or development PostgreSQL instance.  The `get_db` FastAPI
dependency is overridden for every test via `app.dependency_overrides`,
ensuring no shared state leaks between test functions.

IMPORTANT: DATABASE_URL must be set in the environment *before* importing
`app.core.config` (which eagerly instantiates `Settings`).  We do that here
at the very top of conftest so the import chain sees the env var.
"""

import os

# Provide a dummy DATABASE_URL so pydantic-settings can initialise Settings
# without a real .env file.  The actual DB used in tests is SQLite in-memory;
# the production engine is never created because we override `get_db`.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.database.session import Base, get_db  # noqa: E402

# ---------------------------------------------------------------------------
# In-memory SQLite engine — one engine per pytest session.
# Tables are recreated fresh for each test via the `db_session` fixture.
# ---------------------------------------------------------------------------
SQLALCHEMY_TEST_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session():
    """
    Yield a fresh SQLite session for a single test.

    Tables are created before the test and dropped after it, guaranteeing
    complete isolation between test functions.
    """
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    """
    Yield a FastAPI TestClient with the `get_db` dependency overridden to
    use the in-memory SQLite session.
    """

    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # session lifecycle is managed by the `db_session` fixture

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
