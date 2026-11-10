"""
Vercel FastAPI entrypoint
Exposes the FastAPI instance 'app' at the root of the backend directory.
"""
import os
import sys

# Ensure backend root is always in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from app.main import app as _imported_app

# Explicit top-level assignment for Vercel AST scanner
app = _imported_app

__all__ = ["app"]
