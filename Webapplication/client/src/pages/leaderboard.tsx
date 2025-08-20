import { Leaderboard as LeaderboardComponent } from "@/components/leaderboard/leaderboard";
import { Header } from "@/components/layout/header";

export default function Leaderboard() {
  return (
    <div className="min-h-screen bg-[#09060e] text-white">
      <Header title="Leader board" />

      {/* Main scrollable area with proper padding for header and navigation */}
      <main className="pt-[54px] pb-[80px] min-h-screen">
        <div className="container mx-auto px-4 py-6">
          <LeaderboardComponent />
        </div>
      </main>
    </div>
  );
}