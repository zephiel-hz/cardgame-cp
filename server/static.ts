import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  console.log("[static] ===== STATIC FILE SERVING INIT =====");
  console.log("[static] NODE_ENV:", process.env.NODE_ENV);
  console.log("[static] process.cwd():", process.cwd());
  console.log("[static] __dirname (may be stale):", __dirname);
  
  // NOTE: __dirname is bundled value, NOT runtime value in Vercel
  // So we cannot rely on __dirname. Use environment detection instead.

  let distPath: string = "";
  
  // Try multiple locations where static files might be
  const possiblePaths = [
    "/var/task/public",                    // Standard Vercel /public (if committed to git)
    "/var/task/dist/public",               // Vite output (fallback location)
    "/var/task/api/dist/public",           // Build artifact location
    path.resolve(process.cwd(), "public"),      // Generated /public folder
    path.resolve(process.cwd(), "dist", "public"),  // Local dev build
    path.resolve(process.cwd(), "api", "dist", "public"),  // Build output fallback
    path.resolve(__dirname, "public"),     // Relative to bundled server
    path.resolve(__dirname, "..", "..", "api", "dist", "public"), // Bundled
  ];
  
  console.log(`[static] Checking ${possiblePaths.length} possible paths for static files...`);
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      distPath = p;
      console.log("[static] ✓ Found public files at:", distPath);
      break;
    }
  }

  // Verify path exists
  if (!distPath) {
    console.error("[static] ⚠ WARNING: distPath not configured - skipping static file serving");
  } else if (!fs.existsSync(distPath)) {
    console.warn("[static] ⚠ WARNING: Public directory not found at:", distPath);
    console.warn("[static]   If running on Vercel, files may need custom deployment config");
  } else {
    // Log contents if directory exists
    try {
      const files = fs.readdirSync(distPath);
      console.log(`[static] ✓ Public dir exists with ${files.length} items`);
      files.slice(0, 5).forEach(f => console.log(`[static]   - ${f}`));
      if (files.length > 5) console.log(`[static]   ... and ${files.length - 5} more`);
    } catch (e) {
      console.error("[static] Error listing directory:", e);
    }
  }

  // Configure express.static ONLY if distPath is valid
  if (distPath && fs.existsSync(distPath)) {
    app.use(express.static(distPath, {
      maxAge: "1h",
      etag: true,
    lastModified: true,
    extensions: ["html", "js", "css"],
    setHeaders: (res, filePath, stat) => {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      
      // Log file being served
      console.log(`[static] FILE: ${fileName}`);
      
      // Set proper MIME types
      const mimeMap: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
      };
      
      if (mimeMap[ext]) {
        res.setHeader("Content-Type", mimeMap[ext]);
      }
      
      // Cache control
      if (ext === ".html") {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if ([".js", ".css", ".woff", ".woff2"].includes(ext)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"].includes(ext)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
      
      // CRITICAL: Remove any download headers
      res.removeHeader("Content-Disposition");
    }
  }));
  } else {
    console.warn("[static] ⚠ Skipping express.static middleware - no valid public directory found");
  }

  // Avatar serving
  if (process.env.NODE_ENV === "production") {
    const avatarPath = "/tmp/avatars";
    if (fs.existsSync(avatarPath)) {
      console.log("[static] Serving /avatars from:", avatarPath);
      app.use("/avatars", express.static(avatarPath, {
        maxAge: "7d",
        setHeaders: (res, filePath) => {
          const ext = path.extname(filePath).toLowerCase();
          if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
            res.setHeader("Cache-Control", "public, max-age=86400");
          }
          res.removeHeader("Content-Disposition");
        }
      }));
    }
  }

  // SPA fallback
  app.use((req, res, next) => {
    const pathname = req.path;
    
    // Skip non-SPA routes
    if (pathname.startsWith("/api") || 
        pathname.startsWith("/ws") ||
        /\.\w+$/.test(pathname)) {
      return next();
    }
    
    if (!distPath || !fs.existsSync(distPath)) {
      console.warn(`[static] SPA fallback skipped - public dir unavailable`);
      return next();
    }
    
    // Serve index.html for SPA routing
    const indexPath = path.join(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      console.warn(`[static] index.html not found at ${indexPath}`);
      return next();
    }
    
    console.log(`[static] SPA: ${pathname} → index.html`);
    
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    return res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`[static] Error serving SPA: ${err.message}`);
        if (!res.headersSent) {
          res.status(404).json({ error: "Not found" });
        }
      }
    });
  });
  
  console.log("[static] ===== STATIC READY =====");
}
