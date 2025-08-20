import WorldMapChart from "@/components/charts/WorldMapChart";
import { Navigation } from "@/components/layout/navigation";
import { Header } from "@/components/layout/header";
import { MiningPopups } from "@/components/mining/mining-popups";
import { useState, useEffect } from "react";
import "leaflet/dist/leaflet.css";

// Sample mining locations data with properly typed coordinates
const sampleLocations = [
  {
    coordinates: [-122.4194, 37.7749] as [number, number], // San Francisco
    name: "San Francisco Mining Hub",
    minerCount: 150,
    hashRate: "45 PH/s"
  },
  {
    coordinates: [151.2093, -33.8688] as [number, number], // Sydney
    name: "Sydney Mining Center",
    minerCount: 89,
    hashRate: "28 PH/s"
  },
  {
    coordinates: [2.3522, 48.8566] as [number, number], // Paris
    name: "Paris Mining Facility",
    minerCount: 120,
    hashRate: "37 PH/s"
  }
];

// Sample miners data
const initialMiners = [
  { id: '1', name: 'Miner Alpha', location: 'San Francisco, USA', hashRate: '125 TH/s', timestamp: Date.now() - 3000 },
  { id: '2', name: 'Miner Beta', location: 'Sydney, Australia', hashRate: '98 TH/s', timestamp: Date.now() - 2000 },
];

export default function Map() {
  const [miners, setMiners] = useState(initialMiners);

  // Simulate new miners being added
  useEffect(() => {
    const interval = setInterval(() => {
      const newMiner = {
        id: Date.now().toString(),
        name: `Miner ${Math.floor(Math.random() * 1000)}`,
        location: 'New Location',
        hashRate: `${Math.floor(Math.random() * 200)} TH/s`,
        timestamp: Date.now(),
      };
      setMiners(prev => [newMiner, ...prev]); // Add new miner, keeping previous ones for animation
    }, 5000); // Add new miner every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#09060e]">
      <Header title="World Map" />
      <main className="container mx-auto px-4 pt-20 pb-24">
        <div className="relative">
          <div className="w-full p-[4px] relative rounded-xl overflow-hidden bg-card/80">
            <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
            <div className="relative bg-card/95 rounded-lg p-6 w-full h-[270px]">
              <WorldMapChart miningLocations={sampleLocations} />
              <div className="absolute inset-0 bg-gradient-to-bl from-[#ff3eff] to-[#41beee] opacity-10 blur-[24px] -z-10" />
            </div>
          </div>
        </div>

        {/* Mining Popups Section */}
        <div className="mt-4">
          <MiningPopups miners={miners} />
        </div>
      </main>
      <Navigation />
    </div>
  );
}