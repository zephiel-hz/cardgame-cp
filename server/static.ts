import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Log the actual __dirname value for debugging
  console.log("[static] __dirname:", __dirname);
  
  // In Vercel serverless, __dirname points to /var/task/api/dist (where index.cjs is located)
  // Static files are bundled at api/dist/public/ → /var/task/api/dist/public/ in Vercel
  const distPath = path.resolve(__dirname, "public");
  
  console.log("[static] Attempting to serve from:", distPath);
  console.log("[static] Directory exists?", fs.existsSync(distPath));
  
  if (fs.existsSync(distPath)) {
    console.log("[static] ✓ Found static directory");
    // List some files in the directory
    try {
      const files = fs.readdirSync(distPath);
      console.log(`[static] Contents (${files.length} items):`, files.slice(0, 5).join(", "));
    } catch (e) {
      console.log("[static] Could not list directory contents:", e);
    }
  } else {
    // Try alternative path
    const altPath = path.resolve(__dirname, "..", "public");
    console.log("[static] Main path not found, trying:", altPath);
    console.log("[static] Alt directory exists?", fs.existsSync(altPath));
    if (!fs.existsSync(altPath)) {
      throw new Error(
        `Could not find the build directory. Tried: ${distPath} and ${altPath}`
      );
    }
  }
  
  // Serve static assets with cache headers optimized for assets
  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Debug: log what content-type is being set
      const contentType = res.getHeader("content-type");
      if (filePath.includes("index.html")) {
        // Don't cache HTML
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      } else if (filePath.includes("favicon")) {
        res.setHeader("Cache-Control", "max-age=86400");
      }
    }
  }));
  
  // Serve avatars from /tmp/avatars in production  
  if (process.env.NODE_ENV === "production") {
    const avatarPath = "/tmp/avatars";
    if (fs.existsSync(avatarPath)) {
      console.log("[static] ✓ Serving avatars from:", avatarPath);
      app.use("/avatars", express.static(avatarPath, {
        maxAge: "7d",
        etag: true
      }));
    }
  }
  
  // SPA fallback: serve index.html for all unmatched routes
  app.use((req, res, next) => {
    // Skip API and WebSocket routes
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      return next();
    }
    
    // Serve index.html for SPA routing
    const indexPath = path.resolve(distPath, "index.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error("[static] Error serving index.html:", err);
        res.status(404).json({ error: "Not found" });
      }
    });
  });
}
