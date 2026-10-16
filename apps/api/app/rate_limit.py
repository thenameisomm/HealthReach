"""Simple in-memory rate limiter (per-IP, sliding window)."""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request

_hits: dict[str, list[float]] = defaultdict(list)
LIMIT = 60
WINDOW = 60.0


async def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - WINDOW
    _hits[ip] = [t for t in _hits[ip] if t > window_start]
    if len(_hits[ip]) >= LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please retry shortly.")
    _hits[ip].append(now)
