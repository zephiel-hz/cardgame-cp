import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Don't exit on errors during dev
      },
    },
    server: {
      middlewareMode: true,
    },
  });

  console.log("[vite] Setting up vite asset middlewares...");
  app.use(vite.middlewares);
  console.log("[vite] Vite middlewares installed");
  
  console.log("[vite] Setup complete");
  
  // Return vite instance for HTML fallback handler in server/index.ts
  return vite;
}
