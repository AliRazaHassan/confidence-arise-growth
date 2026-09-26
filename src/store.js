import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const SEARCHES_FILE = path.join(DATA_DIR, 'searches.json')
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json')
const LEADS_FILE = path.join(DATA_DIR, 'leads.json')
const CRM_FILE = path.join(DATA_DIR, 'crm.json')

const MAX_SEARCHES = 100
const MAX_SUBMISSIONS = 500
const MAX_LEADS = 2000

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
      crm[leadId] = { ...prevCrm, id: leadId, status: prevCrm.status && prevCrm.status !== 'new' ? prevCrm.status : 'contacted', updatedAt: new Date().toISOString() }
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

export function updateLeadCRM({ id, status, notes, nextFollowUpAt, outcome }) {
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
    updatedAt: new Date().toISOString(),
  }
  map[id] = next
  writeJson(CRM_FILE, map)
  return next
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
