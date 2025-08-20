import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { watch } from "fs";
import { mkdirSync, existsSync } from "fs";
import path from "path";

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: "/ws",
    // Handle protocols explicitly with proper typing
    handleProtocols: (protocols: Set<string>) => {
      // Convert Set to Array for includes check
      const protocolArray = Array.from(protocols);

      // Always reject Vite HMR connections
      if (protocolArray.includes("vite-hmr")) {
        return false;
      }

      // Return first protocol or null if none exists
      return protocolArray[0] || null;
    }
  });

  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Create initial CSV files if they don't exist
  const blocksFile = path.join(dataDir, "Blocks.csv");
  const rewardsFile = path.join(dataDir, "mining_rewards.csv");

  if (!existsSync(blocksFile)) {
    const blocksHeader = "Block Number,Timestamp,Target Distance,Winner ID,Travel Distance,Miner Address,Block Hash\n";
    require('fs').writeFileSync(blocksFile, blocksHeader);
  }

  if (!existsSync(rewardsFile)) {
    const rewardsHeader = "Miner Address,Total Rewards\n";
    require('fs').writeFileSync(rewardsFile, rewardsHeader);
  }

  // Connection handling with improved error handling
  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection established");

    // Handle incoming messages
    ws.on("message", (message: string) => {
      try {
        console.log("Received message:", message);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    });

    // Error handling with specific error types
    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1011, "Internal Server Error");
      }
    });

    // Watch blockchain file changes with improved error handling
    let blockWatcher = watch(blocksFile, (eventType: string) => {
      if (eventType === "change" && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: "BLOCK_UPDATE",
            timestamp: Date.now()
          }));
        } catch (error) {
          console.error("Error sending block update:", error);
          if (error instanceof Error) {
            ws.close(1011, error.message);
          }
        }
      }
    });

    // Watch mining rewards changes with improved error handling
    let rewardsWatcher = watch(rewardsFile, (eventType: string) => {
      if (eventType === "change" && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: "REWARDS_UPDATE",
            timestamp: Date.now()
          }));
        } catch (error) {
          console.error("Error sending rewards update:", error);
          if (error instanceof Error) {
            ws.close(1011, error.message);
          }
        }
      }
    });

    // Cleanup on connection close
    ws.on("close", (code: number, reason: string) => {
      console.log(`WebSocket connection closed with code ${code}, reason: ${reason}`);
      if (blockWatcher) blockWatcher.close();
      if (rewardsWatcher) rewardsWatcher.close();
    });
  });

  return wss;
}