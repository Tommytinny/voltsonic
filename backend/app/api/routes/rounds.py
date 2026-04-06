from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.models import Round
from app.schemas import RoundRead


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
