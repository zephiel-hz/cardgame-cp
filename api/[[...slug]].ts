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
    
    // Handle CommonJS/ESM interop - mod.default might be a namespace or the app itself
    let defaultExport = mod.default;
    console.log("[api] mod.default type:", typeof defaultExport);
    
    // If mod.default is an object with a 'default' property (CommonJS interop), unwrap it
    if (defaultExport && typeof defaultExport === "object" && "default" in defaultExport && typeof defaultExport.default === "function") {
      console.log("[api] Detected CommonJS interop - unwrapping mod.default.default");
      app = defaultExport.default;
    } else {
      app = defaultExport;
    }
    
    // Always get initPromise from mod directly
    initPromise = mod.initPromise;
    
    console.log("[api] Final app type:", typeof app);
    console.log("[api] Final app is callable:", typeof app === "function");
    
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
    
    console.log(`[api] Got app, type: ${typeof expressApp}`);
    
    if (typeof expressApp !== "function") {
      throw new Error(`App is not callable, got ${typeof expressApp}`);
    }
    
    console.log(`[api] Delegating to Express app...`);
    
    // Call the Express app and wait for response to finish
    // This is critical in Vercel - handler must not return until response is sent
    await new Promise<void>((resolve, reject) => {
      expressApp(req, res);
      
      // Resolve when response is finished
      res.on('finish', () => {
        console.log(`[api] ✓ Response finished`);
        resolve();
      });
      
      // Also handle early close (disconnected client)
      res.on('close', () => {
        console.log(`[api] ℹ Response closed stream`);
        resolve();
      });
      
      // Catch any response errors
      res.on('error', (err) => {
        console.error(`[api] ✗ Response error:`, err);
        reject(err);
      });
      
      // Safety timeout - if no finish/close/error in 30s, resolve anyway
      setTimeout(() => {
        console.warn(`[api] ⚠ Response timeout - resolving anyway`);
        resolve();
      }, 30000);
    });
    
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
