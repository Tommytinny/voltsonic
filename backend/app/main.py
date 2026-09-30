from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import bets, health, rounds, sync
from app.config import get_settings
from app.db import Base, engine
from app.services.settlement_loop import backend_settlement_loop


logger = logging.getLogger(__name__)
settlement_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    
    # Start settlement loop
    global settlement_task
    settlement_task = asyncio.create_task(backend_settlement_loop())
    logger.info("Backend settlement loop started")
    
    yield
    
    # Shutdown
    if settlement_task:
        settlement_task.cancel()
        try:
            await settlement_task
        except asyncio.CancelledError:
            logger.info("Backend settlement loop stopped")


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(rounds.router)
app.include_router(bets.router)
app.include_router(sync.router)
