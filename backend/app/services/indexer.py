from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Bet, Round, SyncState
from app.schemas import SyncResponse
from app.services.contract import get_voltsonic_contract, get_web3


SYNC_KEY = "voltsonic_indexer"


def _utc_datetime_from_timestamp(timestamp: int | None) -> datetime | None:
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=UTC)


async def _get_or_create_sync_state(session: AsyncSession) -> SyncState:
    result = await session.execute(select(SyncState).where(SyncState.key == SYNC_KEY))
    sync_state = result.scalar_one_or_none()
    if sync_state is None:
        sync_state = SyncState(key=SYNC_KEY, last_synced_block=max(get_settings().indexer_start_block - 1, 0))
        session.add(sync_state)
        await session.flush()
    return sync_state


async def _get_or_create_round(session: AsyncSession, round_id: int) -> Round:
    result = await session.execute(select(Round).where(Round.round_id == round_id))
    round_record = result.scalar_one_or_none()
    if round_record is None:
        round_record = Round(round_id=round_id)
        session.add(round_record)
        await session.flush()
    return round_record


def _decimal_string(value: int) -> str:
    return str(Decimal(value))


async def sync_contract_state(
    session: AsyncSession,
    *,
    from_block_override: int | None = None,
    max_blocks: int | None = None,
) -> SyncResponse:
    settings = get_settings()
    w3 = get_web3()
    contract = get_voltsonic_contract(w3)
    latest_block = w3.eth.block_number
    sync_state = await _get_or_create_sync_state(session)

    from_block = from_block_override if from_block_override is not None else max(
        sync_state.last_synced_block + 1, settings.indexer_start_block
    )
    if from_block > latest_block:
        return SyncResponse(
            synced_from_block=from_block,
            synced_to_block=latest_block,
            rounds_indexed=0,
            bets_indexed=0,
            claims_indexed=0,
        )

    target_block = latest_block
    if max_blocks is not None and max_blocks > 0:
        target_block = min(latest_block, from_block + max_blocks - 1)

    rounds_indexed = 0
    bets_indexed = 0
    claims_indexed = 0

    current_from = from_block
    while current_from <= target_block:
        current_to = min(current_from + settings.indexer_block_chunk_size - 1, target_block)

        bet_logs = contract.events.BetPlaced.get_logs(from_block=current_from, to_block=current_to)
        round_logs = contract.events.RoundSettled.get_logs(from_block=current_from, to_block=current_to)
        winnings_logs = contract.events.WinningsCredited.get_logs(from_block=current_from, to_block=current_to)

        for log in bet_logs:
            tx_hash = log["transactionHash"].hex()
            result = await session.execute(select(Bet).where(Bet.tx_hash == tx_hash))
            bet_record = result.scalar_one_or_none()
            if bet_record is None:
                args = log["args"]
                block = w3.eth.get_block(log["blockNumber"])
                bet_record = Bet(
                    round_id=int(args["roundId"]),
                    user_address=args["user"].lower(),
                    tx_hash=tx_hash,
                    dice_choice=int(args["diceChoice"]) if int(args["diceChoice"]) > 0 else None,
                    parity_choice=bool(args["parityChoice"]) if int(args["parityAmount"]) > 0 else None,
                    dice_amount=_decimal_string(int(args["diceAmount"])),
                    parity_amount=_decimal_string(int(args["parityAmount"])),
                    bet_on_dice=int(args["diceAmount"]) > 0,
                    bet_on_parity=int(args["parityAmount"]) > 0,
                    claimed=False,
                    status="open",
                    payout_amount="0",
                    block_number=log["blockNumber"],
                    created_at=_utc_datetime_from_timestamp(block["timestamp"]),
                    updated_at=_utc_datetime_from_timestamp(block["timestamp"]),
                )
                session.add(bet_record)
                bets_indexed += 1

            await _get_or_create_round(session, int(log["args"]["roundId"]))

        for log in round_logs:
            args = log["args"]
            round_id = int(args["roundId"])
            round_record = await _get_or_create_round(session, round_id)

            summary = contract.functions.getRoundSummary(round_id).call()
            randomness_state = contract.functions.getRoundRandomnessState(round_id).call()

            round_record.total_dice_pool = _decimal_string(int(summary[0]))
            round_record.total_parity_pool = _decimal_string(int(summary[1]))
            round_record.total_jackpot_winners = int(summary[2])
            round_record.dice_result = int(summary[3])
            round_record.parity_result = bool(summary[4])
            round_record.settled = bool(summary[5])
            round_record.snapshot_jackpot = _decimal_string(int(summary[6]))
            round_record.randomness_requested = bool(randomness_state[0])
            round_record.randomness_fulfilled = bool(randomness_state[1])
            round_record.settled_tx_hash = log["transactionHash"].hex()
            round_record.settlement_block_number = log["blockNumber"]

            event_block = w3.eth.get_block(log["blockNumber"])
            round_record.closed_at = _utc_datetime_from_timestamp(event_block["timestamp"])
            rounds_indexed += 1

            result = await session.execute(select(Bet).where(Bet.round_id == round_id))
            round_bets = list(result.scalars().all())
            for bet in round_bets:
                won_dice = bet.bet_on_dice and bet.dice_choice == round_record.dice_result
                won_parity = bet.bet_on_parity and bet.parity_choice == round_record.parity_result
                won = won_dice or won_parity
                bet.won = won
                bet.status = "won" if won else "lost"
                bet.updated_at = _utc_datetime_from_timestamp(event_block["timestamp"])

        for log in winnings_logs:
            args = log["args"]
            tx_hash = log["transactionHash"].hex()
            round_id = int(args["roundId"])
            user_address = args["user"].lower()
            amount = _decimal_string(int(args["amount"]))
            result = await session.execute(
                select(Bet).where(Bet.round_id == round_id, Bet.user_address == user_address)
            )
            bet_record = result.scalar_one_or_none()
            if bet_record is not None:
                bet_record.claimed = True
                bet_record.status = "claimed"
                bet_record.won = True
                bet_record.payout_amount = amount
                bet_record.updated_at = _utc_datetime_from_timestamp(w3.eth.get_block(log["blockNumber"])["timestamp"])
                claims_indexed += 1

        await session.flush()
        sync_state.last_synced_block = current_to
        current_from = current_to + 1

    if target_block == latest_block:
        current_round = contract.functions.getCurrentRoundState().call()
        current_round_record = await _get_or_create_round(session, int(current_round[0]))
        current_round_record.total_dice_pool = _decimal_string(int(current_round[2]))
        current_round_record.total_parity_pool = _decimal_string(int(current_round[3]))
        current_round_record.started_at = _utc_datetime_from_timestamp(int(current_round[6]))
        current_round_record.closed_at = _utc_datetime_from_timestamp(int(current_round[7]))

    await session.commit()

    return SyncResponse(
        synced_from_block=from_block,
        synced_to_block=target_block,
        rounds_indexed=rounds_indexed,
        bets_indexed=bets_indexed,
        claims_indexed=claims_indexed,
    )
