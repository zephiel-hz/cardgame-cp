# Quick Start Guide - After Implementation

## 🚀 Getting Started

### 1. Setup Environment
Create a `.env` or `.env.local` file in the project root:
```env
# For Local PostgreSQL (original setup)
DATABASE_URL=postgresql://user:password@localhost:5432/cardgame

# OR for Supabase (new recommended setup)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[YOUR-SUPABASE-HOST]:5432/postgres
```

### 2. Initialize Database
```bash
npm run db:push
```

### 3. Start Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:5000`

---

## 📋 What's New - Quick Reference

### ✅ Bug Fixes
| Bug | Status | How to Verify |
|-----|--------|---------------|
| Profile name not updating on login | Fixed | Change username in profile, see it update on login page |
| Card usage notifications | Fixed | Use a card from inventory, check notification appears |

### ✨ Feature Changes  
| Feature | What Changed | How to Use |
|---------|-------------|-----------|
| Avatar Upload | URL → File Explorer | Click avatar on profile page to select image |
| SSR Card Color | Basic → Rainbow | Pull SSR card to see animated rainbow gradient |

### 🎁 New Features
| Feature | What It Does | Where Used |
|---------|-------------|-----------|
| Duration Formatting | Converts minutes to hours | All card displays (e.g., "5m", "1h 30m") |
| Supabase Integration | Ready for cloud database | Set DATABASE_URL and run migrations |

---

## 🔗 Key API Endpoints (New)

### Get All Users
```
GET /api/auth/users
Response: Array of user objects
```

### Upload Avatar
```
POST /api/auth/upload-avatar
Body: { userId, filename, data (Base64) }
Response: { avatarUrl: "/avatars/avatar_[id]_[timestamp].jpg" }
```

---

## 📁 File Structure - Important Locations

```
Content-Manager/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── login.tsx          [UPDATED] Dynamic user loading
│       │   └── profile.tsx         [UPDATED] File upload input
│       ├── components/
│       │   └── card-display.tsx    [UPDATED] Rainbow SSR, duration formatting
│       └── lib/
│           └── utils.ts            [UPDATED] Added formatDuration()
├── server/
│   ├── routes.ts                   [UPDATED] New endpoints
│   ├── storage.ts                  [UPDATED] getAllUsers() method
│   ├── static.ts                   [UPDATED] Serve avatars
│   └── index.ts                    [UPDATED] Increased payload limit
├── shared/
│   └── routes.ts                   [UPDATED] New route definitions
├── public/
│   └── avatars/                    [NEW] Uploaded avatar files
├── SUPABASE_SETUP.md              [NEW] Supabase integration guide
└── IMPLEMENTATION_SUMMARY.md      [NEW] Detailed implementation docs
```

---

## 🧪 Testing Checklist

- [ ] **Login Page** - Click profile buttons to verify usernames load dynamically
- [ ] **Profile Page** - Click avatar and upload image from file explorer
- [ ] **Card Duration** - Verify cards show formatted duration (e.g., "1h 30m")
- [ ] **SSR Cards** - Pull an SSR card and see rainbow gradient animate
- [ ] **Notifications** - Use a card with second user and see toast notification
- [ ] **Supabase** - Test with Supabase DATABASE_URL (optional)

---

## 🐛 Common Issues & Solutions

### Avatar Upload Not Working
```
✓ Check if public/avatars directory exists
✓ Verify server has write permissions
✓ Check browser console for error details
```

### Users Not Loading on Login
```
✓ Verify database has user records
✓ Check network tab - is /api/auth/users returning data?
✓ Restart dev server
```

### Duration Shows Wrong Format
```
✓ Check card durationMinutes value in database
✓ formatDuration() accepts integer minutes only
✓ Values under 60m show as "Xm", 60+ as "Xh Ym"
```

### Supabase Connection Failed
```
✓ Verify DATABASE_URL is correct (check password!)
✓ Test connection with: psql [DATABASE_URL]
✓ Check Supabase project is running (not paused)
✓ See SUPABASE_SETUP.md for detailed troubleshooting
```

---

## 🎨 Customization Tips

### Change SSR Rainbow Gradient Colors
Edit in `card-display.tsx`:
```typescript
// Line ~24 - Modify gradient colors
background: linear-gradient(45deg, #color1, #color2, ...);
```

### Change Avatar Upload Size Limit
Edit in `server/index.ts`:
```typescript
// Line ~21 - Change from 50mb to desired size
limit: "100mb",
```

### Modify Duration Format
Edit in `client/src/lib/utils.ts`:
```typescript
export function formatDuration(minutes: number): string {
  // Customize the output format here
}
```

---

## 📚 Documentation

- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Complete technical details
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Supabase integration guide
- **[package.json](./package.json)** - Dependencies and scripts
- **[server/routes.ts](./server/routes.ts)** - All API endpoints

---

## 🚢 Deployment Notes

### Before Deploying
- [ ] Set `NODE_ENV=production`
- [ ] Configure `DATABASE_URL` to production database
- [ ] Run `npm run build`
- [ ] Create `public/avatars` directory on server
- [ ] Ensure server has write permissions to avatar directory

### For Supabase
- [ ] Create Supabase project
- [ ] Get connection string
- [ ] Run `npm run db:push` in production environment
- [ ] No additional setup needed - just works!

---

## 💡 Tips & Tricks

**Speed up avatar uploads**: Compress images before upload
```javascript
// Client-side compression before Base64 encoding
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// ... resize image and reduce quality
```

**Monitor database queries**: Check Supabase dashboard for slow queries

**Debug WebSocket**: Open DevTools Network tab, filter by "ws"

**Test without UI**: Use curl to test endpoints:
```bash
curl http://localhost:5000/api/auth/users
```

---

## 📞 Support Resources

- **Drizzle ORM**: https://orm.drizzle.team/docs/get-started
- **Supabase Docs**: https://supabase.com/docs
- **Express.js**: https://expressjs.com/
- **React**: https://react.dev/

---

**Version**: 1.0.0  
**Last Updated**: February 27, 2026  
**Status**: Ready for Production ✅
