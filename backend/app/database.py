import logging
import os
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

# ── Neon Lakebase Postgres connection ─────────────────────────────────────────
# Pooled URL  → all application/API traffic (FastAPI request handlers)
# Unpooled URL → schema migrations (DDL), create_all, pg_dump, LISTEN/NOTIFY

DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL_UNPOOLED = os.getenv("DATABASE_URL_UNPOOLED", DATABASE_URL)

def normalize_pg_url(url: str | None) -> str | None:
    """Normalize postgresql:// to postgresql+psycopg:// for SQLAlchemy 2.0 compatibility."""
    if not url:
        return None
    url = url.strip()
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url

DATABASE_URL = normalize_pg_url(DATABASE_URL)
DATABASE_URL_UNPOOLED = normalize_pg_url(DATABASE_URL_UNPOOLED) or DATABASE_URL

engine = None
migration_engine = None
SessionLocal = None

if DATABASE_URL:
    try:
        # App engine: pooled connection for all runtime queries
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        # Migration engine: direct (non-pooled) connection for create_all / DDL
        migration_engine = create_engine(DATABASE_URL_UNPOOLED, pool_pre_ping=True)
        SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine,
        )
        logger.info("SQLAlchemy database engines successfully initialized.")
    except Exception as exc:
        logger.error("Failed to initialize database engine: %s", exc)
else:
    logger.warning("DATABASE_URL is not set. Database features will be unavailable.")

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a SQLAlchemy session and closes it after."""
    if SessionLocal is None:
        yield None
        return
    try:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    except Exception:
        yield None
