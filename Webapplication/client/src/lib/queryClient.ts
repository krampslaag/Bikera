import { QueryClient } from "@tanstack/react-query";
import type { User } from "@/types/user";

// Mock data for static deployment
const mockUsers: User[] = [
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
  // Add more mock users for a better populated leaderboard
  {
    id: 3,
    username: "HashMaster",
    distance: 138.5,
    earnings: 2234.56,
    avatarUrl: "/assets/avatars/miner3.svg",
    blocksMined: 128,
    rank: 3
  },
  {
    id: 4,
    username: "CryptoNinja",
    distance: 125.8,
    earnings: 1987.34,
    avatarUrl: "/assets/avatars/miner4.svg",
    blocksMined: 115,
    rank: 4
  }
];

const mockActivities = [
  {
    type: "Block Mined",
    data: "Mined block #12345",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    type: "Achievement Earned",
    data: "First 100 Blocks",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    type: "Distance Record",
    data: "Reached 150km milestone",
    createdAt: new Date(Date.now() - 10800000).toISOString(),
  }
];

// Extended mock data for static deployment
const mockData: Record<string, any> = {
  "/api/users": mockUsers,
  "/api/status": {
    totalRewards: 15780.45,
    minerCount: 1234,
    lastUpdate: new Date().toISOString(),
    networkHealth: "Excellent",
    blockTime: "2.5 minutes",
    difficulty: "Medium"
  },
  "/api/leaderboard": mockUsers,
  "/api/miners/distribution": [
    { country: "US", count: 850 },
    { country: "CN", count: 1200 },
    { country: "RU", count: 600 },
    { country: "IN", count: 400 },
    { country: "BR", count: 250 },
    { country: "DE", count: 180 },
    { country: "JP", count: 220 },
    { country: "KR", count: 190 }
  ],
  "/api/mining/stats": {
    dailyBlocks: 576,
    avgBlockReward: 6.25,
    networkHashrate: "140 EH/s",
    activeMiners: 1234
  }
};

// Add dynamic route handling for user profiles and activities
const dynamicRouteHandlers = {
  userProfile: (username: string) => {
    const user = mockUsers.find(u => u.username === username);
    if (!user) return null;
    return {
      ...user,
      followerCount: 123,
      followingCount: 45,
      isFollowing: false,
      bio: "Passionate blockchain miner and crypto enthusiast",
      achievements: [
        "100 Blocks Mined",
        "Distance Champion",
        "Early Adopter"
      ]
    };
  },
  userActivities: (username: string) => {
    return mockActivities;
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        // Simulate network delay for development
        if (import.meta.env.DEV) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const path = queryKey[0] as string;

        // Handle dynamic routes
        if (path.startsWith('/api/users/')) {
          const parts = path.split('/');
          const username = parts[3];
          const subPath = parts[4];

          if (subPath === 'activities') {
            return dynamicRouteHandlers.userActivities(username);
          }
          return dynamicRouteHandlers.userProfile(username);
        }

        const mockResponse = mockData[path];
        if (!mockResponse) {
          throw new Error(`No mock data available for ${path}`);
        }

        return mockResponse;
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    }
  },
});