import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  console.log("[static] ===== STATIC FILE SERVING DEBUG =====");
  console.log("[static] __dirname:", __dirname);
  console.log("[static] process.cwd():", process.cwd());
  console.log("[static] NODE_ENV:", process.env.NODE_ENV);
  console.log("[static] VERCEL env:", process.env.VERCEL);

  // Find the public directory - try multiple possible locations
  // This is needed because esbuild bundling can affect path resolution
  const possiblePaths = [
    path.resolve(__dirname, "public"),           // Main: bundled location at __dirname/public
    path.resolve(__dirname, "..", "public"),     // Fallback 1: __dirname/../public
    "/var/task/api/dist/public",                 // Vercel Specific: exact path in Vercel environment
    path.resolve(process.cwd(), "api", "dist", "public"), // dev/fallback: cwd/api/dist/public
    path.resolve(process.cwd(), "dist", "public"), // dev: cwd/dist/public
  ];

  let distPath: string = "";
  let foundAt: number = -1;

  // Find the first path that exists
  for (let i = 0; i < possiblePaths.length; i++) {
    const p = possiblePaths[i];
    const exists = fs.existsSync(p);
    console.log(`[static] Path ${i} (exists=${exists}): ${p}`);
    
    if (exists) {
      console.log(`[static] ✓✓✓ FOUND at index ${i}: ${p}`);
      distPath = p;
      foundAt = i;
      break;
    }
  }

  if (!distPath) {
    console.error("[static] ✗✗✗ CRITICAL ERROR: No public directory found!");
    console.error("[static] This will cause file downloads instead of serving");
    throw new Error(`Could not find public directory. Tried: ${possiblePaths.join(", ")}`);
  }

  // Verify and log contents
  try {
    const files = fs.readdirSync(distPath);
    console.log(`[static] ✓ Directory contains ${files.length} items`);
    files.forEach(f => console.log(`[static]   - ${f}`));
    
    const hasIndex = files.includes("index.html");
    const hasAssets = files.includes("assets");
    console.log(`[static] Has index.html: ${hasIndex}, Has assets dir: ${hasAssets}`);
    
    if (!hasIndex) {
      console.error("[static] ✗ ERROR: index.html not found in public directory!");
    }
  } catch (e) {
    console.error("[static] Could not list directory:", e);
  }

  // Add logging middleware to track requests
  app.use((req, res, next) => {
    const originalSend = res.send;
    const originalSendFile = res.sendFile;
    
    res.send = function(data: any) {
      console.log(`[static-debug] res.send() called for ${req.path}, data type: ${typeof data}, size: ${String(data).length} bytes`);
      return originalSend.apply(res, [data]);
    };
    
    res.sendFile = function(filepath: any, options: any, callback: any) {
      console.log(`[static-debug] res.sendFile() called: ${filepath}`);
      return originalSendFile.apply(res, [filepath, options, callback]);
    };
    
    next();
  });

  // Configure express.static with detailed error handling
  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true,
    lastModified: true,
    extensions: ["html", "js", "css"],
    setHeaders: (res, filePath, stat) => {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      
      console.log(`[static] SERVING FILE: ${fileName} (ext: ${ext})`);
      
      // Set proper content types explicitly
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
      } else if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"].includes(ext)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
      
      // Explicitly remove Content-Disposition to prevent downloads
      res.removeHeader("Content-Disposition");
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
          if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
            res.setHeader("Cache-Control", "public, max-age=86400");
          }
          res.removeHeader("Content-Disposition");
        }
      }));
    }
  }

  // SPA fallback ONLY for unmatched routes that aren't static files
  app.use((req, res, next) => {
    const pathname = req.path;
    
    console.log(`[static] Checking SPA fallback for: ${pathname}`);
    
    // Skip API, WebSocket, and obvious static file extensions
    if (pathname.startsWith("/api") || 
        pathname.startsWith("/ws") ||
        /\.\w+$/.test(pathname)) { // Has file extension
      console.log(`[static] SKIP SPA fallback (${pathname}) - api/ws/file`);
      return next();
    }
    
    // This is a SPA route, serve index.html
    const indexPath = path.resolve(distPath, "index.html");
    console.log(`[static] SPA FALLBACK for ${pathname} → serving ${indexPath}`);
    
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    return res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`[static] ERROR serving index.html: ${err.message}`);
        if (!res.headersSent) {
          res.status(404).json({ error: "Not found", file: indexPath, err: err.message });
        }
      }
    });
  });
  
  console.log("[static] ===== STATIC SERVING CONFIGURED =====");
}
