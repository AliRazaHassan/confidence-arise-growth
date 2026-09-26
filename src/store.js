import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const SEARCHES_FILE = path.join(DATA_DIR, 'searches.json')
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json')
const LEADS_FILE = path.join(DATA_DIR, 'leads.json')
const CRM_FILE = path.join(DATA_DIR, 'crm.json')
const REPLIES_FILE = path.join(DATA_DIR, 'replies.json')

const MAX_SEARCHES = 100
const MAX_SUBMISSIONS = 500
const MAX_LEADS = 2000
const TERMINAL_CRM_STATUSES = new Set(['won', 'lost', 'paused'])

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJson(file, fallback) {
  try {
    ensureDir()
    if (!fs.existsSync(file)) return fallback
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  ensureDir()
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function listSearches(limit = 50) {
  return readJson(SEARCHES_FILE, []).slice(0, limit)
}

export function recordSearch({ state, city, postalCode, placeLabel, count, by }) {
  const rows = readJson(SEARCHES_FILE, [])
  const entry = {
    id: id(),
    at: new Date().toISOString(),
    state,
    city,
    postalCode: postalCode || '',
    placeLabel,
    count,
    by: by || null,
  }
  rows.unshift(entry)
  writeJson(SEARCHES_FILE, rows.slice(0, MAX_SEARCHES))
  return entry
}

export function listSubmissions(limit = 100) {
  return readJson(SUBMISSIONS_FILE, []).slice(0, limit)
}

export function recordSubmission(entry) {
  const rows = readJson(SUBMISSIONS_FILE, [])
  const full = {
    id: id(),
    at: new Date().toISOString(),
    ...entry,
  }
  rows.unshift(full)
  writeJson(SUBMISSIONS_FILE, rows.slice(0, MAX_SUBMISSIONS))

  // Upsert lead contact history
  if (entry.businessId || entry.businessName) {
    const leadId = entry.businessId || entry.businessName
    const crm = readJson(CRM_FILE, {})
    const prevCrm = crm[leadId] || {}
    if (entry.status === 'sent') {
      const contactedAt = new Date()
      const firstFollowUp = new Date(contactedAt)
      firstFollowUp.setUTCDate(firstFollowUp.getUTCDate() + 3)
      crm[leadId] = {
        ...prevCrm,
        id: leadId,
        status: prevCrm.status && prevCrm.status !== 'new' ? prevCrm.status : 'contacted',
        followUpCount: prevCrm.followUpCount || 0,
        nextFollowUpAt: prevCrm.nextFollowUpAt || firstFollowUp.toISOString(),
        updatedAt: contactedAt.toISOString(),
      }
      writeJson(CRM_FILE, crm)
    }
    upsertLead({
      id: entry.businessId || entry.businessName,
      name: entry.businessName,
      email: entry.email || null,
      phone: entry.phone || null,
      address: entry.address || null,
      lastSubmissionId: full.id,
      lastContactAt: full.at,
      channels: entry.channels || [],
      status: entry.status || 'sent',
    })
  }
  return full
}

export function recordBatchSubmissions(items) {
  return items.map((item) => recordSubmission(item))
}

export function updateLeadCRM({ id, status, notes, nextFollowUpAt, outcome, followUpCount, lastFollowUpAt, dealValue }) {
  if (!id) return null
  const map = readJson(CRM_FILE, {})
  const prev = map[id] || {}
  const next = {
    ...prev,
    id,
    status: status || prev.status || 'new',
    notes: notes ?? prev.notes ?? '',
    nextFollowUpAt: nextFollowUpAt ?? prev.nextFollowUpAt ?? null,
    outcome: outcome ?? prev.outcome ?? null,
    followUpCount: followUpCount ?? prev.followUpCount ?? 0,
    lastFollowUpAt: lastFollowUpAt ?? prev.lastFollowUpAt ?? null,
    dealValue: dealValue ?? prev.dealValue ?? 0,
    updatedAt: new Date().toISOString(),
  }
  map[id] = next
  writeJson(CRM_FILE, map)
  return next
}

export function recordFollowUp(id, { nextFollowUpAt = null, final = false } = {}) {
  if (!id) return null
  const map = readJson(CRM_FILE, {})
  const prev = map[id] || { id, status: 'contacted' }
  const count = Number(prev.followUpCount || 0) + 1
  const now = new Date().toISOString()
  const next = {
    ...prev,
    id,
    status: prev.status === 'new' ? 'contacted' : (prev.status || 'contacted'),
    followUpCount: count,
    lastFollowUpAt: now,
    nextFollowUpAt: final || count >= 3 ? null : nextFollowUpAt,
    followUpComplete: Boolean(final || count >= 3),
    updatedAt: now,
  }
  map[id] = next
  writeJson(CRM_FILE, map)
  return next
}

export function listDueFollowUps(now = new Date(), limit = 100) {
  const leads = readJson(LEADS_FILE, {})
  const crm = readJson(CRM_FILE, {})
  const nowMs = new Date(now).getTime()
  return Object.values(leads)
    .map((lead) => ({ ...lead, crm: crm[lead.id] || null }))
    .filter((lead) => {
      const row = lead.crm
      if (!row || TERMINAL_CRM_STATUSES.has(row.status) || row.followUpComplete) return false
      if (!['contacted', 'replied', 'qualified', 'proposal'].includes(row.status)) return false
      if (!row.nextFollowUpAt) return false
      return new Date(row.nextFollowUpAt).getTime() <= nowMs
    })
    .sort((a, b) => String(a.crm.nextFollowUpAt).localeCompare(String(b.crm.nextFollowUpAt)))
    .slice(0, limit)
}

export function getLeadCRM(id) {
  if (!id) return null
  return readJson(CRM_FILE, {})[id] || null
}

export function listLeadCRM(limit = 500) {
  return Object.values(readJson(CRM_FILE, {}))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, limit)
}

export function listLeads(limit = 200) {
  const map = readJson(LEADS_FILE, {})
  const crm = readJson(CRM_FILE, {})
  return Object.values(map)
    .map((lead) => ({ ...lead, crm: crm[lead.id] || null }))
    .sort((a, b) => String(b.lastContactAt || '').localeCompare(String(a.lastContactAt || '')))
    .slice(0, limit)
}

function upsertLead(lead) {
  const map = readJson(LEADS_FILE, {})
  const key = lead.id
  const prev = map[key] || {}
  map[key] = {
    ...prev,
    ...lead,
    contactCount: (prev.contactCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  const keys = Object.keys(map)
  if (keys.length > MAX_LEADS) {
    const sorted = Object.values(map).sort((a, b) =>
      String(a.lastContactAt || '').localeCompare(String(b.lastContactAt || '')),
    )
    const keep = sorted.slice(-MAX_LEADS)
    const next = {}
    for (const row of keep) next[row.id] = row
    writeJson(LEADS_FILE, next)
    return
  }
  writeJson(LEADS_FILE, map)
}

export function historySummary() {
  return {
    searches: listSearches(5).length,
    searchesTotal: listSearches(MAX_SEARCHES).length,
    submissions: listSubmissions(MAX_SUBMISSIONS).length,
    leads: listLeads(MAX_LEADS).length,
  }
}

function digits(value) {
  return String(value || '').replace(/\D/g, '')
}

export function findLeadByContact({ phone, email }) {
  const leads = Object.values(readJson(LEADS_FILE, {}))
  const phoneDigits = digits(phone)
  const emailKey = String(email || '').trim().toLowerCase()
  return leads.find((lead) =>
    (phoneDigits && digits(lead.phone).endsWith(phoneDigits.slice(-10))) ||
    (emailKey && String(lead.email || '').trim().toLowerCase() === emailKey)
  ) || null
}

export function classifyReplyText(text) {
  const value = String(text || '').trim().toLowerCase()
  if (!value) return 'unknown'
  if (/\b(stop|unsubscribe|remove me|do not contact|don't contact)\b/i.test(value)) return 'unsubscribe'
  if (/\b(not interested|no thanks|no thank you|don't need|do not need)\b/i.test(value)) return 'not_interested'
  if (/\b(meeting|call me|schedule|book a call|appointment|zoom|teams)\b/i.test(value)) return 'meeting_request'
  if (/\b(price|pricing|cost|how much|quote|proposal|package)\b/i.test(value)) return 'question'
  if (/\b(interested|sounds good|tell me more|yes|sure|let's do|lets do)\b/i.test(value)) return 'interested'
  if (/\?|\b(how|what|when|where|can you|could you|do you)\b/i.test(value)) return 'question'
  return 'unknown'
}

export function recordInboundReply({ businessId, channel, from, text, externalId = null }) {
  const rows = readJson(REPLIES_FILE, [])
  if (externalId && rows.some((row) => row.externalId === externalId)) return rows.find((row) => row.externalId === externalId)
  const classification = classifyReplyText(text)
  const entry = { id: id(), at: new Date().toISOString(), businessId, channel, from, text, externalId, classification }
  rows.unshift(entry)
  writeJson(REPLIES_FILE, rows.slice(0, 1000))
  if (businessId) {
    const map = readJson(CRM_FILE, {})
    const prev = map[businessId] || { id: businessId }
    const stopped = ['unsubscribe', 'not_interested'].includes(classification)
    map[businessId] = {
      ...prev,
      id: businessId,
      status: classification === 'unsubscribe' ? 'paused' : classification === 'not_interested' ? 'lost' : 'replied',
      outcome: classification,
      lastReplyAt: entry.at,
      lastReplyText: text,
      replyClassification: classification,
      nextFollowUpAt: stopped ? null : prev.nextFollowUpAt || null,
      followUpComplete: stopped ? true : Boolean(prev.followUpComplete),
      updatedAt: entry.at,
    }
    writeJson(CRM_FILE, map)
  }
  return entry
}

export function listReplies(limit = 200) {
  return readJson(REPLIES_FILE, []).slice(0, limit)
}

export function funnelAnalytics() {
  const leads = Object.values(readJson(LEADS_FILE, {}))
  const crm = Object.values(readJson(CRM_FILE, {}))
  const count = (status) => crm.filter((x) => x.status === status).length
  const contacted = crm.filter((x) => ['contacted','replied','qualified','proposal','won','lost','paused'].includes(x.status)).length
  const replied = crm.filter((x) => ['replied','qualified','proposal','won','lost','paused'].includes(x.status) && x.lastReplyAt).length
  return {
    leads: leads.length,
    contacted,
    replied,
    qualified: count('qualified'),
    proposals: count('proposal'),
    won: count('won'),
    lost: count('lost'),
    paused: count('paused'),
    followUpsDue: listDueFollowUps(new Date(), 10000).length,
    pipelineValue: crm.filter((x) => ['qualified','proposal'].includes(x.status)).reduce((sum, x) => sum + Number(x.dealValue || 0), 0),
    wonRevenue: crm.filter((x) => x.status === 'won').reduce((sum, x) => sum + Number(x.dealValue || 0), 0),
    replyRate: contacted ? Math.round((replied / contacted) * 1000) / 10 : 0,
    winRate: contacted ? Math.round((count('won') / contacted) * 1000) / 10 : 0,
  }
}
