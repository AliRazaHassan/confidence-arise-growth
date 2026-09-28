import 'dotenv/config'
import express from 'express'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { searchBusinesses } from './src/search.js'
import { analyzeBusiness, auditWebsite } from './src/intelligence.js'
import { sendEmail, sendWhatsApp, testEmailConnection, testWhatsAppConnection } from './src/outreach.js'
import { getWhatsAppSettings, saveWhatsAppSettings } from './src/whatsappSettings.js'
import { getEmailSettings, saveEmailSettings, providerDefaults } from './src/emailSettings.js'
import { syncEmailReplies } from './src/emailReplies.js'
import { answerConciergeAI, conciergeSnapshot, testConciergeAI, parseConciergeAction, contextualConciergeAI } from './src/concierge.js'
import { buildFollowUp, defaultNextFollowUpAt } from './src/followups.js'
import {
  defaultEmailBody,
  defaultEmailSubject,
  defaultWhatsAppBody,
} from './src/templates.js'
import { COUNTRY, US_STATES, citiesForState } from './src/usa.js'
import { attachAuthRoutes, requireAuth } from './src/auth.js'
import {
  historySummary,
  listLeads,
  listSearches,
  listSubmissions,
  recordBatchSubmissions,
  recordSearch,
  recordSubmission,
  updateLeadCRM,
  getLeadCRM,
  listLeadCRM,
  listDueFollowUps,
  recordFollowUp,
  findLeadByContact,
  recordInboundReply,
  listReplies,
  funnelAnalytics,
} from './src/store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const conciergePendingActions = new Map()

function normalizeConciergeInput(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ')
}

function conciergeSessionKey(req) {
  return String(req.user?.email || req.ip || 'default').toLowerCase()
}
const PORT = process.env.PORT || 4174

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    if (req.originalUrl?.startsWith('/api/webhooks/whatsapp')) req.rawBody = Buffer.from(buf)
  },
}))

function verifyWhatsAppSignature(req) {
  const secret = process.env.WHATSAPP_APP_SECRET
  const signature = String(req.get('x-hub-signature-256') || '')
  if (!secret || !signature.startsWith('sha256=') || !req.rawBody) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const recent = new Map()
const CACHE_MS = 25 * 60 * 1000
const CACHE_VERSION = 'usa-v6-multisource'

function siteConfig() {
  return {
    siteUrl: process.env.SITE_URL || 'https://confidencearise.com',
    fromName: process.env.FROM_NAME || 'Confidence Arise',
    fromEmail: process.env.FROM_EMAIL || 'hello@confidencearise.com',
    emailReady: Boolean(getEmailSettings()?.configured || (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'pending')),
    emailAccount: getEmailSettings(),
    whatsappReady: Boolean(
      getWhatsAppSettings()?.configured ||
      (process.env.WHATSAPP_TOKEN &&
        process.env.WHATSAPP_TOKEN !== 'pending' &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_PHONE_NUMBER_ID !== 'pending'),
    ),
    whatsappAccount: getWhatsAppSettings(),
    authConfigured: Boolean(process.env.AUTH_PASSWORD),
  }
}

function submissionStatus(results) {
  const parts = []
  if (results.email?.ok) parts.push('email')
  if (results.whatsapp?.ok) parts.push('whatsapp')
  if (!parts.length) return 'failed'
  if (results.email?.dryRun || results.whatsapp?.dryRun) return 'dry_run'
  return 'sent'
}

attachAuthRoutes(app)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, market: COUNTRY.name, product: 'Confidence Arise Growth Agent' })
})

app.get('/api/config', requireAuth, (_req, res) => {
  res.json({ ...siteConfig(), history: historySummary() })
})

app.get('/api/settings/email', requireAuth, (_req, res) => {
  res.json({ account: getEmailSettings() })
})

app.post('/api/settings/email/test', requireAuth, async (req, res) => {
  try {
    const input = req.body || {}
    const defaults = providerDefaults(input.provider)
    const settings = {
      email: String(input.email || '').trim(),
      password: String(input.password || ''),
      host: defaults?.host || String(input.host || '').trim(),
      port: Number(defaults?.port || input.port || 587),
      secure: defaults ? defaults.secure : Boolean(input.secure),
    }
    if (!settings.email || !settings.password) return res.status(400).json({ error: 'Email and password are required for testing.' })
    await testEmailConnection(settings)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Email connection failed.' })
  }
})

app.put('/api/settings/email', requireAuth, async (req, res) => {
  try {
    const input = req.body || {}
    const existing = getEmailSettings({ includeSecret: true })
    const defaults = providerDefaults(input.provider)
    const candidate = {
      email: String(input.email || '').trim(),
      password: String(input.password || existing?.password || ''),
      host: defaults?.host || String(input.host || '').trim(),
      port: Number(defaults?.port || input.port || 587),
      secure: defaults ? defaults.secure : Boolean(input.secure),
    }
    if (!candidate.email || !candidate.password) return res.status(400).json({ error: 'Email and password are required.' })
    await testEmailConnection(candidate)
    const account = saveEmailSettings({ ...input, password: input.password || existing?.password })
    res.json({ ok: true, account })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not save email account.' })
  }
})

app.get('/api/settings/whatsapp', requireAuth, (_req, res) => {
  res.json({ account: getWhatsAppSettings() })
})

app.put('/api/settings/whatsapp', requireAuth, async (req, res) => {
  try {
    const input = req.body || {}
    const existing = getWhatsAppSettings({ includeSecret: true })
    const candidate = {
      phoneNumberId: String(input.phoneNumberId || '').trim(),
      accessToken: String(input.accessToken || existing?.accessToken || ''),
      graphVersion: String(input.graphVersion || 'v21.0').trim(),
    }
    if (!candidate.phoneNumberId || !candidate.accessToken) return res.status(400).json({ error: 'Phone Number ID and access token are required.' })
    const verified = await testWhatsAppConnection(candidate)
    const account = saveWhatsAppSettings({ ...input, accessToken: input.accessToken || existing?.accessToken })
    res.json({ ok: true, account, verified })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not connect WhatsApp.' })
  }
})

app.get('/api/webhooks/whatsapp', (req, res) => {
  const settings = getWhatsAppSettings()
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && settings?.verifyToken && token === settings.verifyToken) return res.status(200).send(challenge)
  return res.sendStatus(403)
})

app.post('/api/webhooks/whatsapp', (req, res) => {
  if (!verifyWhatsAppSignature(req)) return res.sendStatus(403)
  try {
    const changes = req.body?.entry?.flatMap((entry) => entry.changes || []) || []
    for (const change of changes) {
      const messages = change?.value?.messages || []
      for (const message of messages) {
        const from = message.from || ''
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || ''
        if (!text) continue
        const lead = findLeadByContact({ phone: from })
        recordInboundReply({ businessId: lead?.id || null, channel: 'whatsapp', from, text, externalId: message.id || null })
      }
    }
    res.sendStatus(200)
  } catch {
    res.sendStatus(200)
  }
})

app.post('/api/crm/lead/:id/reply', requireAuth, (req, res) => {
  const { channel = 'email', from = '', text = '', externalId = null } = req.body || {}
  if (!text) return res.status(400).json({ error: 'Reply text is required.' })
  const reply = recordInboundReply({ businessId: req.params.id, channel, from, text, externalId })
  res.json({ reply, crm: getLeadCRM(req.params.id) })
})

app.post('/api/crm/replies/sync-email', requireAuth, async (_req, res) => {
  try {
    const summary = await syncEmailReplies({ maxMessages: 50 })
    res.json({ ok: true, summary, items: listReplies(100) })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not sync email replies.' })
  }
})

app.get('/api/crm/replies', requireAuth, (req, res) => {
  res.json({ items: listReplies(Math.min(Number(req.query.limit) || 100, 500)) })
})

app.get('/api/analytics/funnel', requireAuth, (_req, res) => {
  res.json(funnelAnalytics())
})

app.get('/api/concierge/snapshot', requireAuth, (_req, res) => {
  res.json(conciergeSnapshot())
})

app.post('/api/concierge/chat', requireAuth, async (req, res) => {
  const message = normalizeConciergeInput(req.body?.message)
  const sessionKey = conciergeSessionKey(req)
  const pending = req.body?.pendingAction || conciergePendingActions.get(sessionKey)
  let action = parseConciergeAction(message)
  if (!action && pending?.type === 'lead_search') {
    const follow = normalizeConciergeInput(message)
    const anyState = /\b(?:any(?:where|\s+(?:us\s+)?state|\s+location|\s+city)?|wherever|you\s+(?:choose|pick)|choose\s+(?:for\s+me|yourself|a\s+city)|best\s+state|usa)\b/i.test(follow)
    if (anyState) {
      const defaults = [
        ['Miami', 'FL'], ['Austin', 'TX'], ['Phoenix', 'AZ'], ['Atlanta', 'GA'],
        ['Charlotte', 'NC'], ['Dallas', 'TX'], ['Orlando', 'FL'], ['Denver', 'CO'],
      ]
      const [city, state] = defaults[Math.abs(String(pending.category || '').length) % defaults.length]
      action = { ...pending, city, state, needsLocation: false, autoLocation: true }
    } else {
      const loc = follow.match(/^([a-z .'-]+?)(?:,?\s+([a-z]{2}))$/i)
      if (loc) action = { ...pending, city: loc[1].trim(), state: loc[2].toUpperCase(), needsLocation: false }
    }
  }
  if (action?.type === 'sync_replies') {
    try {
      const summary = await syncEmailReplies({ maxMessages: 50 })
      return res.json({ ...conciergeSnapshot(), answer: `Email reply sync complete. Checked ${summary.checked || 0}, matched ${summary.matched || 0}, recorded ${summary.recorded || 0}.`, aiPowered: false, action: { ...action, status: 'completed', summary } })
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Email sync failed' })
    }
  }
  if (action?.type === 'lead_search') {
    if (action.anyLocation) {
      const defaults = [['Miami', 'FL'], ['Austin', 'TX'], ['Phoenix', 'AZ'], ['Atlanta', 'GA'], ['Charlotte', 'NC'], ['Dallas', 'TX'], ['Orlando', 'FL'], ['Denver', 'CO']]
      const [city, state] = defaults[Math.abs(String(action.category || '').length) % defaults.length]
      action = { ...action, city, state, needsLocation: false, autoLocation: true }
    }
    if (action.needsLocation || !action.city || !action.state) {
      conciergePendingActions.set(sessionKey, action)
      return res.json({ ...conciergeSnapshot(), answer: `Sure — I can find and rank ${action.category} leads. Which US city and state should I search? Example: "Miami, FL" or "Austin, TX".`, aiPowered: false, action: { ...action, status: 'needs_input', missing: ['city', 'state'] } })
    }
    try {
      conciergePendingActions.delete(sessionKey)
      const result = await searchBusinesses({ state: action.state, city: action.city, postalCode: '' })
      const needle = action.category.toLowerCase()
      const ranked = result.businesses
        .filter((b) => !needle || String(b.category || '').toLowerCase().includes(needle) || String(b.name || '').toLowerCase().includes(needle) || String(b.tags?.amenity || '').toLowerCase().includes(needle))
        .sort((a,b) => Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0))
        .slice(0, action.limit)
      const items = ranked
      recordSearch({ state: action.state, city: action.city, postalCode: '', placeLabel: result.place?.label, count: items.length, by: req.user?.email })
      return res.json({ ...conciergeSnapshot(), answer: `Found ${items.length} leads for ${action.category} in ${action.city}, ${action.state}${action.autoLocation ? ' (location selected automatically)' : ''}. I ranked them by opportunity score; review the results before outreach.`, aiPowered: false, action: { ...action, status: 'completed', leads: items } })
    } catch (err) {
      return res.status(502).json({ error: err.message || 'Lead search failed' })
    }
  }
  res.json(await answerConciergeAI(message, Array.isArray(req.body?.history) ? req.body.history : []))
})

app.post('/api/concierge/context', requireAuth, async (req, res) => {
  const { question, context } = req.body || {}
  res.json(await contextualConciergeAI({ question, context }))
})

app.get('/api/concierge/ai-status', requireAuth, async (_req, res) => {
  res.json(await testConciergeAI())
})

app.get('/api/states', requireAuth, (_req, res) => {
  res.json({ states: US_STATES })
})

app.get('/api/cities', requireAuth, (req, res) => {
  const state = String(req.query.state || '').trim().toUpperCase()
  if (!state) return res.status(400).json({ error: 'state required' })
  res.json({ state, cities: citiesForState(state) })
})

app.get('/api/history/summary', requireAuth, (_req, res) => {
  res.json(historySummary())
})

app.get('/api/history/searches', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  res.json({ items: listSearches(limit) })
})

app.get('/api/history/submissions', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200)
  res.json({ items: listSubmissions(limit) })
})

app.get('/api/history/leads', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500)
  res.json({ items: listLeads(limit) })
})

app.get('/api/crm/lead/:id', requireAuth, (req, res) => {
  const crm = getLeadCRM(req.params.id)
  res.json({ crm })
})

app.get('/api/crm', requireAuth, (_req, res) => {
  res.json({ items: listLeadCRM(500) })
})

app.patch('/api/crm/lead/:id', requireAuth, (req, res) => {
  const { status, notes, nextFollowUpAt, outcome, dealValue } = req.body || {}
  const allowed = ['new', 'contacted', 'replied', 'qualified', 'proposal', 'won', 'lost', 'paused']
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid lead status.' })
  const crm = updateLeadCRM({
    id: req.params.id,
    status,
    notes,
    nextFollowUpAt,
    outcome,
    dealValue,
  })
  res.json({ crm })
})

app.get('/api/crm/follow-ups', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200)
  res.json({ items: listDueFollowUps(new Date(), limit) })
})

app.post('/api/crm/lead/:id/follow-up/preview', requireAuth, (req, res) => {
  const { business } = req.body || {}
  if (!business?.name) return res.status(400).json({ error: 'business required' })
  const crm = getLeadCRM(req.params.id) || { id: req.params.id, status: 'contacted' }
  const message = buildFollowUp(business, crm, siteConfig())
  res.json({ crm, message })
})

app.post('/api/crm/lead/:id/follow-up/send', requireAuth, async (req, res) => {
  const { business, channels = ['email', 'whatsapp'], dryRun = false } = req.body || {}
  if (!business?.name) return res.status(400).json({ error: 'business required' })
  const crm = getLeadCRM(req.params.id) || { id: req.params.id, status: 'contacted' }
  if (['won', 'lost', 'paused'].includes(crm.status) || crm.followUpComplete) {
    return res.status(409).json({ error: 'Follow-up sequence is stopped for this lead.' })
  }

  const cfg = siteConfig()
  const message = buildFollowUp(business, crm, cfg)
  const results = { email: null, whatsapp: null }

  if (channels.includes('email')) {
    if (!business.email) results.email = { ok: false, error: 'No email on this lead.' }
    else if (dryRun) results.email = { ok: true, dryRun: true, preview: { to: business.email, subject: message.subject, text: message.email } }
    else results.email = await sendEmail({ to: business.email, subject: message.subject, text: message.email })
  }

  if (channels.includes('whatsapp')) {
    if (!business.phone) results.whatsapp = { ok: false, error: 'No phone on this lead.' }
    else if (dryRun) results.whatsapp = { ok: true, dryRun: true, preview: { to: business.phone, text: message.whatsapp } }
    else results.whatsapp = await sendWhatsApp({ phone: business.phone, text: message.whatsapp })
  }

  const status = submissionStatus(results)
  const saved = recordSubmission({
    businessId: business.id || req.params.id,
    businessName: business.name,
    email: business.email || null,
    phone: business.phone || null,
    address: business.address || null,
    channels,
    dryRun,
    by: req.user?.email,
    results,
    status,
    followUpStep: message.step,
  })

  let updatedCRM = crm
  if (status === 'sent') {
    const nextAt = message.final ? null : defaultNextFollowUpAt(new Date(), Number(crm.followUpCount || 0) + 1)
    updatedCRM = recordFollowUp(req.params.id, { nextFollowUpAt: nextAt, final: message.final })
  }

  res.status(status === 'failed' ? 207 : 200).json({ status, results, submission: saved, crm: updatedCRM, message })
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
  }, 55_000)

  try {
    const result = await searchBusinesses({ state, city, postalCode })
    const searchMeta = recordSearch({
      state,
      city,
      postalCode,
      placeLabel: result.place?.label,
      count: result.businesses.length,
      by: req.user?.email,
    })
    const payload = {
      place: result.place,
      businesses: result.businesses,
      count: result.businesses.length,
      totalFound: result.totalFound,
      quality: result.quality || null,
      searchId: searchMeta.id,
    }
    recent.set(cacheKey, { at: Date.now(), payload })
    if (!res.headersSent) res.json(payload)
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: err.message || 'Search failed.' })
  } finally {
    clearTimeout(timeout)
  }
})

app.post('/api/intelligence/analyze', requireAuth, async (req, res) => {
  const { business } = req.body || {}
  if (!business?.name) return res.status(400).json({ error: 'business required' })
  let audit = null
  if (business.website) audit = await auditWebsite(business.website)
  const intelligence = analyzeBusiness(business, audit)
  res.json({ intelligence, audit })
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
    if (!to) results.email = { ok: false, error: 'No email on this lead.' }
    else if (dryRun) results.email = { ok: true, dryRun: true, preview: { to, subject, text } }
    else results.email = await sendEmail({ to, subject, text })
  }

  if (channels.includes('whatsapp')) {
    const text = whatsappBody || defaultWhatsAppBody(business, cfg)
    if (!business.phone) results.whatsapp = { ok: false, error: 'No phone on this lead.' }
    else if (dryRun) {
      results.whatsapp = { ok: true, dryRun: true, preview: { to: business.phone, text } }
    } else results.whatsapp = await sendWhatsApp({ phone: business.phone, text })
  }

  const saved = recordSubmission({
    businessId: business.id,
    businessName: business.name,
    email: business.email || null,
    phone: business.phone || null,
    address: business.address || null,
    channels,
    dryRun,
    by: req.user?.email,
    results,
    status: submissionStatus(results),
  })

  const ok =
    (!channels.includes('email') || results.email?.ok) &&
    (!channels.includes('whatsapp') || results.whatsapp?.ok)

  res.status(ok ? 200 : 207).json({ ok, results, submission: saved, config: cfg })
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
  const toSave = []

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
    toSave.push({
      businessId: business.id,
      businessName: business.name,
      email: business.email || null,
      phone: business.phone || null,
      address: business.address || null,
      channels,
      dryRun,
      by: req.user?.email,
      results,
      status: submissionStatus(results),
    })
    await new Promise((r) => setTimeout(r, dryRun ? 20 : 400))
  }

  const saved = recordBatchSubmissions(toSave)
  res.json({ count: items.length, items, submissions: saved })
})

app.use(express.static(path.join(__dirname, 'dist')))

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' })
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

const EMAIL_SYNC_MS = Math.max(2, Number(process.env.EMAIL_REPLY_SYNC_MINUTES || 10)) * 60 * 1000
if (process.env.EMAIL_REPLY_SYNC_ENABLED === 'true') {
  setInterval(() => {
    syncEmailReplies({ maxMessages: 50 }).catch((err) => console.error('Email reply sync failed:', err.message))
  }, EMAIL_SYNC_MS).unref()
}

app.listen(PORT, () => {
  console.log(`Confidence Arise Growth Agent on http://localhost:${PORT}`)
  const cfg = siteConfig()
  console.log(`Auth: ${cfg.authConfigured ? 'password set' : 'SET AUTH_PASSWORD'}`)
  console.log(`Email API: ${cfg.emailReady ? 'ready' : 'dry-run'}`)
  console.log(`WhatsApp API: ${cfg.whatsappReady ? 'ready' : 'dry-run'}`)
})
