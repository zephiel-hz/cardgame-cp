#!/usr/bin/env node

/**
 * Standalone server for Vercel deployment
 * Runs the pre-built Express app from dist/index.cjs
 */

import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  try {
    console.log("[server] Starting...");
    
    // Load the pre-built Express app
    console.log("[server] Loading app from dist/index.cjs");
    const appModule = await import("./dist/index.cjs");
    const app = appModule.default || appModule;

    if (!app) {
      throw new Error("Failed to load app: app is null or undefined");
    }

    console.log("[server] App loaded successfully");

    // Create HTTP server
    const httpServer = createServer(app);

    const port = parseInt(process.env.PORT || "3000", 10);
    const hostname = process.env.VERCEL ? "0.0.0.0" : "localhost";

    httpServer.listen(port, hostname, () => {
      console.log(`[server] listening on http://${hostname}:${port}`);
      console.log(`[server] NODE_ENV=${process.env.NODE_ENV}`);
      console.log(`[server] VERCEL=${process.env.VERCEL}`);
    });

    // Handle graceful shutdown
    process.on("SIGTERM", () => {
      console.log("[server] SIGTERM received, shutting down gracefully");
      httpServer.close(() => {
        console.log("[server] Server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("[server] SIGINT received, shutting down");
      httpServer.close(() => {
        console.log("[server] Server closed");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("[server] Failed to start:", error);
    process.exit(1);
  }
}

startServer();
