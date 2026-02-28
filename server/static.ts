import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In Vercel, __dirname points to /var/task/api/ (where index.cjs is located)
  // Static files are at /var/task/api/dist/public/
  // So we look for ./public relative to __dirname
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static assets from dist/public
  app.use(express.static(distPath));

  // Serve avatars from /tmp/avatars in production, embedded public in dev
  if (process.env.NODE_ENV === "production") {
    const avatarPath = "/tmp/avatars";
    if (fs.existsSync(avatarPath)) {
      app.use("/avatars", express.static(avatarPath));
    }
  }

  // Fall through to index.html for SPA routing
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
