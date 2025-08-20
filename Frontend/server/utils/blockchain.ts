import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

interface Block {
  index: number;
  timestamp: string;
  data: any;
  previousHash: string;
  hash: string;
}

export class BlockchainStorage {
  private readonly dataDir: string = 'data/blocks';

  constructor() {
    // Ensure blocks directory exists
    fs.mkdir(this.dataDir, { recursive: true }).catch(console.error);
  }

  private getBlockFileName(index: number): string {
    return path.join(this.dataDir, `BLK${index.toString().padStart(4, '0')}.dat`);
  }

  async saveBlock(block: Block): Promise<void> {
    const fileName = this.getBlockFileName(block.index);
    await fs.writeFile(fileName, JSON.stringify(block, null, 2));
  }

  async getBlock(index: number): Promise<Block | null> {
    try {
      const fileName = this.getBlockFileName(index);
      const data = await fs.readFile(fileName, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async getLatestBlockIndex(): Promise<number> {
    try {
      const files = await fs.readdir(this.dataDir);
      const blockFiles = files.filter(f => f.startsWith('BLK') && f.endsWith('.dat'));
      if (blockFiles.length === 0) return -1;
      
      const indices = blockFiles.map(f => parseInt(f.slice(3, 7), 10));
      return Math.max(...indices);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return -1;
      }
      throw error;
    }
  }

  async getAllBlocks(): Promise<Block[]> {
    const latestIndex = await this.getLatestBlockIndex();
    const blocks: Block[] = [];
    
    for (let i = 0; i <= latestIndex; i++) {
      const block = await this.getBlock(i);
      if (block) blocks.push(block);
    }
    
    return blocks;
  }

  calculateHash(index: number, timestamp: string, data: any, previousHash: string): string {
    return createHash('sha256')
      .update(`${index}${timestamp}${JSON.stringify(data)}${previousHash}`)
      .digest('hex');
  }
}

export const blockchainStorage = new BlockchainStorage();
