import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any = null;
let initPromise: any = null;
let lastError: Error | null = null;
let loadAttempts = 0;

async function getApp() {
  loadAttempts++;
  console.log(`[api] === LOAD ATTEMPT #${loadAttempts} ===`);
  
  // If we have a cached app, verify it's actually valid before using
  if (app !== null && app !== undefined && initPromise) {
    console.log("[api] Using cached app (type: " + typeof app + "), waiting for initPromise...");
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
    console.log("[api] app is null/undefined:", app == null);
    console.log("[api] app keys:", app ? Object.keys(app).slice(0, 10) : "N/A");
    console.log("[api] has .use:", typeof app?.use);
    console.log("[api] has .listen:", typeof app?.listen);
    console.log("[api] is callable:", typeof app === "function");
    console.log("[api] initPromise type:", typeof initPromise);
    
    // Express apps are callable AND have middleware methods
    // But also accept plain objects for debugging
    if (app == null) {
      throw new Error(`App is null or undefined`);
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
    
    console.log(`[api] Got app, type: ${typeof expressApp}, has .use: ${!!expressApp?.use}`);
    console.log(`[api] Delegating to Express app...`);
    
    // Call the Express app (it should be callable or have express methods)
    if (typeof expressApp === "function") {
      expressApp(req, res);
    } else {
      // If not a function, might still work if Express middleware
      expressApp(req, res);
    }
    
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
