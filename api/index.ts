import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initializeServer } from "../server/index.js";

let initialized = false;
let initPromise: Promise<any> | null = null;

async function initialize() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log("[api] Initializing server...");
      // Import and initialize the server
      const { default: app } = await import("../dist/index.cjs");
      console.log("[api] Server initialized successfully");
      initialized = true;
      return app;
    } catch (error) {
      console.error("[api] Failed to initialize:", error);
      throw error;
    }
  })();

  return initPromise;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const app = await initialize();
    
    // Forward request to Express app
    return app(req, res);
  } catch (error) {
    console.error("[api] Request error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
