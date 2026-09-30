import asyncio
import random
import logging
from datetime import datetime, UTC
from typing import Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Round
from app.services.contract import get_current_round_state, get_round_summary, get_web3, get_voltsonic_contract

logger = logging.getLogger(__name__)

# Global set to track WebSocket connections
connected_clients: Set = set()


async def broadcast_round_update(round_state: dict):
    """
    Broadcast round state changes to all connected WebSocket clients.
    """
    if not connected_clients:
        return
    
    # Create a message for all clients
    message = {
        "type": "round_update",
        "data": round_state
    }
    
    # Send to all connected clients
    disconnected = set()
    for client in connected_clients:
        try:
            await client.send_json(message)
        except Exception as e:
            logger.warning(f"Failed to send to client: {e}")
            disconnected.add(client)
    
    # Clean up disconnected clients
    for client in disconnected:
        connected_clients.discard(client)


async def get_or_create_round(session: AsyncSession, round_id: int) -> Round:
    """
    Get or create a round record in the database.
    """
    result = await session.execute(select(Round).where(Round.round_id == round_id))
    round_record = result.scalar_one_or_none()
    
    if round_record is None:
        round_record = Round(round_id=round_id)
        session.add(round_record)
        await session.commit()
    
    return round_record


async def create_new_round(session: AsyncSession):
    """
    Start a new round on the contract if not already active.
    """
    try:
        curr_state = get_current_round_state()
        current_rid = int(curr_state[0])
        is_betting_open = bool(curr_state[1])
        
        # Round already active, no need to create new one
        if is_betting_open:
            logger.debug(f"Round {current_rid} already active with betting open")
            return current_rid, curr_state
        
        # Round is closed but not settled yet, wait
        curr_record = await get_or_create_round(session, current_rid)
        if not curr_record.settled:
            logger.debug(f"Round {current_rid} is closed but not yet settled")
            return current_rid, curr_state
        
        # Current round is settled, contract will auto-advance to next round
        # Just fetch the new state
        curr_state = get_current_round_state()
        current_rid = int(curr_state[0])
        
        # Create DB record for new round
        await get_or_create_round(session, current_rid)
        
        logger.info(f"New round {current_rid} started")
        
        return current_rid, curr_state
        
    except Exception as e:
        logger.error(f"Error creating new round: {e}")
        raise


async def close_and_settle_round(session: AsyncSession):
    """
    Check if current round should be closed and settled.
    If closed, settle with backend-generated randomness.
    """
    settings = get_settings()
    w3 = get_web3()
    contract = get_voltsonic_contract(w3)
    
    try:
        curr_state = get_current_round_state()
        current_rid = int(curr_state[0])
        is_betting_open = bool(curr_state[1])
        close_time = int(curr_state[7])
        
        current_timestamp = datetime.now(UTC).timestamp()
        
        # Round is still open
        if is_betting_open:
            logger.debug(f"Round {current_rid} betting still open. Closes in {close_time - current_timestamp}s")
            return None
        
        # Round is closed but already settled
        curr_record = await get_or_create_round(session, current_rid)
        if curr_record.settled:
            logger.debug(f"Round {current_rid} already settled")
            return None
        
        # Round is closed and ready to settle
        logger.info(f"Settling round {current_rid}")
        
        try:
            # Generate backend randomness
            random_word = random.randint(0, 2**256 - 1)
            
            # Call contract to settle
            tx_hash = contract.functions.settleRound(current_rid, random_word).transact()
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt and receipt.get("status") == 1:
                logger.info(f"Successfully settled round {current_rid} with tx {tx_hash.hex()}")
                
                # Update DB
                curr_record.settled = True
                curr_record.settled_tx_hash = tx_hash.hex()
                curr_record.settlement_block_number = receipt.get("blockNumber")
                curr_record.updated_at = datetime.now(UTC)
                
                # Get settlement details from contract
                summary = get_round_summary(current_rid)
                curr_record.dice_result = int(summary[3])
                curr_record.parity_result = bool(summary[4])
                curr_record.snapshot_jackpot = str(int(summary[6]))
                curr_record.total_jackpot_winners = int(summary[2])
                
                await session.commit()
                
                return curr_record
            else:
                logger.error(f"Transaction failed for round {current_rid}")
                return None
                
        except Exception as e:
            logger.error(f"Error settling round {current_rid}: {e}")
            return None
        
    except Exception as e:
        logger.error(f"Error in close_and_settle: {e}")
        return None


async def round_lifecycle_scheduler():
    """
    Main scheduler that manages the complete round lifecycle:
    1. Ensures a round is active (creates new rounds when needed)
    2. Checks if current round should be closed and settled
    3. Broadcasts state changes to connected clients
    
    Runs every configured interval (default 5 seconds).
    """
    settings = get_settings()
    scheduler_interval = settings.scheduler_interval  # Default 5 seconds
    
    logger.info(f"Starting round lifecycle scheduler with {scheduler_interval}s interval")
    
    while True:
        try:
            await asyncio.sleep(scheduler_interval)
            
            from app.db import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                # Step 1: Ensure a round is active
                try:
                    round_id, round_state = await create_new_round(session)
                    logger.debug(f"Round {round_id} is active")
                except Exception as e:
                    logger.error(f"Failed to create/ensure round: {e}")
                    continue
                
                # Step 2: Check if current round needs settlement
                try:
                    settled_record = await close_and_settle_round(session)
                    if settled_record:
                        logger.info(f"Round {settled_record.round_id} has been settled")
                except Exception as e:
                    logger.error(f"Failed to settle round: {e}")
                
                # Step 3: Fetch fresh state and broadcast to clients
                try:
                    curr_state = get_current_round_state()
                    round_id = int(curr_state[0])
                    
                    round_record = await get_or_create_round(session, round_id)
                    
                    # Build broadcast message
                    broadcast_msg = {
                        "round_id": round_id,
                        "is_betting_open": bool(curr_state[1]),
                        "total_dice_pool": str(int(curr_state[2])),
                        "total_parity_pool": str(int(curr_state[3])),
                        "current_jackpot": str(int(curr_state[4])),
                        "minimum_bet": str(int(curr_state[5])),
                        "start_time": int(curr_state[6]),
                        "close_time": int(curr_state[7]),
                        "settled": round_record.settled,
                        "dice_result": round_record.dice_result,
                        "parity_result": round_record.parity_result,
                        "snapshot_jackpot": round_record.snapshot_jackpot,
                        "total_jackpot_winners": round_record.total_jackpot_winners,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                    
                    await broadcast_round_update(broadcast_msg)
                    
                except Exception as e:
                    logger.error(f"Failed to broadcast state: {e}")
                    
        except asyncio.CancelledError:
            logger.info("Round lifecycle scheduler cancelled")
            break
        except Exception as e:
            logger.error(f"Round lifecycle scheduler error: {e}", exc_info=True)
            await asyncio.sleep(5)
