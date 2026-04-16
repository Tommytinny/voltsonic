from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.models import Round
from app.schemas import RoundRead, RoundWrite


router = APIRouter(prefix="/api/v1/rounds", tags=["rounds"])


@router.get("", response_model=list[RoundRead])
async def list_rounds(
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(db_session),
) -> list[RoundRead]:
    result = await session.execute(select(Round).order_by(desc(Round.round_id)).limit(limit))
    return list(result.scalars().all())


@router.get("/latest/result", response_model=RoundRead)
async def get_latest_settled_round(session: AsyncSession = Depends(db_session)) -> RoundRead:
    result = await session.execute(
        select(Round).where(Round.settled.is_(True)).order_by(desc(Round.round_id)).limit(1)
    )
    round_record = result.scalar_one_or_none()
    if round_record is None:
        raise HTTPException(status_code=404, detail="No settled rounds indexed yet")
    return round_record


@router.get("/{round_id}", response_model=RoundRead)
async def get_round(round_id: int, session: AsyncSession = Depends(db_session)) -> RoundRead:
    result = await session.execute(select(Round).where(Round.round_id == round_id))
    round_record = result.scalar_one_or_none()
    if round_record is None:
        raise HTTPException(status_code=404, detail="Round not found")
    return round_record


@router.post("", response_model=RoundRead)
async def upsert_round(round_data: RoundWrite, session: AsyncSession = Depends(db_session)) -> RoundRead:
    result = await session.execute(select(Round).where(Round.round_id == round_data.round_id))
    round_record = result.scalar_one_or_none()

    if round_record is None:
        round_record = Round(round_id=round_data.round_id)
        session.add(round_record)

    round_record.settled = round_data.settled
    if round_data.randomness_requested is not None:
        round_record.randomness_requested = round_data.randomness_requested
    if round_data.randomness_fulfilled is not None:
        round_record.randomness_fulfilled = round_data.randomness_fulfilled
    round_record.dice_result = round_data.dice_result
    round_record.parity_result = round_data.parity_result
    round_record.total_dice_pool = str(round_data.total_dice_pool)
    round_record.total_parity_pool = str(round_data.total_parity_pool)
    round_record.snapshot_jackpot = str(round_data.snapshot_jackpot)
    round_record.total_jackpot_winners = round_data.total_jackpot_winners
    round_record.started_at = round_data.started_at
    round_record.closed_at = round_data.closed_at
    round_record.settled_tx_hash = round_data.settled_tx_hash
    round_record.settlement_block_number = round_data.settlement_block_number

    await session.commit()
    await session.refresh(round_record)
    return round_record
