import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import crypto from "crypto";

// Log R2 configuration on startup
console.log("[R2] Initializing Cloudflare R2 configuration...");
console.log("[R2] Endpoint:", process.env.CF_R2_ENDPOINT);
console.log("[R2] Bucket:", process.env.CF_R2_BUCKET_NAME);
console.log("[R2] Public URL:", process.env.CF_R2_PUBLIC_URL);
console.log("[R2] Access Key ID set:", !!process.env.CF_R2_ACCESS_KEY_ID);
console.log("[R2] Secret Key set:", !!process.env.CF_R2_SECRET_ACCESS_KEY);

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CF_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.CF_R2_BUCKET_NAME || "chat-images";
const PUBLIC_URL_BASE = process.env.CF_R2_PUBLIC_URL || "https://images.example.com";

if (!process.env.CF_R2_ACCESS_KEY_ID || !process.env.CF_R2_SECRET_ACCESS_KEY || !process.env.CF_R2_ENDPOINT) {
  console.warn("[R2] ⚠️  WARNING: R2 credentials not fully configured! Images will not upload to R2.");
}

/**
 * Upload and compress image to Cloudflare R2
 * @param base64Data - Image data as base64 string (with data URI prefix)
 * @param mimeType - MIME type of the image
 * @returns URL to the uploaded image
 */
export async function uploadImageToR2(
  base64Data: string,
  mimeType: string
): Promise<string> {
  try {
    // Remove data URI prefix if present
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, "");

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64String, "base64");

    // Determine output format
    let format: "jpeg" | "png" | "webp" = "webp";
    if (mimeType.includes("png")) format = "png";
    else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) format = "jpeg";

    console.log(`[R2] Compressing image to ${format}...`);

    // Compress image using sharp
    const compressedBuffer = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(2048, 2048, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat(format, {
        quality: 80, // 80% quality for good balance
        progressive: true,
      })
      .toBuffer();

    console.log(
      `[R2] Image compressed: ${imageBuffer.length} → ${compressedBuffer.length} bytes`
    );

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString("hex");
    const filename = `chat-images/${timestamp}-${randomId}.${format}`;

    console.log(`[R2] Uploading to R2: ${filename}`);

    // Upload to R2
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: compressedBuffer,
        ContentType: `image/${format}`,
        CacheControl: "public, max-age=31536000", // 1 year cache
      })
    );

    // Construct public URL
    const imageUrl = `${PUBLIC_URL_BASE}/${filename}`;
    console.log(`[R2] ✓ Image uploaded: ${imageUrl}`);

    return imageUrl;
  } catch (error) {
    console.error("[R2] Error uploading image:", error);
    throw new Error("Failed to upload image to R2");
  }
}

/**
 * Generate a signed URL for temporary access (useful for private buckets)
 */
export function getImageUrl(filename: string): string {
  return `${PUBLIC_URL_BASE}/${filename}`;
}
