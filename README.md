# Confidence Arise · Growth Agent (USA)

Private tool for **Naeema** (`naeemah@confidencearise.org`): login → **State → City → businesses** → filter → Email / WhatsApp outreach with `confidencearise.com` link.

## Run locally

```bash
npm install
copy .env.example .env
# set AUTH_PASSWORD in .env
npm run dev
```

http://localhost:5174

## Env

| Key | Required | Notes |
|-----|----------|--------|
| `AUTH_EMAIL` | yes | default `naeemah@confidencearise.org` |
| `AUTH_PASSWORD` | yes | Naeema's login password |
| `SESSION_SECRET` | yes (prod) | cookie signing |
| `RESEND_API_KEY` | for live email | |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | for live WA | |

## Deploy (Render)

1. Push this repo to GitHub  
2. Render → New → Blueprint → select repo (`render.yaml`)  
3. Set `AUTH_PASSWORD` (and optional Resend / WhatsApp keys) in dashboard  

Or: **New Web Service** → build `npm install && npm run build` → start `npm start`
