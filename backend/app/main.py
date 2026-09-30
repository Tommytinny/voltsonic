from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.api import websocket
from app.config import get_settings
from app.db import Base, engine
from app.services.scheduler import round_lifecycle_scheduler

logger = logging.getLogger(__name__)
scheduler_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    
    # Start round lifecycle scheduler
    global scheduler_task
    scheduler_task = asyncio.create_task(round_lifecycle_scheduler())
    logger.info("Round lifecycle scheduler started")
    
    yield
    
    # Shutdown
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            logger.info("Round lifecycle scheduler stopped")


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(websocket.router)
