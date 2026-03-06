import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

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
    server: serverOptions,
    appType: "custom",
  });

  console.log("[vite] Setting up vite middlewares...");
  app.use(vite.middlewares);
  console.log("[vite] Vite middlewares installed");

  console.log("[vite] Adding catch-all HTML handler...");
  app.use(async (req, res, next) => {
    // Skip API requests and WebSocket upgrading
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      console.log(`[vite] Skipping non-HTML: ${req.method} ${req.path}`);
      return next();
    }
    
    console.log(`[vite] Handling: ${req.method} ${req.path}`);
    const url = req.originalUrl;

    try {
      // Use process.cwd() for compatibility with bundled production builds
      const baseDir = process.cwd();
      const clientTemplate = path.resolve(
        baseDir,
        "client",
        "index.html",
      );

      console.log(`[vite] Reading template from: ${clientTemplate}`);
      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      console.log(`[vite] Template read successfully, length: ${template.length}`);
      
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      console.log(`[vite] Template modified`);
      
      const page = await vite.transformIndexHtml(url, template);
      console.log(`[vite] HTML transformed successfully, length: ${page.length}`);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      console.error(`[vite] Error in handler:`, e);
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
  console.log("[vite] Setup complete");
}
