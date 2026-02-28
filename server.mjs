#!/usr/bin/env node

/**
 * Standalone server entry point for production (including Vercel)
 * Loads and initializes the pre-built Express server from dist/index.cjs
 */

async function startServer() {
  try {
    console.log("[server] Starting server...");
    
    // Load the pre-built CommonJS module
    const mod = await import("./dist/index.cjs");
    const { default: app, httpServer: httpServerExport, initializeServer } = mod;

    if (!app) {
      throw new Error("Failed to load app: no default export");
    }

    console.log("[server] App module loaded");

    // Use the exported httpServer or create a new one
    let server = httpServerExport;
    if (!server) {
      console.log("[server] Creating new HTTP server from Express app");
      const { createServer } = await import("http");
      server = createServer(app);
    }

    // Start listening
    const port = parseInt(process.env.PORT || "3000", 10);
    const hostname = process.env.VERCEL ? "0.0.0.0" : "localhost";

    server.listen(port, hostname, () => {
      console.log(`[server] ✓ listening on http://${hostname}:${port}`);
      console.log(`[server] NODE_ENV=${process.env.NODE_ENV}`);
    });

    // Handle graceful shutdown
    process.on("SIGTERM", () => {
      console.log("[server] SIGTERM received, shutting down...");
      server.close(() => {
        console.log("[server] ✓ Server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("[server] SIGINT received, shutting down...");
      server.close(() => {
        console.log("[server] ✓ Server closed");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("[server] ✗ Failed to start:", error);
    process.exit(1);
  }
}

startServer();
