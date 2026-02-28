# 📱 PWA Phase 1 - Push Notifications Setup Guide

## Overview

This guide covers **Phase 1** implementation of push notifications with Progressive Web App (PWA) support for both Android and iOS platforms.

### What's Included
- ✅ **Web Push API** for Android browsers (Chrome, Firefox)
- ✅ **PWA Installation** support for iOS (Home Screen)
- ✅ **Notification Settings** UI for managing preferences
- 📅 **Phase 2** (Future): Native app wrappers using Capacitor for full iOS support

---

## 🤖 Android Browser (Chrome/Firefox)

### How it Works
1. User opens app in Android browser
2. User navigates to **Profile → Notifications**
3. Click **"Aktifkan Notifikasi"** button
4. Browser shows native permission dialog:
   ```
   Allow "https://yourdomain.com" to send notifications?
   [Block] / [Allow]
   ```
5. User clicks **Allow**
6. App subscribes to push notifications
7. User receives notifications for game events

### Setup for Users
```
1. Open app in Chrome or Firefox on Android
2. Profile → Scroll down → Notifications section
3. Click "Aktifkan Notifikasi"
4. Grant permission in browser dialog
5. Customize notification types (card used, card expired, etc.)
```

### What Works
- ✅ Push notification permission dialog
- ✅ Browser native notifications
- ✅ Notification sound and vibration
- ✅ Notification actions and click handling
- ✅ Background push delivery (via Service Worker)

---

## 🍎 iOS Safari (Browser)

### How it Works
iOS Safari does NOT support Web Push API (RFC 8030) due to Apple's restrictions.

However, iOS users can install the app as a PWA to get better notification support.

### Install as PWA on iOS

**Option 1: Share Menu (Easiest)**
1. Open app in Safari
2. Tap **Share** (bottom menu)
3. Scroll down → tap **Add to Home Screen**
4. Name the shortcut (default: "Card Game")
5. Tap **Add**

**Option 2: Manual Setup**
1. Open app in Safari
2. Settings (gear icon) → "Add to Home Screen"
3. Name the app
4. Tap **Add**

### After Installation

Once installed as PWA:
- App opens in standalone mode (full screen)
- Looks and feels like a native app
- Better performance and offline support
- Notifications will trigger when app is active

### Enable Notifications on iOS
1. After installing PWA, open the app
2. Go to **Profile → Notifications**
3. iOS will show notification permission dialog
4. Tap **Allow**
5. iOS will deliver notifications

### What Works on iOS PWA
- ✅ App installation on home screen
- ✅ Standalone fullscreen mode
- ✅ Offline functionality (cached pages)
- ✅ Notification permission dialog
- ✅ Notifications when app is active
- ⚠️ Background push (limited - only in iOS 16.4+)

### What Doesn't Work
- ❌ Background push notifications (**Apple limitation**)
- ❌ Web Push API (**Apple limitation**)

---

## 🧪 Testing Push Notifications

### Local Testing

**1. Test Web Push on Android Emulator/Device:**
```bash
# 1. Start development server
npm run dev

# 2. Open on Android device/emulator
# Navigate to http://YOUR_IP:5173

# 3. Go to Profile → Notifications
# 4. Click "Aktifkan Notifikasi"
# 5. Grant permission
```

**2. Test Notification Delivery:**

Use the backend push service to send test notifications:

```bash
# Terminal 1: Run server
npm run server

# Terminal 2: Send test notification
curl -X POST http://localhost:3000/api/notifications/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test notification",
    "url": "/"
  }'
```

---

## 🔧 Configuration

### Environment Variables Required

```env
# Web Push (VAPID keys)
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:admin@example.com

# Database
DATABASE_URL=postgresql://...

# Session
SESSION_SECRET=your-secret-key
```

### Generate VAPID Keys

If you haven't generated VAPID keys yet:

```bash
npx web-push generate-vapid-keys
```

Copy the output to your `.env` file.

---

## 📊 Platform Compatibility Matrix

| Feature | Android Chrome | Android Firefox | iOS Safari | iOS PWA |
|---------|---|---|---|---|
| **Web Push API** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **PWA Install** | ✅ Yes | ✅ Yes | ✅ Yes (Recent) | ✅ Yes |
| **Permission Dialog** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes (in app) |
| **Background Push** | ✅ Yes | ✅ Yes | ❌ No | ⚠️ Limited |
| **Offline Support** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Installation** | ✅ Easy | ✅ Easy | ✅ Moderate | ✅ Same as Web |

---

## 🎯 Phase 1 vs Phase 2

### Phase 1 (Current)
- ✅ Web Push for Android browsers
- ✅ PWA installation for all platforms
- ✅ Basic notification support
- 📱 **Target**: Android users with Chrome/Firefox

### Phase 2 (Future - Capacitor)
- 🔲 Native iOS push (APNs)
- 🔲 Native Android push (FCM)
- 🔲 Full background push support
- 🔲 Standalone native apps
- 📱 **Target**: iOS and Android users via App Store / Play Store

---

## 🐛 Troubleshooting

### Notification Permission Dialog Not Appearing

**Android:**
- Make sure you're using Chrome or Firefox
- Check that HTTPS is enabled (production only)
- Clear browser cache and cookies
- Try in incognito mode

**iOS PWA:**
- Must be installed as PWA first
- Open in the PWA app, not Safari
- Go to Profile → Notifications to see permission dialog

### Notifications Not Received

**Check:**
1. Permission granted? (Should show ✅ in UI)
2. VAPID keys configured? (Should not show "EXAMPLE_PUBLIC_KEY")
3. Backend running? (Push service needs to be deployed)
4. Valid subscription? (Check browser DevTools)

**Debug in Browser DevTools:**
```javascript
// Check Service Worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service Workers:', registrations);
});

// Check Push Subscription
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.getSubscription().then(subscription => {
    console.log('Push Subscription:', subscription);
  });
});
```

### PWA Not Installing on iOS

- iOS 13+ required for PWA
- Must be on HTTPS
- App must have proper manifest.json
- Try adding to home screen manually (Settings → Home Screen)

---

## 📈 User Flow Diagram

```
User Opens App
    ↓
[Profile Page]
    ↓
[Notifications Settings]
    ├─→ Android Browser?
    │   ├─→ Click "Aktifkan Notifikasi"
    │   ├─→ Browser shows permission dialog
    │   ├─→ User grants permission
    │   └─→ Subscribe to Web Push ✅
    │
    └─→ iOS Usuario?
        ├─→ Not installed as PWA?
        │   └─→ Show "Install PWA" guide
        ├─→ Installed as PWA?
        │   ├─→ Click "Aktifkan Notifikasi"
        │   ├─→ Safari shows permission dialog
        │   └─→ Subscribe (limited background) ✅
```

---

## 📚 Resources

- [Web Push API Spec](https://www.w3.org/TR/push-api/)
- [PWA Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [iOS PWA Limitations](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/)
- [Web Push for iOS](https://webkit.org/blog/12974/the-web-just-gets-better-with-web-push-for-web-apps-on-ios-and-ipados/)

---

## 🚀 Next Steps

1. **Deploy to Railway** with VAPID keys
2. **Test on Android** - verify push works
3. **Test on iOS** - install as PWA and verify
4. **Monitor** - check notification delivery rates
5. **Phase 2** (Optional) - Implement Capacitor for native apps

---

**Last Updated**: March 1, 2026
**Status**: Phase 1 Complete ✅
