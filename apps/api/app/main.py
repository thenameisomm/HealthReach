from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db, is_persistent
from app.routers.api import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    await init_db(s.MONGODB_URI)
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="HealthReach AI API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/api")

    @app.get("/health")
    async def health():
        return {
            "ok": True,
            "qlooConfigured": s.qloo_configured,
            "llmConfigured": s.llm_configured,
            "dbMode": "mongo" if is_persistent() else "memory",
        }

    return app


app = create_app()
