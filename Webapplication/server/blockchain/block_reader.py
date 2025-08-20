```python
import os
import struct
import json
from datetime import datetime
from pathlib import Path

class BlockReader:
    def __init__(self, data_dir="./data"):
        self.data_dir = Path(data_dir)
        if not self.data_dir.exists():
            self.data_dir.mkdir(parents=True)

    def get_block_path(self, block_number):
        """Get the path for a specific block file."""
        return self.data_dir / f"BLK{block_number:04d}.dat"

    def read_block(self, block_number):
        """Read a block file and return its contents as a dictionary."""
        block_path = self.get_block_path(block_number)
        if not block_path.exists():
            return None
            
        try:
            with open(block_path, 'rb') as f:
                # Read block header and data
                # Structure will need to be updated based on actual format
                timestamp = int.from_bytes(f.read(8), 'little')
                target_distance = struct.unpack('d', f.read(8))[0]
                winner_id = int.from_bytes(f.read(4), 'little')
                distance = struct.unpack('d', f.read(8))[0]
                miner_address = f.read(64).decode('utf-8').strip('\x00')
                block_hash = f.read(32).hex()
                
                return {
                    "blockNumber": block_number,
                    "timestamp": datetime.fromtimestamp(timestamp).isoformat(),
                    "targetDistance": target_distance,
                    "winnerId": winner_id,
                    "travelDistance": distance,
                    "minerAddress": miner_address,
                    "blockHash": block_hash
                }
        except Exception as e:
            print(f"Error reading block {block_number}: {e}")
            return None

    def get_latest_block_number(self):
        """Get the number of the latest block."""
        block_files = list(self.data_dir.glob("BLK????.dat"))
        if not block_files:
            return 0
        latest_file = max(block_files)
        return int(latest_file.stem[3:])  # Extract number from BLK####

    def get_blocks(self, start=0, limit=50):
        """Get a list of blocks from start to limit."""
        blocks = []
        latest = self.get_latest_block_number()
        
        for block_num in range(max(0, latest - limit + 1), latest + 1):
            block = self.read_block(block_num)
            if block:
                blocks.append(block)
                
        return blocks[::-1]  # Return in reverse order (newest first)

    def watch_for_new_blocks(self):
        """Generator that yields new blocks as they appear."""
        last_known = self.get_latest_block_number()
        
        while True:
            current = self.get_latest_block_number()
            if current > last_known:
                for block_num in range(last_known + 1, current + 1):
                    block = self.read_block(block_num)
                    if block:
                        yield block
                last_known = current
```
