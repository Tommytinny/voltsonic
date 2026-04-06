from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Round(Base):
    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    settled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    randomness_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    randomness_fulfilled: Mapped[bool] = mapped_column(Boolean, default=False)
    dice_result: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parity_result: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    total_dice_pool: Mapped[str] = mapped_column(Numeric(78, 0), default=0)
    total_parity_pool: Mapped[str] = mapped_column(Numeric(78, 0), default=0)
    snapshot_jackpot: Mapped[str] = mapped_column(Numeric(78, 0), default=0)
    total_jackpot_winners: Mapped[int] = mapped_column(BigInteger, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settled_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    settlement_block_number: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Bet(Base):
    __tablename__ = "bets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(BigInteger, index=True)
    user_address: Mapped[str] = mapped_column(String(42), index=True)
    tx_hash: Mapped[str] = mapped_column(String(66), unique=True, index=True)
    dice_choice: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parity_choice: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    dice_amount: Mapped[str] = mapped_column(Numeric(78, 0), default=0)
    parity_amount: Mapped[str] = mapped_column(Numeric(78, 0), default=0)
    bet_on_dice: Mapped[bool] = mapped_column(Boolean, default=False)
    bet_on_parity: Mapped[bool] = mapped_column(Boolean, default=False)
    claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    payout_amount: Mapped[str] = mapped_column(Numeric(78, 0), default=0)
    block_number: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    won: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=None, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SyncState(Base):
    __tablename__ = "sync_state"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    last_synced_block: Mapped[int] = mapped_column(BigInteger, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
