from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas import SyncResponse
from app.services.indexer import sync_contract_state


router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


@router.post("", response_model=SyncResponse)
async def sync_now(
    from_block: int | None = Query(default=None, ge=0),
    max_blocks: int | None = Query(default=200, ge=1, le=5000),
    session: AsyncSession = Depends(db_session),
) -> SyncResponse:
    try:
        return await sync_contract_state(
            session,
            from_block_override=from_block,
            max_blocks=max_blocks,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
