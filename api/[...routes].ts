// Catch-all serverless function for Vercel
// This handles all routes that aren't matched by other API handlers

import type { VercelRequest, VercelResponse } from "@vercel/node";

let cachedApp: any = null;

async function getApp() {
  if (cachedApp) {
    return cachedApp;
  }

  try {
    const imported = await import("../dist/index.cjs");
    cachedApp = imported.default;
    return cachedApp;
  } catch (error) {
    console.error("Failed to load app:", error);
    throw error;
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const app = await getApp();

    if (!app) {
      return res.status(500).json({ error: "App not available" });
    }

    return app(req as any, res as any);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
