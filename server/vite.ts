import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: "custom",
  });

  console.log("[vite] Setting up vite middlewares...");
  app.use(vite.middlewares);
  console.log("[vite] Vite middlewares installed");

  console.log("[vite] Adding catch-all HTML handler...");
  app.use(async (req, res, next) => {
    // Skip API requests and WebSocket upgrading
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      return next();
    }
    
    // Skip static assets: .js, .css, .json, .png, .jpg, etc.
    // Only serve HTML for paths without extensions or .html specifically
    const ext = path.extname(req.path);
    if (ext && ext !== ".html") {
      // Has extension that's not .html - skip (let Vite serve it)
      return next();
    }
    
    const url = req.originalUrl;

    try {
      // Use process.cwd() for compatibility with bundled production builds
      const baseDir = process.cwd();
      const clientTemplate = path.resolve(
        baseDir,
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      console.error(`[vite] Error in handler:`, e);
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
  console.log("[vite] Setup complete");
}
