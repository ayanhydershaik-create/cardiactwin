"""
Vercel FastAPI entrypoint
Exposes the FastAPI instance 'app' at the root of the backend directory.
"""
from app.main import app

__all__ = ["app"]
