import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { emailNotificationService } from "./email-notifications";
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

// Initialize server middleware and routes
async function initializeServer() {
  console.log("[init] Starting server initialization...");
  
  // Initialize email service
  console.log("[init] Setting up email notifications service...");
  try {
    await emailNotificationService.initialize();
    console.log("[init] ✓ Email notifications service initialized");
  } catch (error) {
    console.error("[init] ⚠️  Email notifications service failed to initialize:", error);
    console.log("[init] Continuing without email notifications...");
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
      // Log all asset requests
      if (path.startsWith("/assets") || path.endsWith(".js") || path.endsWith(".css")) {
        log(`${req.method} ${path} ${res.statusCode} (MIME: ${res.getHeader("content-type")}) in ${duration}ms`);
      }
    });

    next();
  });

  // Register API routes FIRST, before Vite
  // This ensures /api/* routes have priority over Vite middleware
  await registerRoutes(httpServer, app);

  // Setup Vite in development AFTER API routes
  // This ensures Vite middlewares don't interfere with API routing
  if (process.env.NODE_ENV !== "production") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serve static files (public folder, manifest.json, sw.js, etc)
  // MUST be before SPA fallback so files are found before fallback serves index.html
  serveStatic(app);

  // In production, explicitly serve dist/public/assets for built assets
  if (process.env.NODE_ENV === "production") {
    const assetsDir = path.resolve(process.cwd(), "dist", "public", "assets");
    console.log("[init] Production assets directory:", assetsDir);
    console.log("[init] Assets dir exists:", fs.existsSync(assetsDir));
    
    if (fs.existsSync(assetsDir)) {
      app.use("/assets", express.static(assetsDir, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, file) => {
          // Set correct MIME types for assets
          const ext = path.extname(file).toLowerCase();
          const mimeMap: Record<string, string> = {
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".map": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".webp": "image/webp",
          };
          const mime = mimeMap[ext] || "application/octet-stream";
          res.setHeader("Content-Type", mime);
          console.log(`[assets] Serving ${file.split("/").pop()} as ${mime}`);
        }
      }));
      console.log("[init] ✓ Assets middleware registered for /assets");
    } else {
      console.warn("[init] ⚠ Assets directory not found at:", assetsDir);
    }
  }

  // SPA fallback for all environments (serve index.html for routes without extensions)
  app.use(async (req, res, next) => {
    // Skip API and WebSocket requests
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      return next();
    }
    
    // Skip assets folder explicitly
    if (req.path.startsWith("/assets/")) {
      console.log(`[SPA] Skipping asset request: ${req.path}`);
      return next();
    }
    
    // Skip virtual modules (@vite/*, @react-refresh, etc)
    if (req.path.startsWith("/@")) {
      return next();
    }
    
    // Skip static assets with file extensions
    const ext = path.extname(req.path);
    if (ext) {
      console.log(`[SPA] Skipping request with extension: ${req.path} (ext: ${ext})`);
      return next();
    }
    
    console.log(`[SPA] Serving HTML fallback for: ${req.path}`);
    
    // For paths without extension, serve index.html (SPA fallback)
    try {
      let indexPath: string;
      
      if (process.env.NODE_ENV === "production") {
        // In production, serve the built index.html
        indexPath = path.resolve(process.cwd(), "dist", "public", "index.html");
      } else {
        // In development, serve the source index.html
        indexPath = path.resolve(process.cwd(), "client", "index.html");
      }
      
      const template = await fs.promises.readFile(indexPath, "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      console.error(`[spa] Error serving HTML fallback:`, e);
      next(e);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    log("SPA HTML fallback handler registered (dev mode)");
  } else {
    log("SPA HTML fallback handler registered (production mode)");
  }

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
    
    // Listen on PORT for both development and production
    const port = parseInt(process.env.PORT || "3000", 10);
    const hostname = process.env.HOST || "0.0.0.0";
    
    httpServer.listen(port, hostname, () => {
      log(`serving on http://${hostname}:${port}`);
    });
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
