import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any = null;
let lastError: Error | null = null;

async function getApp() {
  if (app) return app;
  if (lastError) throw lastError;

  try {
    console.log("[api/index] Loading Express app from ./dist/index.cjs...");
    // @ts-ignore - dist/index.cjs is copied here during build
    const mod = await import("./dist/index.cjs");
    app = mod.default || mod;
    console.log("[api/index] ✓ App loaded");
    return app;
  } catch (error) {
    lastError = error as Error;
    console.error("[api/index] ✗ Failed to load app:", error);
    throw error;
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error("[api/index] ✗ Error:", error);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
};

