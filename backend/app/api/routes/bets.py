from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.models import Bet, Round
from app.schemas import BetRead, BetWrite


router = APIRouter(prefix="/api/v1/bets", tags=["bets"])


@router.post("", response_model=BetRead)
async def save_bet(bet_data: BetWrite, session: AsyncSession = Depends(db_session)) -> BetRead:
    tx_hash = bet_data.tx_hash.lower()
    result = await session.execute(select(Bet).where(Bet.tx_hash == tx_hash))
    bet = result.scalar_one_or_none()
    if bet is not None:
        return bet

    bet = Bet(
        round_id=bet_data.round_id,
        user_address=bet_data.user_address.lower(),
        tx_hash=tx_hash,
        dice_choice=bet_data.dice_choice,
        parity_choice=bet_data.parity_choice,
        dice_amount=str(bet_data.dice_amount),
        parity_amount=str(bet_data.parity_amount),
        bet_on_dice=bet_data.bet_on_dice,
        bet_on_parity=bet_data.bet_on_parity,
        claimed=False,
        status="open",
        payout_amount="0",
        block_number=bet_data.block_number,
    )
    session.add(bet)

    round_result = await session.execute(select(Round).where(Round.round_id == bet_data.round_id))
    if round_result.scalar_one_or_none() is None:
        session.add(Round(round_id=bet_data.round_id))

    await session.commit()
    await session.refresh(bet)
    return bet


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
