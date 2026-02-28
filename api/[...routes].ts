import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any = null;
let lastError: Error | null = null;

async function getApp() {
  if (app) return app;
  if (lastError) throw lastError;

  try {
    console.log("[api] Loading Express app from dist/index.cjs...");
    // @ts-ignore - dist/index.cjs is generated at build time
    const mod = await import("../../dist/index.cjs");
    app = mod.default || mod;
    
    if (typeof app !== "function") {
      throw new Error(`App is not a function, got ${typeof app}`);
    }
    
    console.log("[api] ✓ Express app loaded successfully");
    return app;
  } catch (error) {
    lastError = error as Error;
    console.error("[api] ✗ Failed to load app:", error);
    throw error;
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Set proper headers before anything else
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    console.log(`[api] ${req.method} ${req.url}`);
    const app = await getApp();
    
    // Call Express app - it should handle the response
    return app(req, res);
  } catch (error) {
    console.error("[api] ✗ Request failed:", error);
    
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  }
};
