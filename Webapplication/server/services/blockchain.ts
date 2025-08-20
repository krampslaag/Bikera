import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

export interface Block {
  blockNumber: number;
  timestamp: string;
  targetDistance: number;
  winnerId: number;
  travelDistance: number;
  minerAddress: string;
  blockHash: string;
}

export async function readBlocksFromCSV(limit: number = 50): Promise<Block[]> {
  const csvPath = path.join(process.cwd(), 'data', 'Blocks.csv');
  
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const blocks: Block[] = [];
    fs.createReadStream(csvPath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true
      }))
      .on('data', (row: any) => {
        blocks.push({
          blockNumber: parseInt(row['Block Number']),
          timestamp: row['Timestamp'],
          targetDistance: parseFloat(row['Target Distance'] || '0'),
          winnerId: parseInt(row['Winner ID'] || '0'),
          travelDistance: parseFloat(row['Travel Distance'] || '0'),
          minerAddress: row['Miner Address'] || '',
          blockHash: row['Block Hash'] || ''
        });
      })
      .on('end', () => {
        // Sort blocks in descending order (newest first) and limit the results
        resolve(blocks.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit));
      })
      .on('error', reject);
  });
}

export async function readMiningRewards(): Promise<{ 
  minerAddress: string; 
  totalRewards: number; 
}[]> {
  const csvPath = path.join(process.cwd(), 'data', 'mining_rewards.csv');
  
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const rewards: { minerAddress: string; totalRewards: number; }[] = [];
    fs.createReadStream(csvPath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true
      }))
      .on('data', (row: any) => {
        rewards.push({
          minerAddress: row['Miner Address'],
          totalRewards: parseFloat(row['Total Rewards'] || '0')
        });
      })
      .on('end', () => resolve(rewards))
      .on('error', reject);
  });
}
