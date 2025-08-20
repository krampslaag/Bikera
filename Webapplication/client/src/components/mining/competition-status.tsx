import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

// Mock data for static deployment
const mockCompetition = {
  isActive: true,
  timeRemaining: 300, // 5 minutes in seconds
  targetDistance: 5.5,
  participants: 128,
};

export function CompetitionStatus() {
  const [timeLeft, setTimeLeft] = useState(mockCompetition.timeRemaining);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!mockCompetition.isActive) {
    return <div className="text-muted-foreground">No active mining competition</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Time Remaining</div>
          <div className="text-2xl font-bold">{Math.ceil(timeLeft)}s</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Target Distance</div>
          <div className="text-2xl font-bold">{mockCompetition.targetDistance.toFixed(2)} km</div>
        </div>
      </div>

      <Progress value={(timeLeft / mockCompetition.timeRemaining) * 100} />

      <div>
        <div className="text-sm text-muted-foreground">Participants</div>
        <div className="text-2xl font-bold">{mockCompetition.participants}</div>
      </div>
    </div>
  );
}