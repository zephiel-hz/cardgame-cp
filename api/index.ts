import type { VercelRequest, VercelResponse } from "@vercel/node";

let app: any = null;

async function getApp() {
  if (app) return app;

  try {
    // @ts-ignore - dist/index.cjs is generated at build time
    const mod = await import("../dist/index.cjs");
    app = mod.default || mod;
    return app;
  } catch (error) {
    console.error("[api] Error loading app:", error);
    throw error;
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error("[api] Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

