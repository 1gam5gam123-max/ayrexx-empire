# Ayrexx — Discord Bot + Dashboard

Fresh starter project by **ISANO**, designed in black and red.

## Requirements
- Node.js 20+
- Discord application/bot from Discord Developer Portal
- MongoDB database (MongoDB Atlas is supported)

## Setup
1. Install dependencies with `npm install`.
2. Configure environment variables from `.env.example` in your hosting provider. Do not commit `.env`.
3. Set `MONGODB_URI` to your private MongoDB connection string.
4. Set Discord OAuth2 redirect URL to the exact value of `DISCORD_CALLBACK_URL`.
5. Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and a strong `SESSION_SECRET`.
6. Run `npm start`.

The dashboard includes Discord OAuth login, a responsive black/red interface, and per-server settings stored in MongoDB. Starter bot commands: `/ping`, `/server`, `/warn`, and `/clear`.

## Current limitations
This is a starter foundation, not a finished production bot. The anti-spam toggle is stored as a setting but enforcement is not implemented. Warning commands currently respond but do not persist warning records. Use a persistent session store and review production security before public deployment.
