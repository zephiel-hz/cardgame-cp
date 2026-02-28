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
  
  // Vercel specific: Files are at /var/task/api/dist/public when running
  // But we need to detect this at runtime, not build time
  
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    console.log("[static] Vercel environment detected");
    distPath = "/var/task/api/dist/public";
    console.log("[static] Using Vercel path:", distPath);
  } else {
    // Development: files are at distPath relative to repo root
    // Could be at api/dist/public or dist/public depending on how we run it
    const possiblePaths = [
      path.resolve(process.cwd(), "api", "dist", "public"),  // npm run dev / production build
      path.resolve(process.cwd(), "dist", "public"),         // vite built
      path.resolve(__dirname, "public"),                     // fallback
      path.resolve(__dirname, "..", "..", "api", "dist", "public"), // bundled
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        distPath = p;
        console.log("[static] Found public at:", distPath);
        break;
      }
    }
  }

  // Verify path exists
  if (!distPath || !fs.existsSync(distPath)) {
    console.error("[static] ✗✗✗ CRITICAL: Public directory not found!");
    console.error("[static] Expected path:", distPath);
    console.error("[static] Tried paths:");
    if (process.env.VERCEL === "1") {
      console.error("[static]   - /var/task/api/dist/public (Vercel)");
    }
    console.error("[static] CWD:", process.cwd());
    throw new Error(`Cannot find public directory at ${distPath}`);
  }

  // Log contents
  try {
    const files = fs.readdirSync(distPath);
    console.log(`[static] ✓ Public dir exists with ${files.length} items`);
    files.forEach(f => console.log(`[static]   - ${f}`));
  } catch (e) {
    console.error("[static] Error listing directory:", e);
  }

  // Configure express.static
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
    
    // Serve index.html for SPA routing
    const indexPath = path.join(distPath, "index.html");
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
