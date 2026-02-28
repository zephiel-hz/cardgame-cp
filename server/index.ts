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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
}

// Track initialization state
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Ensure initialization is complete
async function ensureInitialized() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = initializeServer().then(() => {
      isInitialized = true;
    });
  }
  await initPromise;
}

// Initialize on module load
initPromise = initializeServer().then(() => {
  isInitialized = true;
  
  // Only listen in development
  if (process.env.NODE_ENV !== "production") {
    const port = parseInt(process.env.PORT || "3000", 10);
    const hostname = process.env.HOST || "localhost";
    
    httpServer.listen(port, hostname, () => {
      log(`serving on http://${hostname}:${port}`);
    });
  }
  // In production, Vercel handler will call the app directly
}).catch(err => {
  console.error("[server] Initialization error:", err);
});

// Export a wrapper that ensures initialization before handling
const expressHandler = (req: any, res: any) => {
  if (isInitialized) {
    return app(req, res);
  } else if (initPromise) {
    initPromise.then(() => app(req, res));
  } else {
    res.status(503).json({ error: "Server not initialized" });
  }
};

export default expressHandler;
export { httpServer, initializeServer, app };
