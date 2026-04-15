from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Bet, Round, SyncState
from app.schemas import SyncResponse
from app.services.contract import get_voltsonic_contract
from app.services.rpc import MultiRPCWeb3


SYNC_KEY = "voltsonic_indexer"


def _utc_datetime_from_timestamp(timestamp: int | None) -> datetime | None:
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=UTC)


async def _get_or_create_sync_state(session: AsyncSession) -> SyncState:
    result = await session.execute(select(SyncState).where(SyncState.key == SYNC_KEY))
    sync_state = result.scalar_one_or_none()
    if sync_state is None:
        sync_state = SyncState(
            key=SYNC_KEY,
            last_synced_block=max(get_settings().indexer_start_block - 1, 0),
        )
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
    rpc_urls = [url.strip() for url in settings.voltsonic_rpc_urls.split(",") if url.strip()]
    if not rpc_urls:
        raise ValueError("Missing VOLTSONIC_RPC_URLS in .env")

    rpc = MultiRPCWeb3(rpc_urls)

    def rpc_call(fn):
        return rpc.eth_call(fn)

    latest_block = rpc_call(lambda w3: w3.eth.block_number)
    sync_state = await _get_or_create_sync_state(session)

    from_block = from_block_override if from_block_override is not None else max(
        sync_state.last_synced_block + 1,
        settings.indexer_start_block,
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
    if max_blocks:
        target_block = min(latest_block, from_block + max_blocks - 1)

    rounds_indexed = 0
    bets_indexed = 0
    claims_indexed = 0

    block_cache = {}

    def get_block_cached(block_number: int):
        if block_number not in block_cache:
            block_cache[block_number] = rpc_call(lambda w3: w3.eth.get_block(block_number))
        return block_cache[block_number]

    current_from = from_block

    while current_from <= target_block:
        current_to = min(
            current_from + settings.indexer_block_chunk_size - 1,
            target_block,
        )

        bet_logs = rpc_call(
            lambda w3: get_voltsonic_contract(w3).events.BetPlaced.get_logs(
                from_block=current_from,
                to_block=current_to,
            )
        )

        round_logs = rpc_call(
            lambda w3: get_voltsonic_contract(w3).events.RoundSettled.get_logs(
                from_block=current_from,
                to_block=current_to,
            )
        )

        winnings_logs = rpc_call(
            lambda w3: get_voltsonic_contract(w3).events.WinningsCredited.get_logs(
                from_block=current_from,
                to_block=current_to,
            )
        )

        # -------------------------
        # BETS
        # -------------------------
        for log in bet_logs:
            tx_hash = log["transactionHash"].hex()

            result = await session.execute(
                select(Bet).where(Bet.tx_hash == tx_hash)
            )
            if result.scalar_one_or_none():
                continue

            args = log["args"]
            block = get_block_cached(log["blockNumber"])

            bet_record = Bet(
                round_id=int(args["roundId"]),
                user_address=args["user"].lower(),
                tx_hash=tx_hash,
                dice_choice=int(args["diceChoice"]) or None,
                parity_choice=bool(args["parityChoice"]),
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

            await _get_or_create_round(session, int(args["roundId"]))

        # -------------------------
        # ROUND SETTLEMENT
        # -------------------------
        for log in round_logs:
            args = log["args"]
            round_id = int(args["roundId"])

            round_record = await _get_or_create_round(session, round_id)

            summary = rpc_call(
                lambda w3: get_voltsonic_contract(w3).functions.getRoundSummary(round_id).call()
            )
            randomness_state = rpc_call(
                lambda w3: get_voltsonic_contract(w3).functions.getRoundRandomnessState(round_id).call()
            )

            round_record.total_dice_pool = _decimal_string(summary[0])
            round_record.total_parity_pool = _decimal_string(summary[1])
            round_record.total_jackpot_winners = summary[2]
            round_record.dice_result = summary[3]
            round_record.parity_result = bool(summary[4])
            round_record.settled = bool(summary[5])
            round_record.snapshot_jackpot = _decimal_string(summary[6])

            round_record.randomness_requested = randomness_state[0]
            round_record.randomness_fulfilled = randomness_state[1]

            block = get_block_cached(log["blockNumber"])
            round_record.closed_at = _utc_datetime_from_timestamp(block["timestamp"])

            rounds_indexed += 1

            await session.flush()

            # ❌ REMOVED: per-bet claim preview calls (MAJOR FIX)

        # -------------------------
        # CLAIMS
        # -------------------------
        for log in winnings_logs:
            args = log["args"]

            result = await session.execute(
                select(Bet).where(
                    Bet.round_id == int(args["roundId"]),
                    Bet.user_address == args["user"].lower(),
                )
            )

            bet = result.scalar_one_or_none()
            if bet:
                bet.claimed = True
                bet.status = "claimed"
                bet.won = True
                bet.payout_amount = _decimal_string(int(args["amount"]))
                claims_indexed += 1

        await session.flush()

        sync_state.last_synced_block = current_to
        current_from = current_to + 1

        # small global throttle per chunk
        await asyncio.sleep(0.05)

    await session.commit()

    return SyncResponse(
        synced_from_block=from_block,
        synced_to_block=target_block,
        rounds_indexed=rounds_indexed,
        bets_indexed=bets_indexed,
        claims_indexed=claims_indexed,
    )
