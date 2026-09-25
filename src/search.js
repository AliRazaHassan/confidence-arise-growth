import { cityCoords, stateName, COUNTRY } from './usa.js'

const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const UA =
  'ConfidenceAriseGrowth/1.1 (https://confidencearise.com; USA business outreach)'
const MAX_RESULTS = 800

const SKIP_AMENITY = new Set([
  'parking',
  'parking_space',
  'bicycle_parking',
  'bench',
  'waste_basket',
  'recycling',
  'toilets',
  'drinking_water',
  'fountain',
  'post_box',
  'vending_machine',
  'charging_station',
])

function normalizeWebsite(raw) {
  if (!raw) return null
  const value = String(raw).trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function normalizePhone(raw) {
  if (!raw) return null
  const value = String(raw).split(';')[0].split('/')[0].trim()
  return value || null
}

function normalizeEmail(raw) {
  if (!raw) return null
  const value = String(raw).split(';')[0].trim()
  if (!value.includes('@')) return null
  return value
}

function buildAddress(tags = {}) {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'] || tags['addr:town'],
    tags['addr:state'],
    tags['addr:postcode'],
  ].filter(Boolean)
  if (parts.length) return parts.join(', ')
  return tags['addr:full'] || null
}

function categoryFromTags(tags = {}) {
  if (tags.shop) return `Shop · ${tags.shop.replace(/_/g, ' ')}`
  if (tags.amenity) return `Amenity · ${tags.amenity.replace(/_/g, ' ')}`
  if (tags.office) return `Office · ${tags.office.replace(/_/g, ' ')}`
  if (tags.craft) return `Craft · ${tags.craft.replace(/_/g, ' ')}`
  if (tags.tourism) return `Tourism · ${tags.tourism.replace(/_/g, ' ')}`
  if (tags.healthcare) return `Healthcare · ${tags.healthcare.replace(/_/g, ' ')}`
  return 'Business'
}

function categoryBucket(tags = {}) {
  if (tags.shop || tags.craft) return 'shop'
  if (
    tags.amenity &&
    /restaurant|cafe|bar|fast_food|pub|biergarten|ice_cream|food_court/.test(tags.amenity)
  ) {
    return 'restaurant'
  }
  if (tags.office) return 'office'
  if (tags.healthcare || tags.amenity === 'pharmacy' || tags.amenity === 'clinic') {
    return 'healthcare'
  }
  if (tags.tourism) return 'tourism'
  return 'other'
}

function isBusinessLike(tags = {}) {
  if (tags.amenity && SKIP_AMENITY.has(tags.amenity)) return false
  return Boolean(
    tags.shop ||
      tags.amenity ||
      tags.office ||
      tags.craft ||
      tags.tourism ||
      tags.healthcare,
  )
}

function elementToBusiness(el) {
  const tags = el.tags || {}
  const name = (tags.name || tags.brand || tags.operator || '').trim()
  if (!name || name.length < 2) return null
  if (!isBusinessLike(tags)) return null

  const phone = normalizePhone(
    tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags['contact:mobile'],
  )
  const email = normalizeEmail(tags.email || tags['contact:email'])
  const website = normalizeWebsite(
    tags.website || tags['contact:website'] || tags.url || tags['contact:facebook'],
  )

  return {
    id: `${el.type}/${el.id}`,
    name,
    category: categoryFromTags(tags),
    bucket: categoryBucket(tags),
    address: buildAddress(tags) || 'Address not listed',
    phone,
    email,
    website,
    hasPhone: Boolean(phone),
    hasEmail: Boolean(email),
    hasWebsite: Boolean(website),
    lat: el.lat ?? el.center?.lat ?? null,
    lon: el.lon ?? el.center?.lon ?? null,
  }
}

async function geocodeOpenMeteo(city, stateCode) {
  const query = stateCode ? `${city}, ${stateName(stateCode)}` : city
  const params = new URLSearchParams({
    name: query,
    countryCode: 'US',
    count: '8',
    language: 'en',
  })
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!res.ok) return null
  const data = await res.json()
  let rows = (data.results || []).filter((r) => (r.country_code || '').toUpperCase() === 'US')
  if (stateCode) {
    const st = stateName(stateCode).toLowerCase()
    const narrowed = rows.filter(
      (r) =>
        String(r.admin1 || '').toLowerCase() === st ||
        String(r.admin1 || '').toLowerCase().includes(st.split(' ')[0]),
    )
    if (narrowed.length) rows = narrowed
  }
  if (!rows.length) return null
  const best = rows[0]
  return {
    lat: best.latitude,
    lon: best.longitude,
    label: [best.name, best.admin1 || stateCode, 'USA'].filter(Boolean).join(', '),
    radius: 4000,
  }
}

async function geocodeUsa({ state, city, postalCode }) {
  const stateCode = String(state || '').trim().toUpperCase()
  const cityName = (city || '').trim()
  const zip = (postalCode || '').trim()

  if (!stateCode && !cityName && !zip) {
    throw new Error('Select a US state and city, or enter a ZIP.')
  }

  const radius = zip && !cityName ? 2500 : 4000

  if (stateCode && cityName) {
    const hit = cityCoords(stateCode, cityName)
    if (hit) {
      const [lat, lon] = hit
      return {
        lat,
        lon,
        radius,
        label: `${cityName}, ${stateCode}${zip ? ` ${zip}` : ''}, USA`,
        state: stateCode,
        city: cityName,
      }
    }
  }

  if (cityName) {
    const om = await geocodeOpenMeteo(cityName, stateCode)
    if (om) {
      om.radius = radius
      om.state = stateCode
      om.city = cityName
      return om
    }
  }

  if (zip) {
    const om = await geocodeOpenMeteo(zip, stateCode)
    if (om) {
      om.radius = 2500
      om.state = stateCode
      return om
    }
  }

  throw new Error('Could not look up that place. Pick state + city again.')
}

function buildMainQuery(place) {
  const { lat, lon, radius: r } = place
  const amenity =
    'restaurant|cafe|bar|fast_food|pub|pharmacy|bank|clinic|dentists|doctors|hospital|cinema|theatre|marketplace|post_office|fuel'
  return `
[out:json][timeout:20];
(
  node(around:${r},${lat},${lon})[name][shop];
  node(around:${r},${lat},${lon})[name][office];
  node(around:${r},${lat},${lon})[name][craft];
  node(around:${r},${lat},${lon})[name][amenity~"${amenity}"];
  node(around:${r},${lat},${lon})[name][tourism];
  node(around:${r},${lat},${lon})[name][healthcare];
);
out body ${MAX_RESULTS};
`.trim()
}

async function fetchOverpass(query, timeoutMs = 18000) {
  let lastError = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': UA,
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
      clearTimeout(timer)
      if ([429, 502, 503, 504, 406].includes(res.status)) {
        lastError = new Error(`Overpass ${res.status}`)
        continue
      }
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`)
        continue
      }
      const text = await res.text()
      if (text.trimStart().startsWith('<')) {
        lastError = new Error('Overpass error page')
        continue
      }
      const data = JSON.parse(text)
      if (Array.isArray(data.elements) && data.elements.length) return data
      lastError = new Error('Empty Overpass')
    } catch (err) {
      clearTimeout(timer)
      lastError = err
    }
  }
  throw lastError || new Error('Business lookup failed.')
}

function dedupe(list) {
  const seen = new Set()
  const out = []
  for (const b of list) {
    if (!b) continue
    const key = `${b.name.toLowerCase()}|${(b.phone || '').toLowerCase()}|${(b.address || '').toLowerCase().slice(0, 36)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(b)
  }
  return out
}

function rank(b) {
  let s = 0
  if (b.hasEmail) s += 4
  if (b.hasPhone) s += 4
  if (b.hasWebsite) s += 2
  return s
}

export async function searchBusinesses({ state, city, postalCode }) {
  if (!String(state || '').trim() && !String(city || '').trim() && !String(postalCode || '').trim()) {
    throw new Error('Select a US state and city, or enter a ZIP.')
  }
  if (!String(state || '').trim() && !String(postalCode || '').trim()) {
    throw new Error('Select a US state first, then a city.')
  }

  const place = await geocodeUsa({
    state: state?.trim() || '',
    city: city?.trim() || '',
    postalCode: postalCode?.trim() || '',
  })

  let elements = []
  try {
    const data = await fetchOverpass(buildMainQuery(place))
    elements = data.elements || []
  } catch {
    const lighter = { ...place, radius: Math.max(Math.floor(place.radius * 0.7), 2000) }
    const data = await fetchOverpass(buildMainQuery(lighter))
    elements = data.elements || []
  }

  const businesses = dedupe(elements.map(elementToBusiness)).sort((a, b) => {
    const d = rank(b) - rank(a)
    if (d) return d
    return a.name.localeCompare(b.name)
  })

  if (!businesses.length) {
    throw new Error('No US businesses found near that place.')
  }

  return {
    place: { ...place, country: COUNTRY.name },
    businesses: businesses.slice(0, MAX_RESULTS),
    totalFound: businesses.length,
  }
}

export function applyLeadFilters(businesses, { category, contact, hasWebsite }) {
  let list = businesses
  if (category && category !== 'all') {
    list = list.filter((b) => b.bucket === category)
  }
  if (contact === 'email') list = list.filter((b) => b.hasEmail)
  if (contact === 'phone') list = list.filter((b) => b.hasPhone)
  if (contact === 'both') list = list.filter((b) => b.hasEmail && b.hasPhone)
  if (contact === 'reachable') list = list.filter((b) => b.hasEmail || b.hasPhone)
  if (hasWebsite === 'with') list = list.filter((b) => b.hasWebsite)
  if (hasWebsite === 'without') list = list.filter((b) => !b.hasWebsite)
  return list
}
