import type { VercelRequest, VercelResponse } from "@vercel/node";
import path from "path";
import fs from "fs";

let app: any = null;

async function initializeApp() {
  if (app) return app;

  try {
    // Load the Express app module
    const appModule = await import("../dist/index.cjs");
    app = appModule.default || appModule;
    return app;
  } catch (error) {
    console.error("Error loading app:", error);
    throw error;
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  // CORS headers - allow cross-origin requests
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const expressApp = await initializeApp();
    return expressApp(req, res);
  } catch (err) {
    console.error("Handler error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

