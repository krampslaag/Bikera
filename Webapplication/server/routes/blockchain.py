```python
from fastapi import APIRouter, WebSocket
from ..blockchain.manager import blockchain_manager

router = APIRouter(prefix="/api")

@router.get("/blocks")
async def get_blocks(limit: int = 50):
    """Get the latest blocks."""
    return blockchain_manager.get_latest_blocks(limit)

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    blockchain_manager.add_client(websocket)
    
    try:
        # Start watching for updates if not already watching
        if not blockchain_manager.watching:
            await blockchain_manager.start_watching()
            
        # Keep connection alive and handle incoming messages
        while True:
            try:
                await websocket.receive_text()
            except:
                break
                
    finally:
        blockchain_manager.remove_client(websocket)
```
