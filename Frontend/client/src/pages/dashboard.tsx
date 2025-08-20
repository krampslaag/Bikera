import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DistanceChart } from "@/components/charts/distance-chart";
import { BlockList } from "@/components/blocks/block-list";
import { CompetitionStatus } from "@/components/mining/competition-status";
import { PlayerStats } from "@/components/stats/player-stats";
import { Leaderboard } from "@/components/leaderboard/leaderboard";

// Mock data for static deployment
const mockBlockData = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  timestamp: new Date(Date.now() - i * 3600000).toISOString(),
  hash: `0x${Math.random().toString(16).substring(2)}`,
  minerAddress: `0x${Math.random().toString(16).substring(2)}`,
  reward: Math.floor(Math.random() * 100),
  travelDistance: Math.random() * 10,
}));

const mockStatusData = {
  totalRewards: 15780.45,
  minerCount: 1234,
  lastUpdate: new Date().toISOString(),
};

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-background text-text-primary">
      {/* Header */}
      <nav className="bg-card/80 border-b-4 border-white/10 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="h-14 flex items-center">
            <h1 className="text-lg font-bold">Blocks Overview</h1>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/80 p-[4px] relative rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
            <div className="relative bg-card/95 rounded-lg p-4">
              <CardHeader>
                <CardTitle className="text-text-primary">Competition Status</CardTitle>
              </CardHeader>
              <CardContent>
                <CompetitionStatus />
              </CardContent>
            </div>
          </Card>

          <Card className="bg-card/80 p-[4px] relative rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
            <div className="relative bg-card/95 rounded-lg p-4">
              <CardHeader>
                <CardTitle className="text-text-primary">Network Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-text-secondary">Total Rewards</div>
                    <div className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                      {mockStatusData.totalRewards.toFixed(2)} iMERA
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">Active Miners</div>
                    <div className="text-2xl font-bold">{mockStatusData.minerCount}</div>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>

          <Card className="bg-card/80 p-[4px] relative rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
            <div className="relative bg-card/95 rounded-lg p-4">
              <CardHeader>
                <CardTitle className="text-text-primary">Your Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <PlayerStats />
              </CardContent>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left column - Charts */}
          <div className="lg:col-span-8">
            <Card className="bg-card/80 p-[4px] relative rounded-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
              <div className="relative bg-card/95 rounded-lg p-4">
                <CardHeader>
                  <CardTitle className="text-text-primary">Mining History</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <DistanceChart data={mockBlockData} />
                </CardContent>
              </div>
            </Card>

            <Card className="bg-card/80 p-[4px] relative rounded-xl overflow-hidden mt-4">
              <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
              <div className="relative bg-card/95 rounded-lg p-4">
                <CardHeader>
                  <CardTitle className="text-text-primary">Recent Blocks</CardTitle>
                </CardHeader>
                <CardContent>
                  <BlockList blocks={mockBlockData} />
                </CardContent>
              </div>
            </Card>
          </div>

          {/* Right column - Leaderboard */}
          <div className="lg:col-span-4">
            <Leaderboard />
          </div>
        </div>
      </div>
    </div>
  );
}