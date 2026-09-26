import { auditWebsite } from './intelligence.js'

const UA = 'ConfidenceAriseGrowth/3.0 (business discovery)'
const SEARCH_TIMEOUT = 7000
const MAX_WEB_RESULTS = 60
const MAX_WEBSITE_ENRICH = 24

const CATEGORY_QUERIES = {
  restaurant: ['restaurants', 'cafes', 'catering', 'food services', 'fine dining'],
  shop: ['local shops', 'retail stores', 'boutiques', 'specialty stores', 'local businesses'],
  healthcare: ['clinics', 'dentists', 'medical practices', 'healthcare businesses', 'wellness clinics'],
  office: ['local agencies', 'professional services', 'consulting firms', 'marketing agencies', 'business services'],
  tourism: ['hotels', 'guest houses', 'travel businesses', 'tour operators', 'hospitality businesses'],
  other: ['local businesses', 'small businesses', 'service businesses', 'local companies'],
}

function normalizeWebsite(raw) {
  if (!raw) return null
  const value = String(raw).trim()
  if (!value) return null
  if (!/^https?:\\/\\//i.test(value)) return `https://${value}`
  return value
}

function cleanText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim()
}

function normalizePhone(raw) {
  if (!raw) return null
  const value = String(raw).replace(/[^+\\d() .-]/g, ' ').replace(/\\s+/g, ' ').trim()
  return value || null
}

function normalizeEmail(raw) {
  if (!raw) return null
  const match = String(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i)
  return match ? match[0].toLowerCase() : null
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function safeHttpUrl(url) {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

async function fetchWithTimeout(url, options = {}, timeout = SEARCH_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, {
      ...options,
      headers: { 'User-Agent': UA, Accept: 'application/json,text/html;q=0.9,*/*;q=0.8', ...(options.headers || {}) },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function googleSearch(query, count = 10) {
  const key = process.env.GOOGLE_API_KEY
  const cx = process.env.GOOGLE_CSE_ID
  if (!key || !cx) return []
  const params = new URLSearchParams({ key, cx, q: query, num: String(Math.min(count, 10)), gl: 'us', hl: 'en' })
  const res = await fetchWithTimeout(`https://www.googleapis.com/customsearch/v1?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.items || []).map((x) => ({
    name: cleanText(x.title).replace(/ \\|.*$/, ''),
    website: safeHttpUrl(x.link),
    snippet: cleanText(x.snippet),
    source: 'google',
  }))
}

async function bingSearch(query, count = 10) {
  const key = process.env.BING_SEARCH_API_KEY
  if (!key) return []
  const params = new URLSearchParams({ q: query, count: String(Math.min(count, 50)), mkt: 'en-US', safeSearch: 'Moderate', textDecorations: 'false' })
  const res = await fetchWithTimeout(`https://api.bing.microsoft.com/v7.0/search?${params}`, {
    headers: { 'Ocp-Apim-Subscription-Key': key },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.webPages?.value || []).map((x) => ({
    name: cleanText(x.name).replace(/ \\|.*$/, ''),
    website: safeHttpUrl(x.url),
    snippet: cleanText(x.snippet),
    source: 'bing',
  }))
}

function extractSocialLinks(html) {
  const matches = html.match(/https?:\\/\\/[^"'\\s<>]+/gi) || []
  return [...new Set(matches.filter((url) => /facebook\\.com|instagram\\.com|linkedin\\.com|tiktok\\.com|youtube\\.com/i.test(url)))].slice(0, 8)
}

function extractContact(html) {
  const emails = [...new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi) || []).map((x) => x.toLowerCase()))]
    .filter((x) => !/example\\.com|noreply|no-reply|donotreply/i.test(x))
  const phones = [...new Set((html.match(/(?:\\+?1[ .-]?)?(?:\\(\\d{3}\\)|\\d{3})[ .-]?\\d{3}[ .-]?\\d{4}/g) || []).map(normalizePhone).filter(Boolean))]
  return { email: emails[0] || null, phone: phones[0] || null, socialLinks: extractSocialLinks(html) }
}

async function enrichWebsite(result) {
  if (!result.website) return result
  try {
    const res = await fetchWithTimeout(result.website, { redirect: 'manual' }, SEARCH_TIMEOUT)
    if (!res.ok || res.status >= 300) return result
    const html = await res.text()
    const contact = extractContact(html)
    const audit = await auditWebsite(result.website)
    return {
      ...result,
      email: contact.email,
      phone: contact.phone,
      socialLinks: contact.socialLinks,
      websiteAudit: audit,
    }
  } catch {
    return result
  }
}

async function limitedMap(items, limit, worker) {
  const queue = [...items]
  const output = []
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (!item) break
      output.push(await worker(item))
    }
  })
  await Promise.all(runners)
  return output
}

function gridPoints(place) {
  const { lat, lon, radius = 6500 } = place
  const latStep = radius / 111000
  const lonStep = radius / (111000 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2))
  const offsets = [
    [-0.75, -0.75], [-0.75, 0], [-0.75, 0.75],
    [0, -0.75], [0, 0], [0, 0.75],
    [0.75, -0.75], [0.75, 0], [0.75, 0.75],
  ]
  return offsets.map(([y, x]) => ({ lat: lat + y * latStep, lon: lon + x * lonStep }))
}

export async function discoverWebBusinesses({ place, city, state, categories = Object.keys(CATEGORY_QUERIES) }) {
  const cityText = [city, state, 'USA'].filter(Boolean).join(', ')
  const points = gridPoints(place)
  const queries = []
  const selected = categories.length ? categories : ['other']

  for (const category of selected) {
    for (const term of CATEGORY_QUERIES[category] || CATEGORY_QUERIES.other) {
      queries.push(`${term} in ${cityText}`)
    }
  }

  // Grid coordinates are used as discovery coverage signals, while search engines do the semantic lookup.
  const gridQueries = queries.flatMap((q) => points.slice(0, 3).map((p) => `${q} near ${p.lat.toFixed(3)},${p.lon.toFixed(3)}`))
  const cappedQueries = gridQueries.slice(0, 36)

  const [google, bing] = await Promise.all([
    Promise.all(cappedQueries.map((q) => googleSearch(q, 10))),
    Promise.all(cappedQueries.map((q) => bingSearch(q, 10))),
  ])

  let results = [...google.flat(), ...bing.flat()]
  results = results.filter((x) => x.name && x.website)
  const seenDomains = new Set()
  results = results.filter((x) => {
    const domain = domainOf(x.website)
    if (!domain || seenDomains.has(domain)) return false
    seenDomains.add(domain)
    return true
  }).slice(0, MAX_WEB_RESULTS)

  const enriched = await limitedMap(results, 6, enrichWebsite)

  return enriched.map((x) => ({
    ...x,
    websiteDomain: domainOf(x.website),
    hasWebsite: Boolean(x.website),
    hasEmail: Boolean(x.email),
    hasPhone: Boolean(x.phone),
    socialSignals: (x.socialLinks || []).length,
  })).slice(0, MAX_WEB_RESULTS)
}

export function webDiscoveryConfigured() {
  return {
    google: Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
    bing: Boolean(process.env.BING_SEARCH_API_KEY),
  }
}
