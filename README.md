# Confidence Arise · Growth Agent (USA)

Separate USA-market tool: **find businesses → filter leads → send Email + WhatsApp** with your website link in every message.

## Stack

- Vite + React UI
- Express API
- Business data: OpenStreetMap (Overpass)
- Email: [Resend](https://resend.com) API
- WhatsApp: [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)

## Setup

```bash
cd E:\confidence-arise-growth
npm install
copy .env.example .env
npm run dev
```

Open http://localhost:5174 (API on 4174).

### `.env` keys

| Key | Purpose |
|-----|---------|
| `SITE_URL` | Link embedded in email/WhatsApp (default `https://confidencearise.com`) |
| `FROM_NAME` / `FROM_EMAIL` | Sender identity |
| `RESEND_API_KEY` | Live email sends |
| `WHATSAPP_TOKEN` | Meta permanent / system user token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone number ID |
| `OUTREACH_API_KEY` | Optional guard for `/api/outreach/*` |

Without API keys, the UI still works in **Dry run** mode (previews only, no real send).

## WhatsApp Cloud API (quick)

1. Meta Developer App → add **WhatsApp** product  
2. Copy **Phone number ID** + token into `.env`  
3. For production, use a template message for cold outreach (24h window rules) — this MVP sends free-form `text` (best for replies / opted-in, or sandbox testing)

## Flow

1. Search US city / ZIP  
2. Filter by category, email/phone, website  
3. Select leads → Dry run or live send (Email and/or WhatsApp)  
4. Templates include `SITE_URL`

## Deploy (Render)

Push repo → Blueprint `render.yaml` → set secret env vars in dashboard.
