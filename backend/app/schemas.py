from datetime import datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str


class RoundState(BaseModel):
    """Live round state broadcast via WebSocket"""
    round_id: int
    is_betting_open: bool
    total_dice_pool: str
    total_parity_pool: str
    current_jackpot: str
    minimum_bet: str
    start_time: int
    close_time: int
    settled: bool
    dice_result: int | None
    parity_result: bool | None
    snapshot_jackpot: str
    total_jackpot_winners: int
    timestamp: str
