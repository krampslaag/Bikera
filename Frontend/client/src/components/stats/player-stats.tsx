import { Card, CardContent } from "@/components/ui/card";

// Mock data for static deployment
const mockStats = {
  totalBlocks: 156,
  totalRewards: 2345.67,
  averageDistance: 4.32,
  currentDistance: 2.21
};

export function PlayerStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Current Distance</div>
          <div className="text-2xl font-bold">{mockStats.currentDistance} km</div>
        </CardContent>
      </Card>


        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Avg Distance</div>
            <div className="text-2xl font-bold">{mockStats.averageDistance.toFixed(2)} km</div>
          </CardContent>
        </Card>

      
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total Blocks Mined</div>
          <div className="text-2xl font-bold">{mockStats.totalBlocks}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total Rewards</div>
          <div className="text-2xl font-bold">{mockStats.totalRewards.toFixed(2)} iMERA</div>
        </CardContent>
      </Card>
      </div>
  );
}