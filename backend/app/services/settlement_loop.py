import asyncio
import random
import logging
from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Round
from app.services.contract import get_voltsonic_contract, get_web3


logger = logging.getLogger(__name__)


async def settle_due_rounds(session: AsyncSession) -> int:
    """
    Check for rounds that need settlement and settle them using backend-generated randomness.
    Returns the number of rounds settled.
    """
    settings = get_settings()
    w3 = get_web3()
    contract = get_voltsonic_contract(w3)
    settled_count = 0
    
    try:
        # Get current round state from contract
        curr_state = contract.functions.getCurrentRoundState().call()
        current_rid = int(curr_state[0])
        close_time = int(curr_state[7])
        is_settled = False
        
        # Check if current round is ready for settlement
        current_timestamp = datetime.now(UTC).timestamp()
        if current_timestamp >= close_time and not is_settled:
            try:
                # Generate backend randomness
                random_word = random.randint(0, 2**256 - 1)
                
                # Call contract settlement with backend random number
                logger.info(f"Settling round {current_rid} with random word {random_word}")
                tx_hash = contract.functions.settleRound(current_rid, random_word).transact()
                
                # Wait for transaction to be mined
                receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                
                if receipt and receipt.get("status") == 1:
                    logger.info(f"Successfully settled round {current_rid} with tx {tx_hash.hex()}")
                    settled_count += 1
                    
                    # Update round in database
                    result = await session.execute(select(Round).where(Round.round_id == current_rid))
                    round_record = result.scalar_one_or_none()
                    if round_record:
                        round_record.settled = True
                        round_record.settled_tx_hash = tx_hash.hex()
                        round_record.settlement_block_number = receipt.get("blockNumber")
                        round_record.updated_at = datetime.now(UTC)
                        await session.commit()
                else:
                    logger.error(f"Transaction failed for round {current_rid}")
                    
            except Exception as e:
                logger.error(f"Error settling round {current_rid}: {e}")
        
    except Exception as e:
        logger.error(f"Error checking for due rounds: {e}")
    
    return settled_count


async def backend_settlement_loop():
    """
    Runs continuously to settle rounds on a scheduled basis.
    Checks every configured interval for rounds that have closed and need settlement.
    """
    settings = get_settings()
    settlement_interval = int(settings.__dict__.get("settlement_check_interval", 10))
    
    logger.info(f"Starting backend settlement loop with {settlement_interval}s interval")
    
    while True:
        try:
            await asyncio.sleep(settlement_interval)
            
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
            await asyncio.sleep(5)
