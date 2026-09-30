import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.scheduler import connected_clients

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/rounds")
async def websocket_rounds(websocket: WebSocket):
    """
    WebSocket endpoint for real-time round updates.
    
    Clients connect here and receive updates whenever:
    - A new round starts
    - A round closes
    - A round is settled
    - Pool amounts change
    """
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info(f"Client connected. Total clients: {len(connected_clients)}")
    
    try:
        # Keep connection alive and listen for messages
        # (we mainly broadcast, but listen in case we need to handle client messages)
        while True:
            # Wait for a message from the client
            # This keeps the connection alive
            data = await websocket.receive_text()
            logger.debug(f"Received from client: {data}")
            
            # Optionally handle client commands here
            # For now, we just keep the connection open
            
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(connected_clients)}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        connected_clients.discard(websocket)
