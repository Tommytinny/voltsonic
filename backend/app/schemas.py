from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer


class HealthResponse(BaseModel):
    status: str
    service: str


class RoundRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    round_id: int
    settled: bool
    randomness_requested: bool
    randomness_fulfilled: bool
    dice_result: int | None
    parity_result: bool | None
    total_dice_pool: Decimal
    total_parity_pool: Decimal
    snapshot_jackpot: Decimal
    total_jackpot_winners: int
    started_at: datetime | None
    closed_at: datetime | None
    settled_tx_hash: str | None
    settlement_block_number: int | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("total_dice_pool", "total_parity_pool", "snapshot_jackpot")
    def serialize_decimal_fields(self, value: Decimal) -> str:
        return format(value, "f")


class RoundWrite(BaseModel):
    round_id: int
    settled: bool = True
    randomness_requested: bool | None = None
    randomness_fulfilled: bool | None = None
    dice_result: int | None = None
    parity_result: bool | None = None
    total_dice_pool: Decimal | int | str = 0
    total_parity_pool: Decimal | int | str = 0
    snapshot_jackpot: Decimal | int | str = 0
    total_jackpot_winners: int = 0
    started_at: datetime | None = None
    closed_at: datetime | None = None
    settled_tx_hash: str | None = None
    settlement_block_number: int | None = None


class BetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    round_id: int
    user_address: str
    tx_hash: str
    dice_choice: int | None
    parity_choice: bool | None
    dice_amount: Decimal
    parity_amount: Decimal
    bet_on_dice: bool
    bet_on_parity: bool
    claimed: bool
    status: str
    payout_amount: Decimal
    block_number: int | None
    won: bool | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("dice_amount", "parity_amount", "payout_amount")
    def serialize_decimal_fields(self, value: Decimal) -> str:
        return format(value, "f")


class SyncResponse(BaseModel):
    synced_from_block: int
    synced_to_block: int
    rounds_indexed: int
    bets_indexed: int
    claims_indexed: int
