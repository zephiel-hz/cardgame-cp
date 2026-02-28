import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, mkdir, cp } from "fs/promises";
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

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

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
  console.log("packaging for deployment...");
  try {
    // Copy public (static) files to /public for Render and other platforms
    await cp("dist/public", "public", { recursive: true, force: true });
    console.log("✓ Static files copied to /public/");
    
    // For Vercel compatibility (if ever reverting): also copy to api/dist
    // Comment out if only using Render
    // await mkdir("api/dist", { recursive: true });
    // await copyFile("dist/index.cjs", "api/dist/index.cjs");
    // await cp("dist/public", "api/dist/public", { recursive: true, force: true });
    // console.log("✓ Vercel artifacts packaged");

  } catch (err) {
    console.warn("⚠ Warning: Could not package for Vercel:", err);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
