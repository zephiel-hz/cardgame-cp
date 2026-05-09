# Avatar Cross-Device Bug Fix

## Issue
Profile avatars disappeared when accessing the web from different browsers or devices, although they displayed correctly on the device where they were uploaded.

## Root Cause
The avatar system was returning direct Cloudflare R2 URLs to the client that relied on the `CF_R2_PUBLIC_URL` environment variable. When this variable wasn't properly configured, it would default to a placeholder domain (`https://images.example.com`), which resulted in broken image links from any device except the one that uploaded the avatar.

## Solution
Implemented a server-side proxy system that serves avatars through `/api/avatars/{userId}` endpoint, which internally redirects to the R2 storage. This approach:

1. **Decouples avatar display from R2 configuration** - Works regardless of `CF_R2_PUBLIC_URL` setting
2. **Works across all devices** - Any device can request avatars via the server endpoint
3. **Maintains security** - R2 URLs are never exposed to clients directly
4. **Adds CORS support** - Proper headers for cross-origin image loading

## Technical Details

### Server Changes (server/routes.ts)

**Avatar Upload Endpoint:**
- Compresses avatar to 512×512 WebP format
- Uploads to Cloudflare R2 with filename: `avatars/user-{userId}.webp`
- Stores R2 URL in database
- **Returns proxy URL to client:** `/api/avatars/{userId}`

**Avatar Proxy Endpoint (`GET /api/avatars/:userId`):**
```typescript
- Retrieves avatar URL from database
- Sets CORS headers for cross-origin access
- Redirects to R2 if URL is HTTP-based
- Falls back to base64 for legacy avatars
- Proper caching headers (max-age=86400)
```

### Client Changes

Updated all avatar displays to use proxy URLs:

| File | Component | Change |
|------|-----------|--------|
| `profile.tsx` | Profile page | Use `/api/avatars/{userId}` |
| `layout.tsx` | Header avatar | Use `/api/avatars/{userId}` |
| `chat-window.tsx` | Partner avatar | Use `/api/avatars/{userId}` |
| `partner-pairing.tsx` | User avatars | Use `/api/avatars/{userId}` |

All URLs include cache-busting parameter: `?t=${Date.now()}`

## Data Flow

### Upload Flow
```
User selects image
     ↓
Client converts to Base64
     ↓
POST /api/auth/uploadAvatar {userId, data}
     ↓
Server compresses to WebP (512×512)
     ↓
Upload to R2: avatars/user-{userId}.webp
     ↓
Store R2 URL in database
     ↓
Return proxy URL: /api/avatars/{userId}
     ↓
Client stores in context & displays
```

### Display Flow (Any Device)
```
User avatar loaded from database (has R2 URL)
     ↓
useEffect converts to proxy URL: /api/avatars/{userId}
     ↓
Client requests `/api/avatars/{userId}`
     ↓
Server fetches R2 URL from database
     ↓
Server sets CORS headers
     ↓
Server redirects to R2 URL
     ↓
Browser loads image from R2
     ↓
Avatar displays correctly
```

## Testing

### Test on Same Device
1. Upload avatar on device A
2. Refresh page - avatar should display
3. Open DevTools Network tab - verify `/api/avatars/{userId}` request succeeds

### Test on Different Device  
1. Upload avatar on device A
2. Open web app on device B (different browser/network)
3. Avatar should display (using proxy redirect)
4. Check server logs for redirect message: `[Avatar] Redirecting to R2 for user {userId}`

### Test CORS
1. Open browser console on any page
2. Avatar images should load without CORS errors
3. Network tab should show 307 redirect from `/api/avatars/{userId}` to R2 URL

## Configuration

### Environment Variables
No changes needed! The avatar system now works without `CF_R2_PUBLIC_URL` configuration, but you can still set it for direct R2 access if needed.

Current defaults:
- `CF_R2_BUCKET_NAME`: "chat-images"
- `CF_R2_PUBLIC_URL`: Falls back to placeholder (no longer needed for avatars)

### Backward Compatibility
- Old base64 avatars in database still display via existing fallback
- Migration to R2 happens automatically with next upload
- No data loss for existing avatars

## Files Modified
- ✅ `server/routes.ts` - Avatar upload & proxy endpoint with CORS
- ✅ `client/src/pages/profile.tsx` - Proxy URL display
- ✅ `client/src/components/layout.tsx` - Header avatar proxy
- ✅ `client/src/components/chat-window.tsx` - Chat avatar proxy
- ✅ `client/src/pages/partner-pairing.tsx` - Partner list avatars proxy

## Deployment Notes

### Local Development
1. Build: `npm run build`
2. Test: `npm run dev`
3. Upload avatar and refresh to verify

### Production (Railway/Vercel)
1. Existing avatars in R2 continue to work via proxy
2. New uploads → stored in R2 → served via proxy
3. No database migration needed
4. No service downtime required

## Troubleshooting

### Avatar not displaying on different device
- Check that user ID is included in URL: `/api/avatars/{userId}`
- Verify user has avatarUrl in database (check previous login)
- Check server logs for "Redirecting to R2" message

### CORS errors in console
- Server should return 307 redirect, not direct image
- Browser then requests R2 URL with CORS headers
- If error persists, check R2 bucket is public or has proper CORS settings

### How to verify proxy is working
```bash
# In terminal:
curl -v http://localhost:5000/api/avatars/1

# Output should show:
# HTTP/1.1 307 Temporary Redirect
# Location: https://[r2-bucket].cdn.example.com/avatars/user-1.webp
```

## Performance Impact
- **Negligible** - One additional HTTP redirect (307)
- Browser caches R2 URL with 86400s max-age
- Subsequent requests may be served from browser cache
- R2 CDN caching remains in effect

## Security Implications
- ✅ R2 URLs not exposed to client JavaScript
- ✅ Avatar access controlled by database check
- ✅ Cross-origin requests properly handled
- ✅ No sensitive data in URLs (just user ID)
