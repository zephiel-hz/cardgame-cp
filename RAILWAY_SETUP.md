# Railway Deployment Setup - Updated with Push Notifications

Panduan lengkap untuk setup aplikasi di Railway dengan database Neon, termasuk fitur push notifications terbaru.

## 📋 Requirements

- Akun [Railway.app](https://railway.app)
- Akun [Neon.tech](https://neon.tech) (untuk PostgreSQL)
- GitHub repository (optional tapi recommended)

## 🚀 Step-by-Step Setup

### Step 1: Generate VAPID Keys (untuk Push Notifications)

Run local commands untuk generate VAPID keys:

```bash
# Install dependencies dulu
npm install

# Generate VAPID keys (hanya perlu dilakukan sekali)
npx web-push generate-vapid-keys
```

Output akan terlihat seperti:
```
Public Key: BCxxx...xxxxx
Private Key: xxxx...xxxxx
```

**💾 Simpan kedua key ini - akan dibutuhkan di Step 4**

### Step 2: Verifikasi Database di Neon

1. Login ke [console.neon.tech](https://console.neon.tech)
2. Buat project baru atau gunakan existing project
3. Buat database baru (atau gunakan default `neondb`)
4. Copy **Connection String** (lihat di tabel, copy yang dengan `?sslmode=require`)

Contoh format:
```
postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
```

### Step 3: Deploy ke Railway

#### Option A: Via GitHub (Recommended)

1. Pastikan latest code sudah di-push ke GitHub:
```bash
git status  # Verifikasi semua changes committed
git log --oneline -1  # Check latest commit
```

2. Buka [railway.app](https://railway.app)

3. Create New Project → "Deploy from GitHub repo"

4. Authorize Railway dengan GitHub account

5. Select repository `cardgame-cp`

6. Railway akan otomatis detect dan start building

#### Option B: Via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy (dari repo root)
railway up
```

### Step 4: Configure Environment Variables di Railway

1. Buka [Railway Dashboard](https://railway.app/dashboard)
2. Click project Anda
3. Go to **Variables** tab
4. Add these variables:

```
DATABASE_URL              = <connection string dari Neon Step 2>
VAPID_PUBLIC_KEY         = <public key dari Step 1>
VAPID_PRIVATE_KEY        = <private key dari Step 1>
VAPID_SUBJECT            = mailto:your-email@example.com
NODE_ENV                 = production
SESSION_SECRET           = <generate-random-string> atau gunakan hasil: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generator SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Link Neon Database dengan Railway (Optional but Recommended)

Railway punya native integration dengan Neon:

1. Di Railway project, click **Variables** →  **Connect Database**
2. Pilih **Neon PostgreSQL**
3. Login dengan akun Neon
4. Select database
5. Railway akan otomatis inject `DATABASE_URL`

Jika menggunakan cara ini, database connection sudah otomatis configured.

### Step 6: Deploy & Verify

1. Jika pakai GitHub connection, push ke main branch:
```bash
git push origin main
```
Railway akan auto-deploy dari push.

2. Buka Railway dashboard, check **Deployments** tab

3. Tunggu build selesai, lihat logs untuk errors

4. Verify di logs:
```
[server] ✓✓✓ INITIALIZATION COMPLETE ✓✓✓
```

5. Test aplikasi di URL yang diberikan Railway

### Step 7: First Time Database Setup

Saat pertama kali deploy, database tables akan otomatis dibuat melalui:

```bash
npm run db:push
```

Proses ini harus berjalan automatic saat app startup. Jika manual migration diperlukan:

```bash
railway run npm run db:push
```

## 🔄 Troubleshooting

### Build Gagal

**Error: `npm run build` fails**

```bash
# Test build locally dulu
npm ci          # Clean install
npm run check   # Type check
npm run build   # Build
```

**Check Railway logs:**
1. Dashboard → Project → Deployments
2. Click latest deployment
3. Lihat Build Logs untuk error details

### Database Connection Error

**Error: `Error: connect ECONNREFUSED`**

1. Verify `DATABASE_URL` di Railway variables (copy-paste lagi)
2. Pastikan Neon database aktif (check di neon.tech console)
3. Test connection locally:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Service tidak start

**Error: `Service failed to start` atau timeout**

Check logs untuk error:
- Go to Railway dashboard → Variables/Deployments
- Lihat Real-time logs output
- Common issues:
  - `VAPID keys not configured` - Add VAPID keys di variables
  - `DATABASE_URL not set` - Check database variable
  - `Port not listening` - Check HOST=0.0.0.0

### Migration failed

**Error saat `npm run db:push`**

```bash
# Test migration locally dengan connection string Neon
DATABASE_URL="<neon-url>" npm run db:push

# Atau manual SSH ke Railway
railway shell
npm run db:push
```

## 📊 Monitoring

### View Logs di Railway

```bash
# Real-time logs
railway logs -f

# Last 100 lines
railway logs --lines 100

# Specific service
railway logs -s web
```

### Check Running Status

Dashboard → Project → Services → Web Service → Logs tab

## 🔐 Security Checklist

- [ ] SESSION_SECRET adalah random string yang unik
- [ ] VAPID_PRIVATE_KEY tidak pernah di-share/de-commit
- [ ] DATABASE_URL pakai HTTPS connection
- [ ] NODE_ENV = `production`
- [ ] .env.local tidak di-commit ke git

## 📝 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| DATABASE_URL | ✅ | PostgreSQL connection string | `postgresql://...` |
| VAPID_PUBLIC_KEY | ✅ | Push notification public key | `BCxxx...` |
| VAPID_PRIVATE_KEY | ✅ | Push notification private key | `xxxx...` |
| VAPID_SUBJECT | ✅ | Push notification subject | `mailto:your@email.com` |
| NODE_ENV | ✅ | Environment | `production` |
| PORT | ❌ | Server port | (auto-set by Railway) |
| HOST | ❌ | Server host | (auto-set to 0.0.0.0) |
| SESSION_SECRET | ✅ | Session encryption key | (random string) |

## 🔄 Update Flow

Setiap kali ada update:

1. Test locally:
```bash
npm run build
npm run start
```

2. Push ke GitHub:
```bash
git add .
git commit -m "your message"
git push origin main
```

3. Railway otomatis deploy dari push.

4. Monitor logs:
```bash
railway logs -f
```

## 📱 Test Push Notifications

Setelah deploy:

1. Buka aplikasi di browser
2. Go to Profile/Settings
3. Click "Enable Notifications"
4. Browser akan ask permission
5. Allow notifications
6. Subscribe successful jika tidak ada error

Untuk test send:
```bash
railway run node -e "const {pushNotificationService} = require('./dist/index.cjs').push; pushNotificationService.notifyUser(1, {title: 'Test', body: 'Works!'})"
```

## 🆘 Support

- [Railway Documentation](https://docs.railway.app)
- [Neon Documentation](https://neon.tech/docs)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

---

**Status**: ✅ Ready for Railway deployment with push notifications!

Updated: March 2026
