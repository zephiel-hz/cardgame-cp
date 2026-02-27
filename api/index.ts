// Vercel serverless function for full-stack Node.js app
// This module bridges Vercel's serverless environment with our Express server

import { createServer } from "http";
import express from "express";

// Load environment variables
if (process.env.NODE_ENV !== "production") {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
}

// Create minimal Express app for Vercel
const app = express();

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// For all other routes, try to load and run the production server
app.use(async (req, res, next) => {
  try {
    // Dynamically import the built server
    const serverModule = await import("../dist/index.cjs");
    const server = serverModule.default || serverModule;
    
    // If the module exports a function (Express app), use it
    if (typeof server === "function") {
      return server(req as any, res as any, next);
    }
    
    // Otherwise return error
    res.status(500).json({ error: "Server module is not an Express app" });
  } catch (error) {
    console.error("Failed to load server:", error);
    res.status(500).json({ 
      error: "Server failed to initialize",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Export for Vercel
export default app;
