import { Button } from "@/components/ui/button";
import { Settings, User } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Image } from "@/components/ui/image";
import { useUser } from "@/context/UserContext";

export default function Active() {
  const [selectedPeriod, setSelectedPeriod] = useState<Uint8Array>(
    new Uint8Array([1]),
  );
  const [_, navigate] = useLocation();
  const [isMining, setIsMining] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const { username } = useUser();

  // Mock function for Solana RPC verification
  const verifyBlockConditions = async () => {
    // In a real implementation, this would make an RPC call to Solana
    // For static demo, we'll assume conditions are met
    return true;
  };

  const handleClaim = async () => {
    if (cooldownEnd && Date.now() < cooldownEnd) {
      return; // Still in cooldown
    }

    const canClaim = await verifyBlockConditions();
    if (canClaim) {
      setIsClaimed(true);
      setCooldownEnd(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      localStorage.setItem(
        "claimCooldownEnd",
        (Date.now() + 24 * 60 * 60 * 1000).toString(),
      );
    }
  };

  // Load saved cooldown from localStorage
  useEffect(() => {
    const savedCooldown = localStorage.getItem("claimCooldownEnd");
    if (savedCooldown) {
      const cooldownTime = parseInt(savedCooldown);
      if (Date.now() < cooldownTime) {
        setCooldownEnd(cooldownTime);
      }
    }
  }, []);

  // Update timer display
  useEffect(() => {
    const interval = setInterval(() => {
      if (cooldownEnd) {
        const now = Date.now();
        if (now >= cooldownEnd) {
          setTimeLeft("");
          setCooldownEnd(null);
          setIsClaimed(false);
          localStorage.removeItem("claimCooldownEnd");
        } else {
          const diff = cooldownEnd - now;
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownEnd]);

  var currentLevel = 1;
  var currentXP = 3500;
  var nextLevelXP = 5000;
  var currentiMERA = 12000;
  var distanceLogged = 3.5;
  var distanceBlock = 5.5;
  var Participants = 3;
  var blockHeight = 2367;

  return (
    <div className="w-full min-h-screen bg-[#04060f] overflow-hidden pt-[54px] pb-20">
      <Header title={`Level # ${currentLevel}`} />
      {/* Stats Cards with Claim Button */}
      <div className="px-4 mt-4 relative">
        <div className="flex items-center">
          {/* Blocks Mined Card */}
          <div className="w-[60%] p-[4px] relative rounded-xl overflow-hidden bg-card/80">
            <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
            <div className="relative bg-card/95 rounded-lg h-[60px] flex items-center">
              <div className="flex items-center justify-between w-full px-4">
                <div className="p-2 bg-[#09060e] rounded-[14px] flex items-center justify-center">
                  <Image
                    src="./images/iMERA_TOKEN.png"
                    alt="iMERA Token"
                    className="h-9 w-9"
                    fallbackSrc="./images/fallback.svg"
                  />
                </div>
                <div className="flex flex-col justify-center items-end">
                  <div className="text-[#c0cae1] text-[22px] font-semibold leading-tight">
                    {currentiMERA}
                  </div>
                  <div className="text-[#848da2] text-xs leading-tight">
                    iMERA
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Claim Button */}
          <div className="absolute -right-[2%]">
            <Button
              onClick={handleClaim}
              disabled={!!cooldownEnd}
              className={`w-[140px] h-12 text-left pl-4 font-bold uppercase transition-all duration-200 ${
                isClaimed
                  ? "bg-[#1a2641] text-[#414D6A]"
                  : "bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900"
              }`}
            >
              {cooldownEnd ? timeLeft : "claim"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Display Card */}
      <div className="px-4 mt-3">
        <div className="w-full p-[4px] relative rounded-xl overflow-hidden bg-/80">
          <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
          <div className="relative bg-card/95 rounded-lg p-4">
            <div className="flex items-center justify-center gap-2">
              <span className="text-white text-xl">Block </span>
              <span className="text-[20px] gradient-text">{blockHeight}</span>
            </div>
            <div className="relative bg-[#09060e]/50 rounded-lg overflow-hidden p-3">
              {/* Profile Button */}
              <div className="absolute top-3 left-3 z-10">
                <Button
                  variant="ghost"
                  className="p-1.5 bg-[#1a2641] hover:bg-[#FF3EFF] hover:text-slate-900 transition-colors duration-200 active:bg-[#41BEEE]"
                  onClick={() => navigate("/profile")}
                >
                  <User className="h-5 w-5" />
                </Button>
              </div>

              {/* Settings Button */}
              <div className="absolute top-3 right-3 z-10">
                <Button
                  variant="ghost"
                  className="p-1.5 bg-[#1a2641] hover:bg-[#FF3EFF] hover:text-slate-900 transition-colors duration-200 active:bg-[#41BEEE]"
                  onClick={() => navigate("/profile")}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>

              <div className="pt-2 text-center">
                <span className="text-[#ff3eff] text-[13px] font-bold uppercase">
                  {username || "Crypto Miner"}
                </span>
              </div>

              {/* Center Image */}
              <div className="w-[220px] h-[220px] mx-auto mt-3 bg-[#1a2641] rounded-lg" />

              {/* Stats Grid */}
              <div className="w-[220px] mx-auto mt-4 flex justify-between items-center">
                <div className="flex-col gap-1">
                  <div className="text-[#c0cae1] text-[17px] font-bold">
                    {Participants}
                  </div>
                  <div className="text-[#848da2] text-xs">Participants</div>
                </div>
                <div className="flex-col gap-1">
                  <div className="text-[#c0cae1] text-[17px] font-bold">
                    {distanceBlock} km
                  </div>
                  <div className="text-[#848da2] text-xs">Distance</div>
                </div>
              </div>

              {/* Time Period Filters */}
              <div className="flex gap-1 justify-center mt-3">
                {["2 min", "5 min", "10 min"].map((period) => (
                  <Button
                    key={period}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      let newSelectedPeriod = new Uint8Array([0]);
                      if (period === "2 min")
                        newSelectedPeriod = new Uint8Array([1]);
                      else if (period === "5 min")
                        newSelectedPeriod = new Uint8Array([2]);
                      else if (period === "10 min")
                        newSelectedPeriod = new Uint8Array([3]);
                      setSelectedPeriod(newSelectedPeriod);
                    }}
                    className={`p-1.5 border-[#848da2]/10 transition-all duration-200 rounded-md overflow-hidden ${
                      (selectedPeriod[0] === 1 && period === "2 min") ||
                      (selectedPeriod[0] === 2 && period === "5 min") ||
                      (selectedPeriod[0] === 3 && period === "10 min")
                        ? "before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-[#ff3eff] before:to-[#41beee] text-slate-900 relative z-0 before:z-[-1]"
                        : "bg-[#1a2641] text-[#41beee] hover:bg-[#FF3EFF] hover:text-slate-900"
                    } transition-all duration-200 border-[#848da2]/10`}
                  >
                    <span className="relative z-10">{period}</span>
                  </Button>
                ))}
              </div>

              {/* Boost Button */}
              <div className="p-3">
                <Button
                  onClick={() => setIsMining(!isMining)}
                  className="w-full h-10 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold uppercase hover:opacity-90 transition-opacity duration-200 active:opacity-100 flex items-center justify-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="20"
                    viewBox="0 0 14 17"
                    fill="none"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M11.9503 2.10356C10.6375 0.756674 8.85693 -1.41918e-08 7.00033 0C5.14372 1.41918e-08 3.36316 0.756674 2.05035 2.10356C0.737532 3.45045 1.38328e-08 5.27722 0 7.18201C-1.38328e-08 9.0868 0.737532 10.9136 2.05035 12.2605L6.43651 16.7604C6.58606 16.9138 6.78886 17 7.00033 17C7.21179 17 7.4146 16.9138 7.56415 16.7604L11.9503 12.2605C13.2627 10.9134 14 9.08666 14 7.18201C14 5.27735 13.2627 3.45066 11.9503 2.10356ZM5.8041 7.18201C5.8041 6.85652 5.93013 6.54435 6.15447 6.3142C6.3788 6.08404 6.68307 5.95474 7.00033 5.95474H7.0083C7.32556 5.95474 7.62983 6.08404 7.85416 6.3142C8.0785 6.54435 8.20453 6.85652 8.20453 7.18201V7.19019C8.20453 7.51568 8.0785 7.82784 7.85416 8.058C7.62983 8.28816 7.32556 8.41746 7.0083 8.41746H7.00033C6.68307 8.41746 6.3788 8.28816 6.15447 8.058C5.93013 7.82784 5.8041 7.51568 5.8041 7.19019V7.18201Z"
                      fill="#191919"
                    />
                  </svg>
                  {isMining ? "stop mining" : "start mining"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}