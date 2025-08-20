import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Miner {
  id: string;
  name: string;
  location: string;
  hashRate: string;
  timestamp: number;
}

interface MiningPopupsProps {
  miners: Miner[];
}

export function MiningPopups({ miners }: MiningPopupsProps) {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {miners.slice(0, 5).map((miner, index) => (
          <motion.div
            key={miner.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ 
              opacity: 0,
              y: index === 4 ? 50 : 0, // Move the 5th miner down while fading out
              transition: { 
                duration: index === 4 ? 1.0 : 0.3, // 1 second fade out duration for the 5th card
                delay: index === 4 ? 0.3 : 0 // Delay fade out of bottom card until others have moved
              }
            }}
            transition={{ 
              duration: 0.3,
              type: "spring",
              stiffness: 500,
              damping: 30
            }}
            className="relative"
          >
            <div className="relative">
              {/* Main card */}
              <div className="w-full bg-card rounded-xl overflow-hidden">
                <Card className="border-0 bg-transparent">
                  <div className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-white">{miner.name}</h3>
                        <p className="text-sm text-[#414D6A]">{miner.location}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#41BEEE]">{miner.hashRate}</p>
                        <p className="text-sm text-[#414D6A]">Hash Rate</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              {/* Gradient border effect */}
              <div className="absolute inset-0 rounded-xl border border-transparent bg-gradient-to-r from-[#ff3eff] to-[#41beee] mask-gradient" />
              {/* Inner border */}
              <div className="absolute inset-[4px] rounded-xl bg-card" />
              {/* Inner content */}
              <div className="absolute inset-[6px] rounded-xl overflow-hidden">
                <Card className="border-0 bg-transparent">
                  <div className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-white">{miner.name}</h3>
                        <p className="text-sm text-[#414D6A]">{miner.location}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#41BEEE]">{miner.hashRate}</p>
                        <p className="text-sm text-[#414D6A]">Hash Rate</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              {/* Gradient glow effect */}
              <div className="absolute inset-0 bg-gradient-to-bl from-[#ff3eff] to-[#41beee] opacity-10 rounded-xl blur-[24px] -z-10" />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}