import getpass
import os
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker

def build_database_url():
    password = os.getenv("DB_PASSWORD", "ayanadnan")
    return URL.create(
        "postgresql+psycopg",
        username=os.getenv("DB_USER", "cardiac_admin"),
        password=password,
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "cardiac_twin"),
    )

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    engine = create_engine(build_database_url(), pool_pre_ping=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()

def get_db():
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
