import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any = null;
let initPromise: any = null;
let lastError: Error | null = null;
let loadAttempts = 0;

async function getApp() {
  loadAttempts++;
  console.log(`[api] === LOAD ATTEMPT #${loadAttempts} ===`);
  
  // If we have a cached app, verify it's actually valid before using
  if (app !== null && (typeof app === "function" || app?.use) && initPromise) {
    console.log("[api] Using cached app, waiting for initPromise...");
    try {
      await initPromise;
      console.log("[api] initPromise resolved, app is valid");
      return app;
    } catch (e) {
      console.error("[api] initPromise rejected, resetting cache:", e);
      app = null;
      initPromise = null;
      lastError = null;
      // Fall through to reload
    }
  }
  
  if (lastError) {
    console.error("[api] Throwing cached error:", lastError);
    throw lastError;
  }

  try {
    console.log("[api] Loading fresh app from ./dist/index.cjs...");
    console.log("[api] Current working directory:", process.cwd());
    
    // @ts-ignore - dist/index.cjs is copied here during build
    const mod = await import("./dist/index.cjs");
    
    console.log("[api] Module loaded, inspecting exports...");
    console.log("[api] Module keys:", Object.keys(mod));
    
    // Get exports
    app = mod.default;
    initPromise = mod.initPromise;
    
    console.log("[api] app type:", typeof app);
    console.log("[api] app constructor:", app?.constructor?.name);
    console.log("[api] initPromise type:", typeof initPromise);
    
    // Validate app - Express apps are callable (function) OR objects with middleware methods
    if (typeof app !== "function" && !app?.use) {
      throw new Error(`App is invalid - not a function or Express app, got ${typeof app}`);
    }
    
    console.log("[api] ✓ Waiting for initialization...");
    
    // Wait for init to complete
    if (initPromise) {
      await initPromise;
      console.log("[api] ✓ Initialization complete");
    }
    
    console.log("[api] ✓ App ready to serve requests");
    return app;
  } catch (error) {
    lastError = error as Error;
    console.error("[api] ✗ Fatal error loading app:", error);
    throw error;
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Set proper cache headers
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    
    const pathname = req.url || "/";
    const method = req.method || "GET";
    console.log(`\n[api] >>> REQUEST: ${method} ${pathname}`);
    
    // Get the initialized app
    const expressApp = await getApp();
    
    // Validate expressApp is callable (Express apps are function objects)
    if (typeof expressApp !== "function" && !expressApp?.use) {
      console.error(`[api] !!! CRITICAL: expressApp is invalid, got ${typeof expressApp}`);
      console.error(`[api] expressApp keys:`, Object.keys(expressApp || {}));
      throw new Error(`expressApp is not callable or not an Express app`);
    }
    
    console.log(`[api] Delegating to Express app...`);
    
    // Call the Express app directly (synchronous call)
    expressApp(req, res);
    
  } catch (error) {
    console.error("\n[api] !!! ERROR:", error);
    
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    } else {
      console.error("[api] Headers already sent, cannot send error response");
    }
  }
};
