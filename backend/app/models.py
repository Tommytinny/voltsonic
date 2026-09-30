from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Round(Base):
    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    settled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    dice_result: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parity_result: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    snapshot_jackpot: Mapped[str] = mapped_column(String(78), default="0")
    total_jackpot_winners: Mapped[int] = mapped_column(BigInteger, default=0)
    settled_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True, index=True)
    settlement_block_number: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
