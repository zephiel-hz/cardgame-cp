# Railway Deployment Guide dengan Neon Database

Panduan lengkap untuk deploy aplikasi ke Railway dengan database Neon PostgreSQL.

## Prerequisites

- Akun [Railway.app](https://railway.app)
- Akun [Neon.tech](https://neon.tech)
- Git repository yang ter-setup

## Step 1: Setup Neon Database

1. Buka [console.neon.tech](https://console.neon.tech)
2. Buat project baru atau gunakan yang existing
3. Buat database baru (default biasanya `neondb`)
4. Copy koneksi string dari **Connection string** tab (pilih "Connection pooling" untuk best performance)
5. Simpan connection string ini - kamu akan membutuhkannya untuk Railway

Contoh connection string:
```
postgresql://user:password@ep-xxx.us-east-1.neon.tech/dbname?sslmode=require
```

## Step 2: Setup Database Schema (Local)

Sebelum deploy, pastikan schema sudah benar:

```bash
# Install dependencies
npm install

# Setup .env.local dengan Neon database URL
cp .env.example .env.local
# Edit .env.local dan isi DATABASE_URL dengan connection string dari Neon

# Push schema ke database
npm run db:push
```

## Step 3: Deploy ke Railway

### Opsi A: Via GitHub Connection (Recommended)

1. Push kode ke GitHub repository
2. Login ke [railway.app](https://railway.app)
3. Klik "New Project"
4. Pilih "Deploy from GitHub repo"
5. Authorize Railway dengan GitHub
6. Select repository ini
7. Railway akan auto-detect `package.json` dan `Procfile`

### Opsi B: Via CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login ke Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

## Step 4: Configure Environment Variables di Railway

Di Railway dashboard untuk project kamu:

1. Buka "Variables" tab
2. Tambah environment variables:
   - `DATABASE_URL`: Paste connection string dari Neon
   - `NODE_ENV`: `production`
   - `PORT`: Akan auto-set oleh Railway (biasanya 3000)

Atau gunakan Railway plugin:
1. Buka "+Create New" → "Database"
2. Cari "PostgreSQL" (atau connect Neon)
3. Railway akan auto-inject `DATABASE_URL`

## Step 5: Link Neon Database dengan Railway (Recommended)

Railway punya native integration dengan Neon:

1. Di Railway project, klik "+Create" → "Database"
2. Pilih "Neon"
3. Login dengan akun Neon kamu
4. Select database dari Neon
5. Railway akan automatically inject `DATABASE_URL`

## Step 6: Deploy & Verify

1. Push changes ke GitHub (jika pakai GitHub connection)
   ```bash
   git add .
   git commit -m "Add Railway deployment config"
   git push
   ```

2. Railway akan auto-deploy
3. Cek logs di Railway dashboard untuk errors

4. Jalankan database migrations:
   ```bash
   railway run npm run db:push
   ```

5. Test aplikasi di URL yang diberikan Railway

## Troubleshooting

### Build Gagal
- Check Railway build logs untuk error messages
- Pastikan `npm run build` works locally: `npm run build`
- Pastikan `dist/index.cjs` exists setelah build

### Database Connection Error
- Verify `DATABASE_URL` ada di Railway variables
- Test connection locally dulu dengan `npm run db:push`
- Check Neon IP whitelist settings (biasanya auto)
- Pastikan Neon connection string include `?sslmode=require`

### Port/Server Tidak Listening
- Check bahwa `NODE_ENV=production` di Railway
- Verify server logs dalam Railway dashboard
- Pastikan `HOST=0.0.0.0` di environment

### Avatar Upload Issues
Production menggunakan `/tmp/avatars` untuk avatar uploads:
- Railway ephemeral filesystem = file akan hilang saat restart
- Untuk persistent storage, gunakan Railway Disk atau external service

## Production Checklist

- [ ] Database schema sudah ter-push ke Neon
- [ ] `DATABASE_URL` di-set di Railway
- [ ] `NODE_ENV=production` di Railway
- [ ] Build test locally: `npm run build`
- [ ] Server running di port yang correct
- [ ] Static files serving correctly
- [ ] All routes accessible

## Useful Commands

```bash
# Deploy via CLI
railway up

# Check logs
railway logs

# SSH ke dyno
railway shell

# Migrate database
railway run npm run db:push

# View variables
railway variables

# Open app URL
railway open
```

## Rollback

Jika deployment gagal:
1. Cek Railway dashboard untuk previous deployments
2. Click "Redeploy" pada deployment sebelumnya
3. Atau revert git commit dan push lagi

## Cost Considerations

- **Neon**: Free tier includes 50GB storage, 1 project
- **Railway**: Free tier includes $5/month, pay as you go
- Avatar uploads di `/tmp` tidak persistent (use external storage for production)

---

Untuk bantuan lebih lanjut:
- [Railway Documentation](https://docs.railway.app)
- [Neon Documentation](https://neon.tech/docs)
