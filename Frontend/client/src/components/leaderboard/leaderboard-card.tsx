import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { User } from "@/types/user";

interface LeaderboardCardProps {
  user: User;
  rank: number;
}

export function LeaderboardCard({ user, rank }: LeaderboardCardProps) {
  return (
    <div className="w-full p-[4px] relative rounded-xl overflow-hidden bg-card/80">
      <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
      <div className="relative bg-card/95 rounded-lg p-6 w-full">
        <div className="absolute top-4 left-4 text-[#41BEEE] text-2xl font-bold">
          #{rank}
        </div>
        <div className="flex items-center gap-6 w-full">
          <div className="p-2 bg-[#1a2231] rounded-[10px]">
            <Avatar className="h-10 w-10 rounded" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[#c0cae1] text-lg font-semibold truncate">
              {user.username}
            </div>
            <div className="flex items-center gap-6 text-sm text-[#848da2] mt-1">
              <div>Distance: {user.distance.toFixed(1)}km</div>
              <div>Earned: {user.earnings.toFixed(2)} iMERA</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}