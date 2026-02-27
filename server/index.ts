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

  // Serve uploaded avatars from public/avatars
  const avatarDir = path.join(process.cwd(), "public/avatars");
  if (fs.existsSync(avatarDir)) {
    app.use("/avatars", express.static(avatarDir));
    log(`avatar directory: ${avatarDir}`);
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

// Initialize on module load and start server if this is the main module
(async () => {
  await initializeServer();
  
  // Only listen if this is being run directly (not in Vercel serverless)
  if (process.env.NODE_ENV === "production" && process.env.VERCEL !== "1") {
    // In production locally, always listen
    const port = parseInt(process.env.PORT || "3000", 10);
    const hostname = "0.0.0.0";
    
    httpServer.listen(port, hostname, () => {
      log(`serving on http://${hostname}:${port}`);
    });
  } else if (process.env.NODE_ENV !== "production") {
    // In development, listen on localhost
    const port = parseInt(process.env.PORT || "3000", 10);
    const hostname = process.env.HOST || "localhost";
    
    httpServer.listen(port, hostname, () => {
      log(`serving on http://${hostname}:${port}`);
    });
  }
  // Note: In Vercel (NODE_ENV=production AND VERCEL=1), api/index.ts handles requests
})();

// Export for use as middleware (e.g., in Vercel serverless functions)
export default app;
export { httpServer, initializeServer };
