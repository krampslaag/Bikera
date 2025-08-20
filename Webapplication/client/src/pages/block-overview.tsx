import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, ArrowUpLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocation } from "wouter";

// Sample data for countries and cities
const countryData = {
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"],
  "China": ["Beijing", "Shanghai", "Shenzhen", "Guangzhou", "Hangzhou"],
  "Japan": ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Fukuoka"],
  "Germany": ["Berlin", "Hamburg", "Munich", "Frankfurt", "Cologne"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Leeds", "Liverpool"]
};

interface BlockStats {
  blocksMined: number;
  distanceTravelled: number;
  earnings: number;
  participated: number;
}

export default function BlockOverview() {
  const [_, navigate] = useLocation();

  // Mock data - replace with API call later
  const stats: BlockStats = {
    blocksMined: 34,
    distanceTravelled: 3.5,
    earnings: 56,
    participated: 10
  };

  return (
    <div className="w-full min-h-screen bg-[#09060e] overflow-hidden pt-[105px]">
      <Header title="Block Overview" />

      {/* Stats Cards */}
      <div className="flex gap-2 px-4">
        {/* Blocks Mined Card */}
        <Card className="w-[168px] h-14 p-[4px] bg-slate-900 rounded-[14px] relative overflow-hidden shadow-[inset_0px_0px_4px_3px_rgba(255,62,255,0.21)] shadow-[inset_0px_-2px_4px_1px_rgba(71,186,239,0.40)] border-2 border-white/10">
          <div className="flex items-center gap-[11px] z-10 relative">
            <div className="p-2.5 bg-[#1a2641] rounded-[14px] flex items-center">
              <div className="w-[26px] h-[26px] bg-[#414D6A]" />
            </div>
            <div className="flex-col gap-[3px]">
              <div className="text-[#c0cae1] text-base font-semibold">{stats.blocksMined}</div>
              <div className="text-[#848da2] text-xs">Block Mined</div>
            </div>
          </div>
          <div className="absolute w-[111px] h-14 bg-gradient-to-bl from-[#ff3eff] to-[#41beee] rounded-full blur-[34px]" />
        </Card>

        {/* Distance Card */}
        <Card className="w-[168px] h-14 p-[4px] bg-slate-900 rounded-[14px] relative overflow-hidden shadow-[inset_0px_0px_4px_3px_rgba(255,62,255,0.21)] shadow-[inset_0px_-2px_4px_1px_rgba(71,186,239,0.40)] border-2 border-white/10">
          <div className="flex items-center gap-[11px] z-10 relative">
            <div className="p-2.5 bg-[#1a2641] rounded-[14px] flex items-center">
              <div className="w-[26px] h-[26px] bg-[#414D6A]" />
            </div>
            <div className="flex-col gap-[3px]">
              <div className="text-[#c0cae1] text-base font-semibold">{stats.distanceTravelled} km</div>
              <div className="text-[#848da2] text-xs">Distance Travelled</div>
            </div>
          </div>
          <div className="absolute w-[111px] h-14 bg-gradient-to-bl from-[#ff3eff] to-[#41beee] rounded-full blur-[34px]" />
        </Card>
      </div>

      {/* NFT Display Card */}
      <div className="px-4 mt-4">
        <Card className="w-full bg-slate-900 rounded-3xl p-[4px] relative overflow-hidden shadow-[inset_0px_0px_4px_3px_rgba(255,62,255,0.21)] shadow-[inset_0px_-2px_4px_1px_rgba(71,186,239,0.40)] border-2 border-white/10">
          <div className="relative bg-slate-900/95 rounded-[22px] overflow-hidden">
            <div className="absolute top-4 left-4 z-10">
              <Button
                variant="ghost"
                className="p-1.5 bg-[#1a2641] hover:bg-[#FF3EFF] hover:text-slate-900 transition-colors duration-200 active:bg-[#41BEEE]"
              >
                <ArrowUpLeft className="h-6 w-6" />
              </Button>
            </div>

            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="ghost"
                className="p-1.5 bg-[#1a2641] hover:bg-[#FF3EFF] hover:text-slate-900 transition-colors duration-200 active:bg-[#41BEEE]"
                onClick={() => navigate('/settings')}
              >
                <Settings className="h-6 w-6" />
              </Button>
            </div>

            <div className="pt-4 text-center">
              <span className="text-[#ff3eff] text-[13px] font-bold uppercase">
                Mera NFT #23
              </span>
            </div>

            {/* Center Image */}
            <div className="w-[282px] h-[282px] mx-auto mt-4 bg-[#1a2641] rounded-lg" />

            {/* Stats Grid */}
            <div className="w-[273px] mx-auto mt-8 flex justify-between items-center">
              <div className="flex-col gap-1.5">
                <div className="text-[#c0cae1] text-[19px] font-bold">${stats.earnings}</div>
                <div className="text-[#848da2] text-xs">Earned</div>
              </div>
              <div className="flex-col gap-1.5">
                <div className="text-[#c0cae1] text-[19px] font-bold">{stats.participated}</div>
                <div className="text-[#848da2] text-xs">Participated</div>
              </div>
              <div className="flex-col gap-1.5">
                <div className="text-[#c0cae1] text-[19px] font-bold">{stats.distanceTravelled} km</div>
                <div className="text-[#848da2] text-xs">Distance Travelled</div>
              </div>
            </div>

            {/* Time Period Filters */}
            <div className="flex gap-1 justify-center mt-6">
              {["1m", "10m", "100m"].map((period) => (
                <Button
                  key={period}
                  variant="outline"
                  size="sm"
                  className="p-2 bg-[#1a2641] text-[#41beee] border-[#848da2]/10 hover:bg-[#FF3EFF] hover:text-slate-900 transition-colors duration-200 active:bg-[#41BEEE]"
                >
                  {period}
                </Button>
              ))}
            </div>

            {/* Boost Button */}
            <div className="p-4">
              <Button
                className="w-full h-12 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold uppercase hover:opacity-90 transition-opacity duration-200 active:opacity-100"
              >
                Boost
              </Button>
            </div>

            {/* Location Selectors */}
            <div className="px-4 pb-4">
              <div className="w-full h-[58px] px-10 py-[13px] bg-slate-900/95 backdrop-blur-md rounded-[10px] flex items-center justify-center relative overflow-hidden">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-10" />

                <div className="flex justify-between items-center w-full max-w-md gap-4 relative z-10">
                  {/* Country Selector */}
                  <Select>
                    <SelectTrigger className="relative w-[160px] overflow-hidden rounded-md">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ff3eff] to-[#41beee] opacity-100" />
                      <div className="relative z-10 text-slate-900 font-semibold">
                        <SelectValue placeholder="Select Country" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2641] border-[#848da2]/10">
                      {Object.keys(countryData).map((country) => (
                        <SelectItem
                          key={country}
                          value={country}
                          className="text-[#41beee] hover:bg-[#FF3EFF] hover:text-slate-900"
                        >
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* City Selector */}
                  <Select>
                    <SelectTrigger className="relative w-[160px] overflow-hidden rounded-md">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ff3eff] to-[#41beee] opacity-100" />
                      <div className="relative z-10 text-slate-900 font-semibold">
                        <SelectValue placeholder="Select City" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2641] border-[#848da2]/10">
                      {/* This will be populated based on the selected country */}
                      <SelectItem
                        value="placeholder"
                        className="text-[#41beee] hover:bg-[#FF3EFF] hover:text-slate-900"
                      >
                        Select a country first
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Gradient glow effect */}
                <div className="absolute inset-0 bg-gradient-to-bl from-[#ff3eff] to-[#41beee] opacity-10 rounded-[10px] blur-[24px] -z-10" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}