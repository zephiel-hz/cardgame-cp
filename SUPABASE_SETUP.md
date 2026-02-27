# Supabase Database Integration Guide

## Overview
This project is now configured to use Supabase as its PostgreSQL database provider. The application is already set up to connect to Supabase through the existing database configuration.

## Setup Instructions

### 1. Create a Supabase Account
- Go to [supabase.com](https://supabase.com)
- Sign up for a free account or log in

### 2. Create a New Supabase Project
- Click "New project" in your Supabase dashboard
- Enter a project name (e.g., "cardgame-cp")
- Set a secure database password
- Choose your region (closest to your users)
- Click "Create new project"

### 3. Get Your Database Connection String
- In your Supabase project dashboard, go to **Settings** → **Database**
- Under "Connection string", select **"Nodejs"** from the dropdown
- Copy the connection string (it will look like: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`)
- Replace `[PASSWORD]` with your actual database password

### 4. Set Environment Variable
- In your project root, create or update `.env.local` file:
```
DATABASE_URL=postgresql://postgres:[your-password]@[your-host]:5432/postgres
```

### 5. Run Database Migrations
With your `.env` set up, run the Drizzle migrations to create tables:

```bash
npm run db:push
```

This will:
- Create the `users` table with username, pin, and avatarUrl fields
- Create the `cards` table with card definitions
- Create the `userCards` table for user inventory
- Create the `gachaLogs` table for tracking gacha pulls

### 6. Seed Initial Data (Optional)
When you start the application for the first time, it will automatically seed:
- Default users (Priatna and Cia)
- 11 unique cards (Common, Rare, and SSR tiers)

## Verifying the Connection

To verify your Supabase connection is working:

1. Start the development server:
```bash
npm run dev
```

2. The application should:
   - Successfully connect to Supabase
   - Create tables if they don't exist
   - Log "serving on port 5000"

3. Try logging in to verify the database is working correctly

## Database Tables

### users
- `id`: Serial primary key
- `username`: Unique username (display name)
- `pin`: 4-digit PIN for login
- `avatarUrl`: URL to user's profile picture

### cards
- `id`: Serial primary key
- `name`: Card name
- `tier`: Rarity tier (Common, Rare, SSR)
- `durationMinutes`: How long the card effect lasts
- `description`: Card effect description

### userCards
- `id`: Serial primary key
- `userId`: Reference to user
- `cardId`: Reference to card
- `status`: inventory, active, or used
- `activatedAt`: When the card was activated
- `expiresAt`: When the card effect expires

### gachaLogs
- `id`: Serial primary key
- `userId`: User who pulled the card
- `pulledAt`: Timestamp of the pull

## Supabase Features You Can Use

### Realtime Database Updates
Supabase supports real-time subscriptions. The current WebSocket implementation will continue to work as-is.

### Authentication (Optional)
For future enhancements, consider using Supabase Auth for more secure user management.

### Storage (Optional)
For user avatar uploads, Supabase Storage can be used instead of file system storage:
- Create a `public/avatars` bucket in Supabase Storage
- Update the avatar upload endpoint to use Supabase Storage API

### API & SQL Editor
Access your database directly via:
- SQL Editor in Supabase dashboard
- Supabase REST API endpoints

## Environment Variables Reference

```env
# Required for database connection
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Optional for production deployment
NODE_ENV=production
PORT=5000
```

## Troubleshooting

### "DATABASE_URL must be set" Error
- Make sure your `.env` file has the correct `DATABASE_URL`
- Verify the password is correct in the connection string

### Connection Timeout
- Check if your Supabase project is running
- Verify your internet connection
- Check if the host address is accessible from your location

### Tables Not Created
- Run `npm run db:push` to create tables
- Check the Supabase dashboard SQL Editor to verify table creation

### Unable to Login
- Check if users are in the database: `SELECT * FROM users;`
- Verify the pin is correct (should be '1010' for Priatna and '0412' for Cia)
- Check if the username is being requested correctly

## Next Steps

1. **File Storage**: Migrate avatar uploads to Supabase Storage
2. **Authentication**: Implement Supabase Auth for enhanced security
3. **Row-Level Security**: Set up RLS policies for better data protection
4. **Backups**: Enable automated backups in Supabase settings
5. **Scaling**: Monitor performance in Supabase dashboard and adjust compute resources as needed

## Support

For Supabase-specific issues, visit:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com)

For application-specific issues, check the project's main README.md
