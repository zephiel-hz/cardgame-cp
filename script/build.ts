import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, mkdir, cp, writeFile } from "fs/promises";
import path from "path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function addCacheBustingToBuild() {
  // Add ?v=4 query parameters to asset URLs to force cache refresh
  const indexPath = path.join("dist/public", "index.html");
  let html = await readFile(indexPath, "utf-8");
  
  // Add cache busting query parameters to JS and CSS assets
  html = html.replace(
    /src="(\/assets\/[^"]+\.js)"/g,
    'src="$1?v=4"'
  );
  html = html.replace(
    /href="(\/assets\/[^"]+\.css)"/g,
    'href="$1?v=4"'
  );
  
  await writeFile(indexPath, html);
  console.log("✓ Added cache busting parameters (?v=4) to assets");
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  // Add cache busting parameters after Vite build
  await addCacheBustingToBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Copy dist/ to api/ so Vercel serverless functions have everything they need
  // ALSO copy static files to /public so Vercel's static file hosting serves them
  console.log("packaging for Vercel...");
  try {
    await mkdir("api/dist", { recursive: true });
    
    // Copy server bundle
    await copyFile("dist/index.cjs", "api/dist/index.cjs");
    console.log("✓ Server bundle copied to api/dist/index.cjs");
    
    // Copy public (static) files to /public for Vercel's built-in static hosting
    await cp("dist/public", "public", { recursive: true, force: true });
    console.log("✓ Static files copied to /public/");
    
    // Also copy to api/dist/public as fallback for development
    await cp("dist/public", "api/dist/public", { recursive: true, force: true });
    console.log("✓ Static files copied to api/dist/public/ (fallback)");
  } catch (err) {
    console.warn("⚠ Warning: Could not package for Vercel:", err);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
