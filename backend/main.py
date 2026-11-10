"""
Vercel FastAPI entrypoint
Exposes the FastAPI instance 'app' at the root of the backend directory.
"""
import os
import sys

# Ensure current directory is always in sys.path on Linux serverless runtimes
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from app.main import app
except Exception as e:
    # Print exact import traceback to Vercel runtime logs for immediate visibility
    import traceback
    traceback.print_exc()
    raise e

__all__ = ["app"]
