# Push Notification Setup Guide

Fitur push notifications untuk mengirim notifikasi ke user saat ada kartu yang digunakan atau kadaluarsa.

## Features

- ✅ Web Push API (browsers, PWA, mobile browsers)
- ✅ Service Worker untuk handling notifications
- ✅ Database storage untuk subscriptions
- ✅ Notification preferences per user
- ✅ Real-time notifications saat kartu digunakan/kadaluarsa
- ✅ Cross-platform support (web, Android, iOS browsers)

## Setup

### 1. Install Dependencies

```bash
npm install
```

Package `web-push` sudah ditambahkan ke `package.json`.

### 2. Generate VAPID Keys

VAPID keys diperlukan untuk Web Push API. Generate keys menggunakan:

```bash
npx web-push generate-vapid-keys
```

Output akan terlihat seperti:

```
Public Key: BCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Setup Environment Variables

Tambahkan ke `.env.local` atau `.env.production`:

```env
# Push Notifications
VAPID_PUBLIC_KEY=<your-public-key-from-step-2>
VAPID_PRIVATE_KEY=<your-private-key-from-step-2>
VAPID_SUBJECT=mailto:your-email@example.com
```

### 4. Database Migration

Push notification tables akan otomatis dibuat ketika:

```bash
npm run db:push
```

Ini akan membuat 2 table baru:
- `push_subscriptions` - Store user push subscriptions
- `notification_preferences` - Store user notification preferences

### 5. Register Service Worker

Service Worker (`/public/sw.js`) akan otomatis di-register oleh `usePushNotifications` hook saat user mengakses app.

## Usage

### Frontend - Subscribe to Notifications

Gunakan hook `usePushNotifications` di component:

```tsx
import { usePushNotifications } from '@/hooks/use-push-notifications';

export function NotificationSettings() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return <p>Notifikasi tidak didukung di browser ini</p>;
  }

  return (
    <div>
      {isSubscribed ? (
        <button onClick={unsubscribe} disabled={isLoading}>
          Matikan Notifikasi
        </button>
      ) : (
        <button onClick={subscribe} disabled={isLoading}>
          Aktifkan Notifikasi
        </button>
      )}
    </div>
  );
}
```

### Backend - Send Notifications

Gunakan `pushNotificationService` untuk mengirim notifikasi:

```typescript
import { pushNotificationService } from './push-notifications';

// Notify user ketika kartu digunakan
await pushNotificationService.notifyCardUsed(userCardId, userName, cardName);

// Notify user ketika kartu akan expired
await pushNotificationService.notifyCardExpiring(userId, cardName, expiresAt);

// Notify user ketika kartu expired
await pushNotificationService.notifyCardExpired(userId, cardName);

// Broadcast notification
await pushNotificationService.broadcastNotification(
  { title: 'Promos!', body: 'Gratis gacha hari ini!' },
  (prefs) => prefs.promotions === true  // Filter user dengan promotions enabled
);
```

## API Endpoints

### Subscribe to Push

```
POST /api/notifications/subscribe
Body: {
  userId: number,
  subscription: {
    endpoint: string,
    keys: {
      auth: string,
      p256dh: string
    }
  }
}
```

### Unsubscribe from Push

```
POST /api/notifications/unsubscribe
Body: {
  userId: number,
  endpoint: string
}
```

### Get Notification Preferences

```
GET /api/notifications/preferences/:userId
Response: {
  cardUsed: boolean,
  cardExpired: boolean,
  cardDropped: boolean,
  promotions: boolean
}
```

### Update Notification Preferences

```
PATCH /api/notifications/preferences
Body: {
  userId: number,
  cardUsed?: boolean,
  cardExpired?: boolean,
  cardDropped?: boolean,
  promotions?: boolean
}
```

### Get VAPID Public Key

```
GET /api/notifications/vapid-key
Response: {
  vapidPublicKey: string
}
```

## Integration dengan Card Events

### Saat Kartu Digunakan

Di `server/routes.ts` pada endpoint `inventory/use`:

```typescript
// After card is used successfully
const otherUserIds = (await storage.getAllUsers())
  .filter((u) => u.id !== userId)
  .map((u) => u.id);

await pushNotificationService.notifyCardUsed(userCard.id, user.username, userCard.card.name, otherUserIds);
```

### Saat Kartu Kadaluarsa

Buat background job untuk check expired cards:

```typescript
// Setiap menit, check kartu yang kadaluarsa
setInterval(async () => {
  const activeCards = await storage.getActiveCards();
  const now = new Date();

  for (const card of activeCards) {
    if (card.expiresAt && card.expiresAt <= now) {
      // Notify user
      await pushNotificationService.notifyCardExpired(card.userId, card.card.name);
      
      // Mark as expired
      // await storage.expireCard(card.id);
    }
  }
}, 60000); // Check setiap menit
```

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome/Edge | ✅ Full |
| Firefox | ✅ Full |
| Safari (iOS 16.4+) | ✅ Partial (PWA only) |
| Samsung Internet | ✅ Full |
| Opera | ✅ Full |

## Troubleshooting

### Notifikasi tidak muncul

1. Check browser console untuk errors
2. Verify VAPID keys di .env
3. Check `push_subscriptions` table untuk endpoint
4. Pastikan service worker registered: `chrome://inspect/#service-workers`

### Service Worker tidak register

1. HTTPS required (lokasi http://localhost OK)
2. Pastikan `/public/sw.js` accessible
3. Check browser console untuk `Uncaught TypeError`

###  "Notification permission denied"

User harus mengizinkan notifikasi di browser settings:
- Chrome: `chrome://settings/content/notifications`
- Firefox: Preferences → Privacy & Security → Permissions → Notifications

### Database error

```sql
-- Manual migration jika database tidak auto-create
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  user_agent TEXT,
  platform TEXT DEFAULT 'web',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE TABLE notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  card_used BOOLEAN DEFAULT true,
  card_expired BOOLEAN DEFAULT true,
  card_dropped BOOLEAN DEFAULT true,
  promotions BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Production Considerations

1. **HTTPS Required**: Push notifications hanya work dengan HTTPS
2. **VAPID Keys**: Generate unik per domain
3. **Error Handling**: Invalid/expired subscriptions auto-removed dari database
4. **Rate Limiting**: Implement rate limiting pada notification sending
5. **User Consent**: Always request user permission sebelum push
6. **Logging**: Monitor notification delivery success rate
7. **Testing**: Test dengan multiple browsers dan devices

## Testing

```bash
# Test send notification ke user ID 1
curl -X POST http://localhost:3000/api/notifications/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "subscription": {
      "endpoint": "https://...",
      "keys": { "auth": "...", "p256dh": "..." }
    }
  }'
```

## References

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web-push npm](https://github.com/web-push-libs/web-push)
- [VAPID](https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid)
