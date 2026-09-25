import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { searchBusinesses } from './src/search.js'
import { sendEmail, sendWhatsApp } from './src/outreach.js'
import {
  defaultEmailBody,
  defaultEmailSubject,
  defaultWhatsAppBody,
} from './src/templates.js'
import { COUNTRY, US_STATES, citiesForState } from './src/usa.js'
import { attachAuthRoutes, requireAuth } from './src/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 4174

app.use(express.json({ limit: '1mb' }))

const recent = new Map()
const CACHE_MS = 25 * 60 * 1000
const CACHE_VERSION = 'usa-v2-state'

const outreachLog = []

function siteConfig() {
  return {
    siteUrl: process.env.SITE_URL || 'https://confidencearise.com',
    fromName: process.env.FROM_NAME || 'Confidence Arise',
    fromEmail: process.env.FROM_EMAIL || 'hello@confidencearise.com',
    emailReady: Boolean(process.env.RESEND_API_KEY),
    whatsappReady: Boolean(
      process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
    ),
    authConfigured: Boolean(process.env.AUTH_PASSWORD),
  }
}

attachAuthRoutes(app)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, market: COUNTRY.name, product: 'Confidence Arise Growth Agent' })
})

app.get('/api/config', requireAuth, (_req, res) => {
  res.json(siteConfig())
})

app.get('/api/states', requireAuth, (_req, res) => {
  res.json({ states: US_STATES })
})

app.get('/api/cities', requireAuth, (req, res) => {
  const state = String(req.query.state || '').trim().toUpperCase()
  if (!state) return res.status(400).json({ error: 'state required' })
  res.json({ state, cities: citiesForState(state) })
})

app.get('/api/businesses', requireAuth, async (req, res) => {
  const state = String(req.query.state || '').trim().toUpperCase()
  const city = String(req.query.city || '').trim()
  const postalCode = String(req.query.postalCode || '').trim()

  if (!state && !postalCode) {
    return res.status(400).json({ error: 'Select a US state and city (or ZIP).' })
  }
  if (state && !city && !postalCode) {
    return res.status(400).json({ error: 'Select a city in that state (or enter a ZIP).' })
  }

  const cacheKey = [CACHE_VERSION, state, city.toLowerCase(), postalCode].join('|')
  const cached = recent.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return res.json(cached.payload)
  }

  const timeout = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ error: 'Search timed out. Try again.' })
  }, 35_000)

  try {
    const result = await searchBusinesses({ state, city, postalCode })
    const payload = {
      place: result.place,
      businesses: result.businesses,
      count: result.businesses.length,
      totalFound: result.totalFound,
    }
    recent.set(cacheKey, { at: Date.now(), payload })
    if (!res.headersSent) res.json(payload)
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: err.message || 'Search failed.' })
  } finally {
    clearTimeout(timeout)
  }
})

app.post('/api/outreach/preview', requireAuth, (req, res) => {
  const { business } = req.body || {}
  if (!business?.name) return res.status(400).json({ error: 'business required' })
  const cfg = siteConfig()
  res.json({
    email: {
      to: business.email || null,
      subject: defaultEmailSubject(business.name),
      body: defaultEmailBody(business, cfg),
    },
    whatsapp: {
      to: business.phone || null,
      body: defaultWhatsAppBody(business, cfg),
    },
    config: cfg,
  })
})

app.post('/api/outreach/send', requireAuth, async (req, res) => {
  const {
    business,
    channels = ['email', 'whatsapp'],
    emailSubject,
    emailBody,
    whatsappBody,
    dryRun = false,
  } = req.body || {}

  if (!business?.name) {
    return res.status(400).json({ error: 'business required' })
  }

  const cfg = siteConfig()
  const results = { email: null, whatsapp: null }

  if (channels.includes('email')) {
    const to = business.email
    const subject = emailSubject || defaultEmailSubject(business.name)
    const text = emailBody || defaultEmailBody(business, cfg)
    if (!to) {
      results.email = { ok: false, error: 'No email on this lead.' }
    } else if (dryRun) {
      results.email = { ok: true, dryRun: true, preview: { to, subject, text } }
    } else {
      results.email = await sendEmail({ to, subject, text })
    }
  }

  if (channels.includes('whatsapp')) {
    const text = whatsappBody || defaultWhatsAppBody(business, cfg)
    if (!business.phone) {
      results.whatsapp = { ok: false, error: 'No phone on this lead.' }
    } else if (dryRun) {
      results.whatsapp = {
        ok: true,
        dryRun: true,
        preview: { to: business.phone, text },
      }
    } else {
      results.whatsapp = await sendWhatsApp({ phone: business.phone, text })
    }
  }

  const entry = {
    at: new Date().toISOString(),
    business: business.name,
    id: business.id,
    by: req.user?.email,
    results,
  }
  outreachLog.unshift(entry)
  if (outreachLog.length > 200) outreachLog.pop()

  const ok =
    (!channels.includes('email') || results.email?.ok) &&
    (!channels.includes('whatsapp') || results.whatsapp?.ok)

  res.status(ok ? 200 : 207).json({ ok, results, config: cfg })
})

app.post('/api/outreach/send-batch', requireAuth, async (req, res) => {
  const {
    businesses = [],
    channels = ['email', 'whatsapp'],
    dryRun = false,
    limit = 25,
  } = req.body || {}

  if (!Array.isArray(businesses) || !businesses.length) {
    return res.status(400).json({ error: 'businesses array required' })
  }

  const slice = businesses.slice(0, Math.min(limit, 50))
  const items = []

  for (const business of slice) {
    const cfg = siteConfig()
    const results = { email: null, whatsapp: null }

    if (channels.includes('email') && business.email) {
      const subject = defaultEmailSubject(business.name)
      const text = defaultEmailBody(business, cfg)
      results.email = dryRun
        ? { ok: true, dryRun: true, preview: { to: business.email, subject, text } }
        : await sendEmail({ to: business.email, subject, text })
    } else if (channels.includes('email')) {
      results.email = { ok: false, error: 'No email' }
    }

    if (channels.includes('whatsapp') && business.phone) {
      const text = defaultWhatsAppBody(business, cfg)
      results.whatsapp = dryRun
        ? { ok: true, dryRun: true, preview: { to: business.phone, text } }
        : await sendWhatsApp({ phone: business.phone, text })
    } else if (channels.includes('whatsapp')) {
      results.whatsapp = { ok: false, error: 'No phone' }
    }

    items.push({ business: business.name, id: business.id, results })
    outreachLog.unshift({
      at: new Date().toISOString(),
      business: business.name,
      id: business.id,
      by: req.user?.email,
      results,
    })
    await new Promise((r) => setTimeout(r, dryRun ? 20 : 400))
  }

  while (outreachLog.length > 200) outreachLog.pop()
  res.json({ count: items.length, items })
})

app.get('/api/outreach/log', requireAuth, (_req, res) => {
  res.json({ count: outreachLog.length, items: outreachLog.slice(0, 50) })
})

app.use(express.static(path.join(__dirname, 'dist')))

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' })
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Confidence Arise Growth Agent on http://localhost:${PORT}`)
  const cfg = siteConfig()
  console.log(`Auth: ${cfg.authConfigured ? 'password set' : 'SET AUTH_PASSWORD'}`)
  console.log(`Email API: ${cfg.emailReady ? 'ready' : 'dry-run'}`)
  console.log(`WhatsApp API: ${cfg.whatsappReady ? 'ready' : 'dry-run'}`)
})
