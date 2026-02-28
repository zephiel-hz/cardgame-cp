import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any = null;
let initPromise: any = null;
let lastError: Error | null = null;

async function getApp() {
  if (app && initPromise) {
    // Wait for initialization to complete
    await initPromise;
    return app;
  }
  
  if (lastError) throw lastError;

  try {
    console.log("[api] Loading app from ./dist/index.cjs...");
    // @ts-ignore - dist/index.cjs is copied here during build
    const mod = await import("./dist/index.cjs");
    
    // Get exports
    app = mod.default;
    initPromise = mod.initPromise;
    
    if (typeof app !== "function") {
      throw new Error(`App is not a function, got ${typeof app}`);
    }
    
    console.log("[api] ✓ App loaded, waiting for initialization...");
    
    // Wait for init to complete
    if (initPromise) {
      await initPromise;
    }
    
    console.log("[api] ✓ Initialization complete");
    return app;
  } catch (error) {
    lastError = error as Error;
    console.error("[api] ✗ Failed to load app:", error);
    throw error;
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Set proper cache headers
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    
    const path = req.url || "";
    const method = req.method || "GET";
    console.log(`[api] ${method} ${path}`);
    
    // Get the initialized app
    const expressApp = await getApp();
    
    // Call the Express app directly (synchronous call)
    expressApp(req, res);
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
