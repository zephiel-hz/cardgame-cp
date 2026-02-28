# ⚡ Railway Setup Checklist - Quick Reference

Copy-paste checklist untuk setup aplikasi ke Railway dengan push notifications.

## 📋 Pre-Deployment Checklist

### 1. Generate VAPID Keys
```bash
npx web-push generate-vapid-keys
```
📌 **Save output** - Butuh di Step 5

### 2. Verify Neon Database
- [ ] Login ke https://console.neon.tech
- [ ] Database sudah dibuat
- [ ] Copy connection string (dengan `?sslmode=require`)

### 3. Verify Code Commit
```bash
git log --oneline -1  # Check latest commit
git push origin main  # Push ke GitHub
```

### 4. Login to Railway
Go to https://railway.app/dashboard

### 5. Create Project & Connect GitHub
- [ ] New Project → Deploy from GitHub repo
- [ ] Select `cardgame-cp` repository
- [ ] Wait for auto-build to complete

### 6. Add Environment Variables

Di Railway Dashboard → Variables tab, add:

```
DATABASE_URL              = postgresql://...?sslmode=require
VAPID_PUBLIC_KEY         = BC...xxxxx
VAPID_PRIVATE_KEY        = xxxx...xxxxx
VAPID_SUBJECT            = mailto:you@example.com
SESSION_SECRET           = <random-string>
NODE_ENV                 = production
```

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 7. Link Neon Database (Optional)
1. Dashboard → Variables → Connect Database
2. Choose Neon PostgreSQL
3. Select your database
4. Railway auto-inject DATABASE_URL

### 8. Deploy Trigger
- Push ke GitHub: Railway auto-deploy
- Or click "Deploy" button di Railway dashboard

### 9. Monitor Logs
```
Dashboard → Deployments → Latest → Logs

Tunggu sampai terlihat:
✅ [server] ✓✓✓ INITIALIZATION COMPLETE ✓✓✓
```

### 10. Test App
- Click URL di Railway dashboard
- Signup → Profile → Enable Notifications
- Allow browser notifications
- ✅ Should subscribe successfully

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check railway logs, ensure `npm run build` works locally |
| Database error | Verify DATABASE_URL in variables, test locally: `psql $DATABASE_URL` |
| No notifications | Check VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY set correctly |
| Port error | HOST must be `0.0.0.0` (Railway will set this) |
| Service won't start | Check all env vars present, verify NODE_ENV=production |

## 📞 If Still Stuck

Run these commands to test locally:

```bash
# Test build
npm ci && npm run build

# Test with Neon connection
DATABASE_URL="<neon-url>" npm run db:push

# View Neon logs
# Go to: console.neon.tech → Projects → Monitoring → Query Insights
```

## 📚 Full Documentation

- Complete setup: See `RAILWAY_SETUP.md`
- Push notifications: See `PUSH_NOTIFICATIONS_SETUP.md`
- Railway docs: https://docs.railway.app
- Neon docs: https://neon.tech/docs

---

**⏱️ Typical time to deploy: 5-10 minutes**

**Good luck! 🚀**
