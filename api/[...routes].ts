import type { VercelRequest, VercelResponse } from "@vercel/node";

let handler: any = null;
let lastError: Error | null = null;

async function getHandler() {
  if (handler) return handler;
  if (lastError) throw lastError;

  try {
    console.log("[api] Loading handler from ./dist/index.cjs...");
    // @ts-ignore - dist/index.cjs is copied here during build
    const mod = await import("./dist/index.cjs");
    handler = mod.default;
    
    if (typeof handler !== "function") {
      throw new Error(`Handler is not a function, got ${typeof handler}`);
    }
    
    console.log("[api] ✓ Handler loaded successfully");
    return handler;
  } catch (error) {
    lastError = error as Error;
    console.error("[api] ✗ Failed to load handler:", error);
    throw error;
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Set proper cache headers
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    
    console.log(`[api] ${req.method} ${req.url}`);
    const handler = await getHandler();
    
    // Call the async handler which will wait for app initialization
    return await handler(req, res);
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
