import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaderboardCard } from "./leaderboard-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@/types/user";

// Mock data for static deployment
const mockLeaderboardData: User[] = [
  {
    id: 1,
    username: "CryptoMiner2025",
    distance: 156.7,
    earnings: 2890.45,
    avatarUrl: "/assets/avatars/miner1.svg",
    blocksMined: 145,
    rank: 1
  },
  {
    id: 2,
    username: "BlockchainPro",
    distance: 142.3,
    earnings: 2456.78,
    avatarUrl: "/assets/avatars/miner2.svg",
    blocksMined: 132,
    rank: 2
  },
  {
    id: 3,
    username: "MiningMaster",
    distance: 138.9,
    earnings: 2234.56,
    avatarUrl: "/assets/avatars/miner3.svg",
    blocksMined: 128,
    rank: 3
  },
  {
    id: 4,
    username: "HashPower",
    distance: 125.4,
    earnings: 1987.23,
    avatarUrl: "/assets/avatars/miner4.svg",
    blocksMined: 115,
    rank: 4
  },
  {
    id: 5,
    username: "BlockExplorer",
    distance: 118.2,
    earnings: 1876.45,
    avatarUrl: "/assets/avatars/miner5.svg",
    blocksMined: 108,
    rank: 5
  },
  {
    id: 6,
    username: "Blocplorer",
    distance: 148.2,
    earnings: 12346.45,
    avatarUrl: "/assets/avatars/miner5.svg",
    blocksMined: 108,
    rank: 6
  },
  {
    id: 7,
    username: "Droplom",
    distance: 123.2,
    earnings: 336.45,
    avatarUrl: "/assets/avatars/miner5.svg",
    blocksMined: 108,
    rank: 7
  },
  {
    id: 8,
    username: "Amazoner",
    distance: 118.2,
    earnings: 276.45,
    avatarUrl: "/assets/avatars/miner5.svg",
    blocksMined: 108,
    rank: 8
  },
  {
    id: 9,
    username: "Greater",
    distance: 98.2,
    earnings: 176.75,
    avatarUrl: "/assets/avatars/miner5.svg",
    blocksMined: 108,
    rank: 9
  },
  {
    id: 10,
    username: "Alltimehigh",
    distance: 88.8,
    earnings: 146.65,
    avatarUrl: "/assets/avatars/miner5.svg",
    blocksMined: 108,
    rank: 10
  }
];

// Sample data for countries and cities
const countryData = {
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"],
  "China": ["Beijing", "Shanghai", "Shenzhen", "Guangzhou", "Hangzhou"],
  "Japan": ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Fukuoka"],
  "Germany": ["Berlin", "Hamburg", "Munich", "Frankfurt", "Cologne"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Leeds", "Liverpool"]
};

export function Leaderboard() {
  // Sort users by blocks mined
  const sortedUsers = [...mockLeaderboardData].sort((a, b) => b.blocksMined - a.blocksMined);

  return (
    <div className="space-y-4 mb-24">
      {/* Location Selectors */}
      <div className="w-full h-[58px] px-10 py-[13px] bg-[#09060e]/95 backdrop-blur-md rounded-[10px] flex items-center justify-center relative overflow-hidden mb-4">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-10" />

        <div className="flex justify-between items-center w-full max-w-md gap-4 relative z-10">
          {/* Country Selector */}
          <Select>
            <SelectTrigger className="relative w-[160px] h-10 text-slate-900 font-bold border-[#848da2]/10 hover:opacity-90 transition-opacity duration-200 active:opacity-100 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#ff3eff] to-[#41beee]" />
              <div className="relative z-10">
                <SelectValue placeholder="Country" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#1a2641] border-[#848da2]/10">
              {Object.keys(countryData).map((country) => (
                <SelectItem key={country} value={country} className="text-[#41beee] hover:bg-[#FF3EFF] hover:text-slate-900">
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* City Selector */}
          <Select>
            <SelectTrigger className="relative w-[160px] h-10 text-slate-900 font-bold border-[#848da2]/10 hover:opacity-90 transition-opacity duration-200 active:opacity-100 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#ff3eff] to-[#41beee]" />
              <div className="relative z-10">
                <SelectValue placeholder="City" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#1a2641] border-[#848da2]/10">
              {/* This will be populated based on the selected country */}
              <SelectItem value="placeholder" className="text-[#41beee] hover:bg-[#FF3EFF] hover:text-slate-900">
                Select a country first
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Gradient glow effect */}
        <div className="absolute inset-0 bg-gradient-to-bl from-[#ff3eff] to-[#41beee] opacity-10 rounded-[10px] blur-[24px] -z-10" />
      </div>

      <Card className="bg-[#09060e] p-[4px] relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
        <div className="relative bg-[#09060e]/95 rounded-lg">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-text-primary">Mining Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-2">
              {sortedUsers.map((user) => (
                <LeaderboardCard key={user.id} user={user} rank={user.rank} />
              ))}
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}