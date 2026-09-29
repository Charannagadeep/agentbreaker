"""AgentBreaker web server."""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import FastAPI, HTTPException, Path as PathParam, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .levels import LEVELS, LEVELS_BY_ID

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
MAX_MESSAGE_CHARS = 500
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = 60

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
        "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; "
        "form-action 'self'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}

app = FastAPI(title="AgentBreaker", docs_url=None, redoc_url=None, openapi_url=None)
_request_log: dict[str, deque[float]] = defaultdict(deque)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)


class SubmitRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=100)


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _rate_limited(key: str) -> bool:
    now = time.monotonic()
    window = _request_log[key]
    while window and now - window[0] > RATE_LIMIT_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= RATE_LIMIT_REQUESTS:
        return True
    window.append(now)
    return False


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method == "POST":
        if _rate_limited(_client_key(request)):
            response = JSONResponse({"detail": "Too many requests. Slow down, hacker!"}, status_code=429)
            response.headers.update(SECURITY_HEADERS)
            return response
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def _get_level(level_id: int):
    level = LEVELS_BY_ID.get(level_id)
    if level is None:
        raise HTTPException(status_code=404, detail="Level not found")
    return level


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/levels")
def list_levels() -> list[dict]:
    return [lvl.public() for lvl in LEVELS]


@app.post("/api/levels/{level_id}/chat")
def chat(body: ChatRequest, level_id: int = PathParam(ge=1, le=100)) -> dict:
    level = _get_level(level_id)
    return level.respond(body.message.strip()).to_dict()


@app.get("/api/levels/{level_id}/hints/{hint_number}")
def get_hint(level_id: int = PathParam(ge=1, le=100), hint_number: int = PathParam(ge=1, le=10)) -> dict:
    level = _get_level(level_id)
    if hint_number > len(level.hints):
        raise HTTPException(status_code=404, detail="No more hints")
    return {"hint": level.hints[hint_number - 1], "number": hint_number, "total": len(level.hints)}


@app.post("/api/levels/{level_id}/submit")
def submit(body: SubmitRequest, level_id: int = PathParam(ge=1, le=100)) -> dict:
    level = _get_level(level_id)
    if level.check_answer(body.answer):
        return {"correct": True, "defense": level.defense, "points": level.points}
    return {"correct": False}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
