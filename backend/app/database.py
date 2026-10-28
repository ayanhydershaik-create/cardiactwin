
import getpass
import os

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker

def build_database_url():
    password = getpass.getpass("PostgreSQL password: ")
    return URL.create(
        "postgresql+psycopg",
        username="cardiac_admin",
        password=password,
        host="127.0.0.1",
        port=5432,
        database="cardiac_twin",
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
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
