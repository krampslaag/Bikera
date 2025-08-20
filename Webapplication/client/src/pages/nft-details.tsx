import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, ArrowUpLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocation } from "wouter";

export default function NFTDetails() {
  const [_, navigate] = useLocation();

  return (
    <div className="w-full min-h-screen bg-[#09060e] overflow-hidden pt-[54px]">
      <Header title="Level" />

      {/* Stats Cards */}
      <div className="flex gap-2 px-4">
        {/* Blocks Mined Card */}
        <div className="w-[168px] p-[4px] relative rounded-xl overflow-hidden bg-card/80">
          <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
          <div className="relative bg-card/95 rounded-lg p-4 h-14">
            <div className="flex items-center gap-[11px]">
              <div className="p-2.5 bg-[#1a2641] rounded-[14px] flex items-center">
                <div className="w-[26px] h-[26px] rotate-180 bg-[#414D6A]" />
              </div>
              <div className="flex-col gap-[3px]">
                <div className="text-[#c0cae1] text-base font-semibold">34</div>
                <div className="text-[#848da2] text-xs">Block Mined</div>
              </div>
            </div>
          </div>
        </div>

        {/* Distance Card */}
        <div className="w-[168px] p-[4px] relative rounded-xl overflow-hidden bg-card/80">
          <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
          <div className="relative bg-card/95 rounded-lg p-4 h-14">
            <div className="flex items-center gap-[11px]">
              <div className="p-2.5 bg-[#1a2641] rounded-[14px] flex items-center">
                <div className="w-[26px] h-[26px] bg-[#414D6A]" />
              </div>
              <div className="flex-col gap-[3px]">
                <div className="text-[#c0cae1] text-base font-semibold">3.5 km</div>
                <div className="text-[#848da2] text-xs">Distance Travelled</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NFT Display Card */}
      <div className="px-4 mt-4">
        <div className="w-full p-[4px] relative rounded-xl overflow-hidden bg-card/80">
          <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
          <div className="relative bg-card/95 rounded-lg p-4">
            <div className="relative bg-[#1a2641]/50 rounded-lg overflow-hidden p-4">
              <div className="absolute top-4 left-4 z-10">
                <Button 
                  variant="ghost" 
                  className="p-1.5 bg-[#1a2641] hover:bg-[#FF3EFF] hover:text-slate-900 transition-colors duration-200 active:bg-[#41BEEE]"
                  onClick={() => window.history.back()}
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
                  <div className="text-[#c0cae1] text-[19px] font-bold">$56</div>
                  <div className="text-[#848da2] text-xs">Earned</div>
                </div>
                <div className="flex-col gap-1.5">
                  <div className="text-[#c0cae1] text-[19px] font-bold">10</div>
                  <div className="text-[#848da2] text-xs">Participated</div>
                </div>
                <div className="flex-col gap-1.5">
                  <div className="text-[#c0cae1] text-[19px] font-bold">3.5 km</div>
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
                <Button className="w-full h-12 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold uppercase hover:opacity-90 transition-opacity duration-200 active:opacity-100">
                  Boost
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}