import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any = null;
let initPromise: any = null;
let lastError: Error | null = null;
let loadAttempts = 0;

async function getApp() {
  loadAttempts++;
  console.log(`[spa] === LOAD ATTEMPT #${loadAttempts} ===`);
  
  // If we have a cached app, verify it's actually valid before using
  if (app !== null && app !== undefined && initPromise) {
    console.log("[spa] Using cached app (type: " + typeof app + "), waiting for initPromise...");
    try {
      await initPromise;
      console.log("[spa] initPromise resolved, app is valid");
      return app;
    } catch (e) {
      console.error("[spa] initPromise rejected, resetting cache:", e);
      app = null;
      initPromise = null;
      lastError = null;
      // Fall through to reload
    }
  }
  
  if (lastError) {
    console.error("[spa] Throwing cached error:", lastError);
    throw lastError;
  }

  try {
    console.log("[spa] Loading fresh app from ./api/dist/index.cjs...");
    console.log("[spa] Current working directory:", process.cwd());
    
    // @ts-ignore - dist/index.cjs is copied here during build
    const mod = await import("./api/dist/index.cjs");
    
    console.log("[spa] Module loaded, inspecting exports...");
    console.log("[spa] Module keys:", Object.keys(mod));
    
    // Handle CommonJS/ESM interop - mod.default might be a namespace or the app itself
    let defaultExport = mod.default;
    console.log("[spa] mod.default type:", typeof defaultExport);
    
    // If mod.default is an object with a 'default' property (CommonJS interop), unwrap it
    if (defaultExport && typeof defaultExport === "object" && "default" in defaultExport && typeof defaultExport.default === "function") {
      console.log("[spa] Detected CommonJS interop - unwrapping mod.default.default");
      app = defaultExport.default;
    } else {
      app = defaultExport;
    }
    
    // Always get initPromise from mod directly
    initPromise = mod.initPromise;
    
    console.log("[spa] Final app type:", typeof app);
    console.log("[spa] Final app is callable:", typeof app === "function");
    
    console.log("[spa] ✓ Waiting for initialization...");
    
    // Wait for init to complete
    if (initPromise) {
      await initPromise;
      console.log("[spa] ✓ Initialization complete");
    }
    
    console.log("[spa] ✓ App ready to serve requests");
    return app;
  } catch (error) {
    lastError = error as Error;
    console.error("[spa] ✗ Fatal error loading app:", error);
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
    console.log(`\n[spa] >>> REQUEST: ${method} ${pathname}`);
    
    // Skip static files - let Vercel handle them from /public
    if (/\.[a-z]+$/i.test(pathname) && !pathname.startsWith("/api")) {
      console.log(`[spa] Request has file extension, skipping...`);
      res.status(404).json({ error: "Not found" });
      return;
    }
    
    // Get the initialized app
    const expressApp = await getApp();
    
    console.log(`[spa] Got app, type: ${typeof expressApp}`);
    
    if (typeof expressApp !== "function") {
      throw new Error(`App is not callable, got ${typeof expressApp}`);
    }
    
    console.log(`[spa] Delegating to Express app...`);
    
    // Call the Express app
    expressApp(req, res);
    
  } catch (error) {
    console.error("\n[spa] !!! ERROR:", error);
    
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    } else {
      console.error("[spa] Headers already sent, cannot send error response");
    }
  }
};
