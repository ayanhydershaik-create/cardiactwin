"""
Vercel FastAPI entrypoint
Exposes the FastAPI instance 'app' at the root of the backend directory.
"""
import os
import sys
import traceback

# Ensure backend root is always in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

try:
    from app.main import app as _imported_app
    app = _imported_app
except Exception as exc:
    # Diagnostic fallback: if any dependency or import fails, return the error
    # instead of letting Vercel crash with opaque FUNCTION_INVOCATION_FAILED.
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    _err_msg = traceback.format_exc()
    app = FastAPI(title="Cardiac Digital Twin API (Diagnostic Mode)")

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"])
    def catch_all_error(path: str = ""):
        return JSONResponse(
            status_code=500,
            content={
                "error": "FastAPI failed to start on Vercel",
                "exception": str(exc),
                "traceback": _err_msg.splitlines()[-10:],
            },
        )

__all__ = ["app"]

