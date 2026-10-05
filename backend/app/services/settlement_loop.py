import asyncio
import random
import logging
from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3

from app.config import get_settings
from app.models import Bet, Round
from app.services.contract import get_voltsonic_contract, get_web3


logger = logging.getLogger(__name__)


def _datetime_from_timestamp(timestamp: int) -> datetime:
    return datetime.fromtimestamp(timestamp, tz=UTC)


def _read_round_state_and_summaries(contract) -> tuple[tuple, list[tuple[int, tuple]]]:
    current_state = contract.functions.getCurrentRoundState().call()
    round_id = int(current_state[0])
    first_round_id = max(0, round_id - 9)
    summaries = [
        (snapshot_round_id, contract.functions.getRoundSummary(snapshot_round_id).call())
        for snapshot_round_id in range(first_round_id, round_id + 1)
    ]
    return current_state, summaries


def _settle_round_on_chain(w3, contract, private_key: str, round_id: int):
    signer = w3.eth.account.from_key(private_key)
    contract_owner = Web3.to_checksum_address(contract.functions.owner().call())
    if signer.address != contract_owner:
        raise ValueError(
            f"Configured settlement signer {signer.address} is not contract owner {contract_owner}"
        )

    random_word = random.randint(0, 2**256 - 1)
    settlement = contract.functions.settleRound(round_id, random_word)
    transaction = settlement.build_transaction({
        "from": signer.address,
        "nonce": w3.eth.get_transaction_count(signer.address, "pending"),
        "chainId": w3.eth.chain_id,
    })
    signed_transaction = w3.eth.account.sign_transaction(transaction, private_key)
    raw_transaction = getattr(signed_transaction, "raw_transaction", None)
    if raw_transaction is None:
        raw_transaction = signed_transaction.rawTransaction

    tx_hash = w3.eth.send_raw_transaction(raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if not receipt or receipt.get("status") != 1:
        raise RuntimeError(f"Settlement transaction failed for round {round_id}")

    summary = contract.functions.getRoundSummary(round_id).call()
    return tx_hash.hex(), receipt, summary


async def save_round_snapshot(session: AsyncSession, contract) -> tuple[int, tuple, tuple]:
    current_state, summaries = await asyncio.to_thread(_read_round_state_and_summaries, contract)
    round_id = int(current_state[0])
    summary = ()

    for snapshot_round_id, round_summary in summaries:
        result = await session.execute(select(Round).where(Round.round_id == snapshot_round_id))
        round_record = result.scalar_one_or_none()
        if round_record is None:
            round_record = Round(round_id=snapshot_round_id)
            session.add(round_record)

        round_record.settled = bool(round_summary[5])
        if round_record.settled:
            round_record.total_dice_pool = str(int(round_summary[0]))
            round_record.total_parity_pool = str(int(round_summary[1]))
            round_record.total_jackpot_winners = int(round_summary[2])
            round_record.dice_result = int(round_summary[3])
            round_record.parity_result = bool(round_summary[4])
            round_record.snapshot_jackpot = str(int(round_summary[6]))
            await _update_round_bets(session, round_record, datetime.now(UTC))

        if snapshot_round_id == round_id:
            round_record.total_dice_pool = str(int(current_state[2]))
            round_record.total_parity_pool = str(int(current_state[3]))
            round_record.started_at = _datetime_from_timestamp(int(current_state[6]))
            round_record.closed_at = _datetime_from_timestamp(int(current_state[7]))
            summary = round_summary

    await session.flush()
    return round_id, summary, current_state


async def _update_round_bets(session: AsyncSession, round_record: Round, settled_at: datetime) -> None:
    result = await session.execute(
        select(Bet).where(Bet.round_id == round_record.round_id, Bet.status == "open")
    )
    for bet in result.scalars().all():
        won_dice = bet.bet_on_dice and bet.dice_choice == round_record.dice_result
        won_parity = bet.bet_on_parity and bet.parity_choice == round_record.parity_result
        bet.won = won_dice or won_parity
        bet.status = "won" if bet.won else "lost"
        bet.updated_at = settled_at


async def settle_due_rounds(session: AsyncSession) -> int:
    """
    Check for rounds that need settlement and settle them using backend-generated randomness.
    Returns the number of rounds settled.
    """
    settings = get_settings()
    w3 = await asyncio.to_thread(get_web3)
    contract = get_voltsonic_contract(w3)
    settled_count = 0
    
    try:
        current_rid, round_summary, curr_state = await save_round_snapshot(session, contract)
        await session.commit()
        close_time = int(curr_state[7])
        is_settled = bool(round_summary[5])
        
        # Check if current round is ready for settlement
        current_timestamp = datetime.now(UTC).timestamp()
        if current_timestamp >= close_time and not is_settled:
            try:
                if not settings.voltsonic_private_key:
                    logger.error("Cannot settle round %s: VOLTSONIC_PRIVATE_KEY is not configured", current_rid)
                    return settled_count

                logger.info("Submitting settlement transaction for round %s", current_rid)
                tx_hash, receipt, summary = await asyncio.to_thread(
                    _settle_round_on_chain,
                    w3,
                    contract,
                    settings.voltsonic_private_key,
                    current_rid,
                )
                logger.info("Successfully settled round %s with tx %s", current_rid, tx_hash)
                settled_count += 1

                result = await session.execute(select(Round).where(Round.round_id == current_rid))
                round_record = result.scalar_one_or_none()
                if round_record is None:
                    round_record = Round(round_id=current_rid)
                    session.add(round_record)

                settled_at = datetime.now(UTC)
                round_record.total_dice_pool = str(int(summary[0]))
                round_record.total_parity_pool = str(int(summary[1]))
                round_record.total_jackpot_winners = int(summary[2])
                round_record.dice_result = int(summary[3])
                round_record.parity_result = bool(summary[4])
                round_record.settled = bool(summary[5])
                round_record.snapshot_jackpot = str(int(summary[6]))
                round_record.settled_tx_hash = tx_hash
                round_record.settlement_block_number = receipt.get("blockNumber")
                round_record.updated_at = settled_at
                await _update_round_bets(session, round_record, settled_at)
                await session.commit()

                await save_round_snapshot(session, contract)
                await session.commit()
                    
            except Exception:
                logger.exception("Error settling round %s", current_rid)
        
    except Exception as e:
        logger.error(f"Error checking for due rounds: {e}")
    
    return settled_count


async def backend_settlement_loop():
    """
    Runs continuously to manage the game lifecycle:
    1. Checks every configured interval for rounds that have closed
    2. Settles closed rounds with backend-generated randomness
    3. Allows frontend to listen for round events and update accordingly
    
    This removes the dependency on Chainlink VRF and gives complete control to the backend.
    """
    settings = get_settings()
    settlement_interval = settings.settlement_check_interval
    
    logger.info(f"Starting backend settlement loop with {settlement_interval}s interval")
    logger.info("Backend is now responsible for: starting rounds, checking for closure, and settling with randomness")
    
    while True:
        try:
            # Get DB session and settle rounds
            from app.db import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                settled = await settle_due_rounds(session)
                if settled > 0:
                    logger.info(f"Settled {settled} rounds via backend loop")

        except asyncio.CancelledError:
            logger.info("Backend settlement loop cancelled")
            break
        except Exception as e:
            logger.error(f"Backend settlement loop error: {e}", exc_info=True)
        await asyncio.sleep(settlement_interval)
