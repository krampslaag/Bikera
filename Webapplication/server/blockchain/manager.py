```python
import asyncio
import json
from pathlib import Path
from .block_reader import BlockReader

class BlockchainManager:
    def __init__(self, data_dir="./data"):
        self.reader = BlockReader(data_dir)
        self.connected_clients = set()
        self.watching = False
        
    async def start_watching(self):
        """Start watching for new blocks and broadcast updates."""
        if self.watching:
            return
            
        self.watching = True
        while self.watching:
            try:
                current = self.reader.get_latest_block_number()
                block = self.reader.read_block(current)
                
                if block:
                    await self.broadcast_update({
                        "type": "BLOCK_UPDATE",
                        "data": block
                    })
                
            except Exception as e:
                print(f"Error watching blocks: {e}")
                
            await asyncio.sleep(1)  # Check every second

    def stop_watching(self):
        """Stop watching for new blocks."""
        self.watching = False

    async def broadcast_update(self, message):
        """Broadcast an update to all connected clients."""
        message_str = json.dumps(message)
        disconnected = set()
        
        for client in self.connected_clients:
            try:
                await client.send(message_str)
            except:
                disconnected.add(client)
                
        # Remove disconnected clients
        self.connected_clients -= disconnected

    def add_client(self, websocket):
        """Add a new WebSocket client."""
        self.connected_clients.add(websocket)

    def remove_client(self, websocket):
        """Remove a WebSocket client."""
        self.connected_clients.discard(websocket)

    def get_latest_blocks(self, limit=50):
        """Get the latest blocks."""
        return self.reader.get_blocks(limit=limit)

blockchain_manager = BlockchainManager()
```
