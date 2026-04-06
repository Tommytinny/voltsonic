from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import bets, health, rounds, sync
from app.config import get_settings
from app.db import Base, engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.include_router(health.router)
app.include_router(rounds.router)
app.include_router(bets.router)
app.include_router(sync.router)
