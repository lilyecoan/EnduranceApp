from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import structlog

from app.core.config import settings
from app.db.base import engine
from app.routers import coaching, profile

log = structlog.get_logger()

app = FastAPI(
    title="IronMind AI",
    description="Adaptive AI-powered endurance coaching platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(coaching.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")


@app.get("/health")
async def health():
    db_ok = True
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    status_str = "ok" if db_ok else "degraded"
    return {"status": status_str, "app": settings.app_name, "database": db_ok}


@app.get("/")
async def root():
    return {"message": "IronMind AI API", "docs": "/docs"}
