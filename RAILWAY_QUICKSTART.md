# Quick Start: Deploy ke Railway + Neon

## TL;DR - 5 Langkah

### 1. Siapkan Database Neon
- Buat akun di [neon.tech](https://neon.tech)
- Buat database baru
- Copy connection string

### 2. Setup Lokal
```bash
npm install
cp .env.example .env.local
# Edit .env.local, paste DATABASE_URL dari Neon
npm run db:push  # Push schema ke Neon
```

### 3. Push ke GitHub
```bash
git add .
git commit -m "Add Railway deployment config"
git push origin main
```

### 4. Deploy ke Railway
- Buka [railway.app](https://railway.app)
- Create New Project → Deploy from GitHub
- Connect repository
- Railway auto-detect dan build

### 5. Set Environment Variables di Railway
- Buka project di Railway dashboard
- Variables → Tambah:
  - `DATABASE_URL` = connection string dari Neon
  - `NODE_ENV` = `production`

**Selesai!** ✅ Application akan auto-deploy dari setiap push ke GitHub.

## Config Files yang Sudah Ditambah

- ✅ `railway.json` - Railway deployment config
- ✅ `Procfile` - Process file configuration  
- ✅ `.env.example` - Environment variables template
- ✅ `package.json` - Updated start script
- ✅ `server/index.ts` - Fixed server listening

## Troubleshooting

Lihat `RAILWAY_DEPLOYMENT.md` untuk panduan lengkap dan troubleshooting.

## Deploy Methods

**Option 1: GitHub Connection (Recommended)**
- Railway akan auto-deploy setiap kali push ke GitHub
- Paling mudah untuk development

**Option 2: Railway CLI**
```bash
npm install -g @railway/cli
railway login
railway up
```

**Option 3: Manual Upload**
- Build lokal: `npm run build`
- Upload ke Railway via dashboard

---

**Status**: ✅ Ready for Railway deployment!
