# Cloudflare R2 Image Storage Integration Guide

## Overview
Images sent through the chat are now automatically:
1. **Compressed** using Sharp library (WebP format, 80% quality)
2. **Resized** to max 2048x2048px  
3. **Uploaded to Cloudflare R2** object storage
4. **Encrypted** alongside message content in the database

This replaces the inefficient base64 storage method.

## Setup Steps

### 1. Install Required Packages
```bash
npm install @aws-sdk/client-s3 sharp
```

### 2. Create Cloudflare R2 Bucket
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create a new bucket (e.g., `chat-images`)
3. Note your Account ID from the R2 overview page

### 3. Generate R2 API Credentials
1. In Cloudflare Dashboard → R2 → Settings
2. Click "Create API token"
3. Create an **API token** with the following permissions:
   - ✅ Object Read
   - ✅ Object Write
   - Scope: Specific buckets → `chat-images`

4. Copy the credentials:
   - **Access Key ID**
   - **Secret Access Key**

### 4. Get Your R2 Endpoint & Public URL
1. **R2 Endpoint** (S3 API):
   ```
   https://<account-id>.r2.cloudflarestorage.com
   ```
   Find your Account ID in R2 overview

2. **Public URL** (optional for private buckets):
   - If bucket is public: Use Cloudflare domain from bucket settings
   - If private: Use presigned URLs (currently code uses simple URL construction)

### 5. Configure Environment Variables
Add to your `.env` file:

```env
CF_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CF_R2_ACCESS_KEY_ID=your-api-token-access-key
CF_R2_SECRET_ACCESS_KEY=your-api-token-secret-key
CF_R2_BUCKET_NAME=chat-images
CF_R2_PUBLIC_URL=https://your-domain.com
```

### 6. (Optional) Configure Public Access
- Make bucket public for simpler URL construction
- Or implement presigned URLs for private bucket access

## How It Works

### Client Side
1. User selects image file
2. FileReader converts to base64 data URI
3. Sends: `{type: "image", data: "data:image/...", mimeType: "image/png"}`

### Server Side
1. Detects image JSON in message content
2. Extracts base64 data
3. **Sharp compresses**:
   - Format: WebP (better compression)
   - Quality: 80%
   - Max size: 2048x2048px
4. **Uploads to R2** with unique filename
5. **Replaces base64** with URL:
   ```json
   {type: "image", url: "https://...", mimeType: "image/webp"}
   ```
6. Stores in database (still encrypted)
7. Broadcasts to recipient via WebSocket

### Display
1. Client receives encrypted message
2. Decrypts content
3. Checks for JSON with `type: "image"` and `url` (or legacy `data`)
4. Displays image from R2 URL or base64 (backwards compatible)

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Storage** | Full base64 in DB | R2 Object Storage |
| **File Size** | ~1-5 MB per image | Compressed ~100-500 KB |
| **Database** | Bloated queries | Lean (~100 byte URLs) |
| **Cost** | Neon storage (expensive) | R2 (very cheap) |
| **Speed** | Slower page loads | CDN-backed R2 URLs |
| **Encryption** | Base64 + encryption | URL + encryption |

## Troubleshooting

### Package Installation Fails
```bash
# Clear npm cache
npm cache clean --force

# Try installing individually
npm install @aws-sdk/client-s3
npm install sharp
```

### Sharp Installation Issues on Windows
Sharp requires build tools. Install:
- Visual Studio Build Tools or
- node-gyp globally: `npm install -g node-gyp`

### R2 Upload Fails
- Check AWS SDK credentials in logs
- Verify bucket exists and permissions are correct
- Check R2_ENDPOINT format (must include `https://`)

### Images Not Displaying
- Ensure bucket is public or URLs are presigned
- Check CF_R2_PUBLIC_URL matches bucket domain
- Verify R2 bucket CORS settings if cross-domain

## Database Migration (Optional)
Old base64 messages remain in database and will still display (backwards compatible).
To reclaim storage space, you could optionally migrate old messages to R2.

## Files Modified
- `server/storage-r2.ts` - New R2 upload handler
- `server/routes.ts` - Updated sendMessage endpoint
- `client/src/components/chat-window.tsx` - Updated image rendering
- `.env.example` - Added R2 configuration

## Next Steps
1. Install packages: `npm install @aws-sdk/client-s3 sharp`
2. Set up Cloudflare R2 bucket and API credentials
3. Add environment variables to `.env`
4. Rebuild and test: `npm run build && npm run dev`
5. Send a test image to verify compression and upload
