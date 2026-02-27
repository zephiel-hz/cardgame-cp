// Vercel Serverless Function Entry Point
// This file serves as the gateway for all HTTP requests in the production environment

import type { VercelRequest, VercelResponse } from "@vercel/node";

// Cache the Express app after first import
let cachedApp: any = null;

async function getApp() {
  if (cachedApp) {
    return cachedApp;
  }

  try {
    // Import the built Express server
    const imported = await import("../dist/index.cjs");
    cachedApp = imported.default;
    return cachedApp;
  } catch (error) {
    console.error("Failed to import server modules:", error);
    throw error;
  }
}

// Vercel Function Handler
export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const app = await getApp();

    if (!app) {
      return res.status(500).json({ error: "Server app is not available" });
    }

    // Forward the request to the Express app
    return app(req as any, res as any);
  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
