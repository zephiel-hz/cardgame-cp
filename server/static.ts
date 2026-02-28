import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  console.log("[static] Initializing static file serving...");
  console.log("[static] __dirname:", __dirname);
  console.log("[static] process.cwd():", process.cwd());
  console.log("[static] NODE_ENV:", process.env.NODE_ENV);

  // Find the public directory - try multiple possible locations
  // This is needed because esbuild bundling can affect path resolution
  const possiblePaths = [
    path.resolve(__dirname, "public"),           // Main: bundled location
    path.resolve(__dirname, "..", "public"),     // Fallback 1: parent dir
    path.resolve(process.cwd(), "public"),       // Fallback 2: cwd
    "/var/task/api/dist/public",                 // Fallback 3: Vercel specific
    path.join(process.cwd(), "..", "..", "api", "dist", "public"), // Fallback 4
  ];

  let distPath: string = "";
  let foundAt: number = -1;

  // Find the first path that exists
  for (let i = 0; i < possiblePaths.length; i++) {
    const p = possiblePaths[i];
    if (fs.existsSync(p)) {
      console.log(`[static] ✓ Found public directory at index ${i}: ${p}`);
      distPath = p;
      foundAt = i;
      break;
    } else {
      console.log(`[static] Path ${i} not found: ${p}`);
    }
  }

  if (!distPath) {
    console.error("[static] ✗ CRITICAL: Could not find public directory at any location!");
    console.error("[static] Tried paths:", possiblePaths);
    throw new Error(`Could not find public directory. Tried: ${possiblePaths.join(", ")}`);
  }

  // Verify contents
  try {
    const files = fs.readdirSync(distPath);
    console.log(`[static] ✓ Directory has ${files.length} items:`, files.slice(0, 10).join(", "));
    
    // Check for index.html specifically
    const hasIndex = files.includes("index.html");
    const hasAssets = files.includes("assets");
    console.log(`[static] Has index.html: ${hasIndex}, Has assets: ${hasAssets}`);
    
    if (!hasIndex || !hasAssets) {
      console.warn("[static] ⚠ Warning: Expected index.html and/or assets directory not found!");
    }
  } catch (e) {
    console.error("[static] Could not list directory contents:", e);
  }

  // Configure express.static with explicit MIME types
  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true,
    lastModified: true,
    // Extensions to try if file doesn't have extension
    extensions: ["html", "js", "css"],
    setHeaders: (res, filePath, stat) => {
      // Set proper content types explicitly
      const ext = path.extname(filePath).toLowerCase();
      
      console.log(`[static] Serving: ${filePath}`);
      
      if (ext === ".html") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (ext === ".js") {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (ext === ".css") {
        res.setHeader("Content-Type", "text/css; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (ext === ".json") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      } else if (ext === ".png") {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (ext === ".jpg" || ext === ".jpeg") {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (ext === ".svg") {
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (ext === ".ico") {
        res.setHeader("Content-Type", "image/x-icon");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (ext === ".woff" || ext === ".woff2") {
        res.setHeader("Content-Type", ext === ".woff2" ? "font/woff2" : "font/woff");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      
      // Make sure we're NOT sending download headers
      res.removeHeader("Content-Disposition");
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
  }));

  // Serve avatars from /tmp/avatars in production  
  if (process.env.NODE_ENV === "production") {
    const avatarPath = "/tmp/avatars";
    if (fs.existsSync(avatarPath)) {
      console.log("[static] ✓ Serving avatars from:", avatarPath);
      app.use("/avatars", express.static(avatarPath, {
        maxAge: "7d",
        etag: true,
        setHeaders: (res, filePath) => {
          const ext = path.extname(filePath).toLowerCase();
          if (ext === ".jpg" || ext === ".jpeg") {
            res.setHeader("Content-Type", "image/jpeg");
          } else if (ext === ".png") {
            res.setHeader("Content-Type", "image/png");
          } else if (ext === ".gif") {
            res.setHeader("Content-Type", "image/gif");
          } else if (ext === ".webp") {
            res.setHeader("Content-Type", "image/webp");
          }
          res.removeHeader("Content-Disposition");
        }
      }));
    }
  }

  // SPA fallback ONLY for unmatched routes that aren't static files
  app.use((req, res, next) => {
    // Skip API, WebSocket, and obvious static file extensions
    const path = req.path;
    
    if (path.startsWith("/api") || 
        path.startsWith("/ws") ||
        /\.\w+$/.test(path)) { // Has file extension
      return next();
    }
    
    // This is a SPA route, serve index.html
    const indexPath = path.resolve(distPath, "index.html");
    console.log("[static] SPA fallback for:", path, "→ index.html");
    
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error("[static] Error serving index.html:", err);
        if (!res.headersSent) {
          res.status(404).json({ error: "Not found", details: err.message });
        }
      }
    });
  });
  
  console.log("[static] ✓ Static file serving configured successfully");
}
