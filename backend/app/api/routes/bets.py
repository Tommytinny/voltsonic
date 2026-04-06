from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.models import Bet
from app.schemas import BetRead


router = APIRouter(prefix="/api/v1/bets", tags=["bets"])


@router.get("", response_model=list[BetRead])
async def list_bets(
    user_address: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(db_session),
) -> list[BetRead]:
    query = select(Bet)

    if user_address:
        query = query.where(Bet.user_address == user_address.lower())
    if status:
        query = query.where(Bet.status == status)

    result = await session.execute(query.order_by(desc(Bet.round_id), desc(Bet.created_at)).limit(limit))
    return list(result.scalars().all())


@router.get("/recent/open", response_model=list[BetRead])
async def list_open_bets(
    user_address: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(db_session),
) -> list[BetRead]:
    query = select(Bet).where(Bet.status == "open")
    if user_address:
        query = query.where(Bet.user_address == user_address.lower())
    result = await session.execute(query.order_by(desc(Bet.round_id), desc(Bet.created_at)).limit(limit))
    return list(result.scalars().all())


@router.get("/recent/closed", response_model=list[BetRead])
async def list_closed_bets(
    user_address: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(db_session),
) -> list[BetRead]:
    query = select(Bet).where(Bet.status.in_(("won", "lost", "claimed")))
    if user_address:
        query = query.where(Bet.user_address == user_address.lower())
    result = await session.execute(query.order_by(desc(Bet.round_id), desc(Bet.updated_at)).limit(limit))
    return list(result.scalars().all())


@router.get("/{bet_id}", response_model=BetRead)
async def get_bet(bet_id: int, session: AsyncSession = Depends(db_session)) -> BetRead:
    result = await session.execute(select(Bet).where(Bet.id == bet_id))
    bet = result.scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    return bet
