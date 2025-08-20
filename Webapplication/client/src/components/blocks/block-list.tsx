import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BlockListProps {
  blocks?: any[];
}

// Mock data for static deployment
const mockBlocks = [
  {
    Block_Hash: "0x1234...",
    Timestamp: new Date().toISOString(),
    Winner_ID: "miner1.eth",
    Travel_Distance: "3.45",
    Target_Distance: "4.00",
    Reward: 25
  },
  {
    Block_Hash: "0x5678...",
    Timestamp: new Date(Date.now() - 300000).toISOString(),
    Winner_ID: "miner2.eth",
    Travel_Distance: "2.89",
    Target_Distance: "3.50",
    Reward: 22
  },
  {
    Block_Hash: "0x9abc...",
    Timestamp: new Date(Date.now() - 600000).toISOString(),
    Winner_ID: "miner3.eth",
    Travel_Distance: "4.12",
    Target_Distance: "4.50",
    Reward: 28
  }
];

export function BlockList({ blocks = mockBlocks }: BlockListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Block #</TableHead>
          <TableHead>Timestamp</TableHead>
          <TableHead>Winner</TableHead>
          <TableHead>Distance</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Reward</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {blocks.map((block, index) => (
          <TableRow key={block.Block_Hash}>
            <TableCell>{index + 1}</TableCell>
            <TableCell>{new Date(block.Timestamp).toLocaleString()}</TableCell>
            <TableCell>{block.Winner_ID}</TableCell>
            <TableCell>{parseFloat(block.Travel_Distance).toFixed(2)} km</TableCell>
            <TableCell>{parseFloat(block.Target_Distance).toFixed(2)} km</TableCell>
            <TableCell>{block.Reward} iMERA</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}