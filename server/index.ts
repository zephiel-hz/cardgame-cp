import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import fs from "fs";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
    limit: "50mb",
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Create and initialize the server
async function initializeServer() {
  // IMPORTANT: Setup static file serving FIRST before registering routes
  // This ensures static files are matched before API routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
    log("Static file serving configured for production");
  }

  // Register API routes after static serving
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // Serve uploaded avatars from /tmp in production, public/avatars in dev
  const avatarDir = process.env.NODE_ENV === "production" 
    ? "/tmp/avatars"
    : path.join(process.cwd(), "public/avatars");
    
  if (fs.existsSync(avatarDir)) {
    app.use("/avatars", express.static(avatarDir));
    log(`avatar directory: ${avatarDir}`);
  } else {
    log(`avatar directory not found at ${avatarDir}, uploads will be cached in memory`);
  }

  // Setup Vite in development ONLY
  if (process.env.NODE_ENV !== "production") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
}

// Track initialization state for serverless
let isInitialized = false;
let initPromise: Promise<void> | null = null;

console.log("[server] Module loading...");
console.log("[server] NODE_ENV:", process.env.NODE_ENV);

// Initialize on module load
initPromise = initializeServer()
  .then(() => {
    isInitialized = true;
    console.log("[server] ✓✓✓ INITIALIZATION COMPLETE ✓✓✓");
    console.log("[server] App is ready for requests");
    
    // Listen in both development AND production (Render, traditional hosting)
    // In Vercel, this won't be called since app exports for serverless handler
    if (process.env.NODE_ENV !== "production") {
      const port = parseInt(process.env.PORT || "3000", 10);
      const hostname = process.env.HOST || "localhost";
      
      httpServer.listen(port, hostname, () => {
        log(`serving on http://${hostname}:${port}`);
      });
    } else {
      // Production: listen on PORT (set by Render or other platform)
      const port = parseInt(process.env.PORT || "3000", 10);
      const hostname = process.env.HOST || "0.0.0.0";
      
      httpServer.listen(port, hostname, () => {
        console.log(`[server] ✓ Production server listening on http://${hostname}:${port}`);
      });
    }
  })
  .catch(err => {
    console.error("[server] ✗✗✗ INITIALIZATION FAILED ✗✗✗");
    console.error("[server] Error:", err);
    process.exit(1);
  });

console.log("[server] App object type:", typeof app);
console.log("[server] Exporting app and initPromise...");

// Export the raw Express app - it will be used once initialized
export default app;
export { httpServer, initializeServer, initPromise };
