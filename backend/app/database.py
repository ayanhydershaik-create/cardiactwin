import os
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# ── Neon Lakebase Postgres connection ─────────────────────────────────────────
# Pooled URL  → all application/API traffic (FastAPI request handlers)
# Unpooled URL → schema migrations (DDL), create_all, pg_dump, LISTEN/NOTIFY

DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL_UNPOOLED = os.getenv("DATABASE_URL_UNPOOLED", DATABASE_URL)

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to backend/.env — see .env.example."
    )

# App engine: pooled connection for all runtime queries
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Migration engine: direct (non-pooled) connection for create_all / DDL
migration_engine = create_engine(DATABASE_URL_UNPOOLED, pool_pre_ping=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a SQLAlchemy session and closes it after."""
    try:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    except Exception:
        yield None
