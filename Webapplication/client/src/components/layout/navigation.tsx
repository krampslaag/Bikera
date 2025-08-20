import { Link, useLocation } from "wouter";
import { Award, Bike, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const [location] = useLocation();

  // Hide navigation on dashboard page
  if (location === '/dashboard') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-4 bg-gradient-to-t from-[#09060e] via-[#09060e] to-transparent">
      <div className="mx-4">
        <div className="w-full h-[58px] px-10 py-[13px] bg-slate-900/95 backdrop-blur-md rounded-[10px] flex items-center justify-center">
          <div className="flex justify-between items-center w-full max-w-md">
            <Link href="/leaderboard">
              <Button
                variant="ghost"
                className={`w-12 h-12 p-0 ${
                  location === '/leaderboard' 
                    ? 'text-[#41BEEE] [box-shadow:0_0_15px_rgba(255,62,255,0.5)]' 
                    : 'text-[#414D6A]'
                } hover:bg-[#FF3EFF] hover:text-slate-900 transition-all duration-200 active:bg-[#41BEEE]`}
              >
                <Award className="w-9 h-9" />
                <span className="sr-only">Leaderboard</span>
              </Button>
            </Link>

            <Link href="/active">
              <Button
                variant="ghost"
                className={`w-12 h-12 p-0 ${
                  location === '/active' 
                    ? 'text-[#41BEEE] [box-shadow:0_0_15px_rgba(255,62,255,0.5)]' 
                    : 'text-[#414D6A]'
                } hover:bg-[#FF3EFF] hover:text-slate-900 transition-all duration-200 active:bg-[#41BEEE]`}
              >
                <Bike className="w-9 h-9" />
                <span className="sr-only">Active</span>
              </Button>
            </Link>

            <Link href="/map">
              <Button
                variant="ghost"
                className={`w-12 h-12 p-0 ${
                  location === '/map' 
                    ? 'text-[#41BEEE] [box-shadow:0_0_15px_rgba(255,62,255,0.5)]' 
                    : 'text-[#414D6A]'
                } hover:bg-[#FF3EFF] hover:text-slate-900 transition-all duration-200 active:bg-[#41BEEE]`}
              >
                <Globe className="w-9 h-9" />
                <span className="sr-only">Map</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Gradient blur effect */}
        <div className="absolute inset-0 bg-gradient-to-bl from-[#ff3eff] to-[#41beee] opacity-10 rounded-[10px] blur-[24px] -z-10" />
      </div>
    </nav>
  );
}