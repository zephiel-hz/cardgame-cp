# Full Translation Task - Remaining Work

## ✅ COMPLETED
- `tsconfig.json` - Fixed JSX config to `react-jsx`
- `main.tsx` - Added I18nextProvider wrapper
- `locales/en.json` - Comprehensive English translations (800+ strings)
- `locales/id.json` - Comprehensive Indonesian translations (800+ strings)
- `login.tsx` - Added `useTranslation` hook import
- `gacha.tsx` - Added `useTranslation` hook import and replaced 5+ major strings, buttons
- `chat-window.tsx` - Already done (25+ strings)
- `trading.tsx` - Already done (2+ strings)
- `inventory.tsx` - Already done (4+ strings)
- `profile.tsx` - Language switcher button uses `t('common.switchLanguage')`

## 🔴 CRITICAL REMAINING - login.tsx (20+ strings)

### Error Messages & Toast Titles
```
"Error" → t('auth.errors.error') 
"Masukkan PIN" → t('auth.errors.error') or custom key
"Login Gagal" → t('auth.errors.loginFailed')
"PIN salah" → "Invalid PIN" / create custom key
"Gagal login. Coba lagi." → t('errors.somethingWentWrong')
"Isi email terlebih dahulu" → create auth.errors.fillEmail
"Success" → t('common.success')
"Kode verifikasi dikirim ke email Anda" → t('auth.registerForm.verifyEmailDescription')
"Gagal mengirim kode verifikasi" → t('auth.errors.error')
"Isi token verifikasi dari email Anda" → t('auth.registerForm.enterVerificationCode')
"Token verifikasi salah atau kadaluarsa" → create auth.errors.invalidToken
"Gagal memverifikasi email" → t('auth.errors.error')
"Isi username dan PIN" → t('auth.errors.fillAll')
"Email harus diverifikasi terlebih dahulu" → t('auth.registerForm.emailVerificationRequired')
"PIN minimal 4 digit" → t('auth.registerForm.pinMinimal')
"Isi semua field yang diperlukan" → t('auth.errors.fillRequired')
"Register Gagal" → t('auth.errors.registerFailed')
"Username mungkin sudah digunakan" → t('auth.registerForm.usernameTaken')
"Gagal register. Coba lagi." → t('auth.registerForm.registerError')
"Username atau PIN salah" → custom key:  auth.errors.invalidCredentials
```

### UI Text & Labels
```
"Pilih akun untuk melanjutkan" → create auth.savedAccounts.selectAccount
"Masuk {account.username}" → t('auth.login', {username: account.username})
"Masuk ke Akun Lain" → t('auth.savedAccounts.loginAnother')
"Daftar Akun Baru" → t('auth.registerForm.title')
"PIN (4 Digit)" → t('auth.pinDigits')
"Masukkan PIN kamu untuk login" → t('auth.registerForm.pinLoginSubtitle')
"Masuk Sekarang" → t('auth.loginNow')
"Kembali ke Akun Tersimpan" → t('auth.backToLogin')
"Memverifikasi..." → t('common.processing') or auth.verifying
"Nama Pengguna" → t('auth.username')
"Masukkan username kamu" → t('auth.enterUsername')
"PIN (4 Digit)" → t('auth.pinDigits')
"Masukkan PIN kamu" or placeholder → t('auth.enterPIN')
"Login" → t('auth.login')
"Masukkan username dan PIN kamu" → t('auth.loginForm.subtitle')
"Belum punya akun? Daftar di sini" → t('auth.loginForm.noAccount')
"Daftar Akun Baru" → t('auth.registerForm.title')
"Buat akun untuk bermain Gacha Kartu" → t('auth.registerForm.subtitle')
"Email (Wajib Verifikasi)" → t('auth.registerForm.emailLabel')
"Terverifikasi" → t('auth.registerForm.verified')
"Kirim Kode Verifikasi" → t('auth.registerForm.sendCode')
"Mengirim..." → t('common.processing')
"Verifikasi" → t('common.accept') or auth.registerForm.verifyCode
"Nama Pengguna" → t('auth.username')
"Minimal 3 karakter" → create auth.registerForm.minimumChars
"Jenis Kelamin" → t('auth.gender')
"Laki-laki" → t('auth.male')
"Perempuan" → t('auth.female')
"Lainnya" → t('auth.other')
"Buat Akun" → t('auth.registerForm.createAccount')
"Membuat Akun..." → t('common.processing')
"Kembali ke Login" → t('auth.backToLogin')
"Gacha Kartu Bareng Pasangan" → create auth.title or game.title
"Masuk untuk kumpulkan kartu kejutan! 💕" → create auth.subtitle
"Masuk ke Akun Lain" → create auth.savedAccounts.loginAnother
```

## 🟡 Gacha.tsx (remaining ~10 strings)

### Already Done
- Title → `t('gacha.title')`
- Subtitle → `t('gacha.subtitle')`
- "Sisa Tarikan" → `t('gacha.remainingPulls')`
- "Reset Dalam" → `t('gacha.timeToReset')`
- "Tarik Kartu Sekarang" → `t('gacha.pullNow')`
- Error messages in toast use t()

### Remaining
```
"Gagal" → t('common.error')
"Tidak bisa menarik kartu" → t('errors.failedPull')
"Oops!" → t('gacha.error') or common.error
Info section text:
- "Informasi Gacha" → t('gacha.info.title')
- "Reset Gacha:" → t('gacha.info.resetTime')
- "Pukul 06:00 & 18:00 WIB" → t('gacha.info.resetTimes')
- "Tarikan/Periode:" → t('gacha.info.pullsPerPeriod')
- "Maksimal 2x per periode" → t('gacha.info.maxPulls')
- "Komposisi Rate:" → t('gacha.info.rates')
- "SSR: 10%" → t('gacha.pullRate.ssrRate')
- "Epic: 15%" → t('gacha.pullRate.epicRate')
- "Rare: 25%" → t('gacha.pullRate.rareRate')
- "Common: 50%" → t('gacha.pullRate.commonRate')
- "SSR Notification..." → t('gacha.info.ssrNotification')
```

## 🔴 active-cards.tsx (8+ strings)

```
"Belum Ada Kartu Aktif" → t('activeCards.noActiveCards')
"Belum Ada Mitra" → t('common.noPartner')
"Cari Mitra" → t('partnership.findPartner')
"Kartu Saya" → t('activeCards.myCards')
"Kartu {{partner}}" → t('activeCards.partnerCards', {partner: name})
"Status Saat Ini" → t('activeCards.currentStatus')
"Kartu Aktif" (page title) → t('activeCards.title')
```

## 🔴inventory.tsx (remaining ~15 strings)

```
"Koleksi Kartu" (title) → t('inventory.title')
"Cari nama atau deskripsi..." → t('inventory.searchPlaceholder')
"Filter" → t('common.filter')
Dropdowns already done (Sort options use t())
"Detail Kartu" → t('inventory.cardDetails')
"Gunakan" → t('gallery.use') or t('inventory.use')
"Tutup" → t('common.close')
"Konfirmasi Penggunaan Kartu" → t('inventory.confirmation')
"Yakin ingin menggunakan kartu ini?" → t('inventory.confirmUseCard')
"Mengonfirmasi..." → t('common.processing')
"Berhasil!" → t('common.success')
"Kartu telah digunakan" → t('inventory.cardUsed')
"Gagal" → t('common.error')
"Gagal menggunakan kartu" → t('inventory.failedToUse')
"Koleksi Kosong" → t('inventory.empty')
"Kamu belum punya kartu" → t('inventory.noCards')
```

## 🔴 profile.tsx (remaining ~20 strings after language button)

```
"🔐 Ubah PIN" → already hardcoded in t()
"Kelola PIN keamanan akun Anda" → t('profile.manageSecurityPin')
"Jenis Kelamin" → t('auth.gender')
Error messages (in validation):
- "PIN Lama harus 4 digit" → t('profile.errors.oldPinMust')
- "PIN Baru harus 4 digit" → t('profile.errors.newPinMust')
- "PIN Baru tidak cocok" → t('profile.errors.pinMustMatch')
- "PIN Baru harus berbeda dari PIN Lama" → t('profile.errors.pinMustDifferent')
Success messages:
- "Berhasil" → t('common.success')
- "PIN berhasil diubah!" → t('profile.success.pinChanged')
- "Foto berhasil diunggah!" → t('profile.success.photoUploaded')
- "Foto profil berhasil dihapus!" → t('profile.success.photoDeleted')
Modal titles:
- "Ubah PIN" → t('profile.changePinModal.title')
- "Ubah Email" → t('profile.changeEmailModal.title')
Form labels:
- "PIN Saat Ini" → t('profile.changePinModal.oldPin')
- "PIN Baru" → t('profile.changePinModal.newPin')
- "Konfirmasi PIN Baru" → t('profile.changePinModal.confirmNewPin')
- "Simpan PIN Baru" → t('profile.changePinModal.save')
- "Menyimpan..." → t('common.processing')
```

## 🔴 trading.tsx (remaining ~20 strings)

```
"Tukar Kartu" (page title) → t('game.trading')
"Terhubung dengan {{username}}" → t('trading.connectedWith', {username})
"Pastikan Penawaranmu" → t('trading.confirmOffer')
"Cek dulu sebelum kirim ke {{partner}}" → t('trading.checkBefore', {partner})
"Kartu yang ditawarkan:" → t('trading.offeredCards')
"Pilih penawaran Anda" → t('trading.selectYourOffer')
"({{count}} dipilih)" → t('trading.selected', {count})
Tab labels:
- "Permintaan Baru" → t('trading.newRequests') or create
- "Riwayat Pertukaran" → t('trading.tradeHistory')
Empty states:
- "Tidak Ada Tawaran" → t('trading.noOffers')
- "Tidak Ada Riwayat" → t('trading.noHistory')
Buttons:
- "Tolak" → t('common.reject')
- "Terima" → t('common.accept')
- "Batalkan Tawaran" → t('trading.cancelOffer')
Confirmation dialogs and messages
```

## 🔴 partner-pairing.tsx (30+ strings)

```
"Pasangan Anda" → t('partnership.title')
"Mitra Anda" → t('partnership.yourPartner')
"Cari Mitra" → t('partnership.findPartner')
"Kirim Permintaan" or "Kirim Permintaan Pasangan" → t('partnership.sendRequest')
"Permintaan dari Mitra" → t('partnership.partnerRequests')
"Permintaan Menunggu" → t('partnership.pendingRequests')
"Terima" → t('common.accept')
"Tolak" → t('common.reject')
"Hapus Kemitraan" → t('partnership.remove')
"Alasan" → t('partnership.reason')
Error/Success toasts
```

## 🔴 chat.tsx (3 remaining strings)

```
"Belum Ada Mitra" → t('common.noPartner')
"Anda tidak memiliki mitra untuk berchat" → t('chat.noPartner') or partnership
"Cari Mitra" → t('partnership.findPartner')
```

## 🔴 not-found.tsx (2 strings)

```
"404 - Halaman Tidak Ditemukan" → t('notFound.title')
"Halaman yang Anda cari tidak ditemukan" → t('notFound.message')
"Kembali ke Beranda" → t('notFound.goHome')
```

## ⚙️ STRATEGY TO COMPLETE

### Phase 1 (CRITICAL)
1. **login.tsx** - Complete all 40+ string replacements (most important - users see first)
2. **gacha.tsx** - Complete remaining strings
3. **active-cards.tsx** - Complete 8 strings

### Phase 2 (HIGH)
4. **inventory.tsx** - Complete remaining 15 strings  
5. **profile.tsx** - Complete remaining 20 strings
6. **trading.tsx** - Complete remaining 20 strings

### Phase 3 (STANDARD)
7. **partner-pairing.tsx** - Complete 30+ strings
8. **chat.tsx** - Complete 3 strings
9. **not-found.tsx** - Complete 2 strings

### Phase 4 (VERIFICATION)
10. Run `npm run check` to verify TypeScript compilation
11. Start dev server: `npm run dev`
12. Test language switching on all pages
13. Verify all strings translate correctly

## MISSING TRANSLATION KEYS TO ADD

Add these to both en.json and id.json if needed:
```json
"auth": {
  "errors": {
    "fillEmail": "Please fill in email first",
    "fillAll": "Please fill all fields",
    "fillRequired": "Please fill in all required fields",
    "invalidToken": "Invalid or expired verification token",
    "invalidCredentials": "Username or PIN is incorrect"
  },
  "back ToLogin": "← Back to Login",
  "savedAccounts": {
    "selectAccount": "Select account to continue", 
    "loginAnother": "Login to Different Account"
  },
  "registerForm": {
    "pinLoginSubtitle": "Enter your PIN to login",
    "usernameTaken": "Username may already be in use",
    "emailVerificationRequired": "Email must be verified first",
    "pinMinimal": "PIN must be at least 4 digits",
    "minimumChars": "Minimum 3 characters",
    "verified": "Verified"
  }
},
"gacha": {
  "error": "Failed to get gacha",
  "info": {...pull rate details}
},
"trading": {
  "confirmOffer": "Confirm Your Offer",
  "checkBefore": "Check before sending to {{partner}}",
  "offeredCards": "Offered Cards",
  "selectYourOffer": "Select Your Offer",
  "selected": "({{count}} selected)",
  "cancelOffer": "Cancel Offer"
},
"notFound": {...}
```

## TIME ESTIMATE
- login.tsx: 20 minutes
- gacha.tsx: 10 minutes
- active-cards.tsx: 5 minutes
- inventory.tsx: 10 minutes
- profile.tsx: 15 minutes
- trading.tsx: 15 minutes
- partner-pairing.tsx: 20 minutes
- chat.tsx: 2 minutes
- not-found.tsx: 2 minutes
- Adding missing keys: 10 minutes
- **TOTAL: ~109 minutes (~2 hours)**

## QUICK WINS
- Use multi_replace_string_in_file for pages with many replacements
- Group similar replacements together
- Test after each major page is completed

---

**Status**: Infrastructure complete ✅ | Translation keys ready ✅ | Now needs systematic string replacement on each page
