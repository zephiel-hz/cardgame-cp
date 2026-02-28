#!/usr/bin/env node

/**
 * Standalone server for Vercel deployment
 * Runs the pre-built Express app from dist/index.cjs
 */

import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  try {
    // Load the pre-built Express app
    const appModule = await import("./dist/index.cjs");
    const app = appModule.default || appModule;

    // Create HTTP server
    const httpServer = createServer(app);

    const port = parseInt(process.env.PORT || "3000", 10);
    const hostname = process.env.VERCEL ? "0.0.0.0" : "localhost";

    httpServer.listen(port, hostname, () => {
      console.log(`[server] listening on http://${hostname}:${port}`);
    });

    // Handle graceful shutdown
    process.on("SIGTERM", () => {
      console.log("[server] SIGTERM received, shutting down gracefully");
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
