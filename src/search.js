import { analyzeBusiness, baselineBusinessAnalysis } from './intelligence.js'
import { discoverWebBusinesses, webDiscoveryConfigured } from './webDiscovery.js'
import { cityCoords, stateName, COUNTRY } from './usa.js'

const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const UA =
  'ConfidenceAriseGrowth/2.1 (https://confidencearise.com; USA outreach leads)'
const MAX_RESULTS = 1000
const GRID_OFFSETS = [[-0.7, -0.7], [-0.7, 0.7], [0.7, -0.7], [0.7, 0.7]]

const SKIP_AMENITY = new Set([
  'parking',
  'parking_space',
  'parking_entrance',
  'bicycle_parking',
  'motorcycle_parking',
  'bench',
  'waste_basket',
  'recycling',
  'toilets',
  'drinking_water',
  'fountain',
  'post_box',
  'vending_machine',
  'charging_station',
  'atm',
  'bureau_de_change',
  'taxi',
  'bus_station',
  'ferry_terminal',
  'fuel',
  'police',
  'fire_station',
  'townhall',
  'courthouse',
  'prison',
  'library',
  'college',
  'university',
  'school',
  'kindergarten',
  'place_of_worship',
  'community_centre',
  'social_facility',
  'shelter',
  'clock',
  'theatre',
  'cinema',
  'arts_centre',
  'nightclub',
])

const SKIP_TOURISM = new Set([
  'artwork',
  'information',
  'viewpoint',
  'attraction',
  'museum',
  'gallery',
  'picnic_site',
  'camp_site',
  'caravan_site',
  'zoo',
  'theme_park',
])

const SKIP_OFFICE = new Set(['diplomatic', 'government', 'ngo', 'political_party', 'religion'])
const SKIP_SHOP = new Set(['vacant', 'lottery', 'tobacco', 'weapons'])

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
  const value = String(raw).split(';')[0].trim().toLowerCase()
  if (!value.includes('@') || value.includes('example.com')) return null
  if (/^(noreply|no-reply|donotreply)@/i.test(value)) return null
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
  if (tags.healthcare || /pharmacy|clinic|dentist|dentists|doctor|doctors/.test(tags.amenity || '')) {
    return 'healthcare'
  }
  if (tags.tourism) return 'tourism'
  return 'other'
}

function isOutreachBusiness(tags = {}) {
  if (tags.amenity && SKIP_AMENITY.has(tags.amenity)) return false
  if (tags.tourism && SKIP_TOURISM.has(tags.tourism)) return false
  if (tags.office && SKIP_OFFICE.has(tags.office)) return false
  if (tags.shop && SKIP_SHOP.has(tags.shop)) return false

  return Boolean(
    tags.shop ||
      tags.office ||
      tags.craft ||
      tags.healthcare ||
      (tags.tourism && /hotel|guest_house|hostel|motel/.test(tags.tourism)) ||
      (tags.amenity &&
        /restaurant|cafe|bar|fast_food|pub|biergarten|ice_cream|food_court|pharmacy|clinic|dentist|dentists|doctor|doctors|veterinary|car_rental|car_wash|marketplace|post_office|bank/.test(
          tags.amenity,
        )),
  )
}

function leadScore(b) {
  let s = 0
  if (b.hasEmail) s += 5
  if (b.hasPhone) s += 4
  if (!b.hasWebsite) s += 6
  if (b.hasWebsite) s += 1
  if (b.address && b.address !== 'Address not listed') s += 2
  if (b.bucket === 'shop' || b.bucket === 'office' || b.bucket === 'healthcare') s += 2
  return s
}

function elementToBusiness(el) {
  const tags = el.tags || {}
  const name = (tags.name || tags.brand || tags.operator || '').trim()
  if (!name || name.length < 2) return null
  if (!isOutreachBusiness(tags)) return null

  const phone = normalizePhone(
    tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags['contact:mobile'],
  )
  const email = normalizeEmail(tags.email || tags['contact:email'])
  const website = normalizeWebsite(
    tags.website || tags['contact:website'] || tags.url || tags['contact:facebook'],
  )

  if (!phone && !email) return null

  const business = {
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
    outreachReady: Boolean((phone || email) && !website),
    lat: el.lat ?? el.center?.lat ?? null,
    lon: el.lon ?? el.center?.lon ?? null,
  }
  business.legacyScore = leadScore(business)
  business.intelligence = baselineBusinessAnalysis(business)
  business.opportunityScore = business.intelligence.opportunityScore
  business.confidenceScore = business.intelligence.confidenceScore
  business.recommendedServices = business.intelligence.recommendedServices
  business.opportunities = business.intelligence.reasoning
  return business
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
    radius: 6500,
  }
}

async function geocodeUsa({ state, city, postalCode }) {
  const stateCode = String(state || '').trim().toUpperCase()
  const cityName = (city || '').trim()
  const zip = (postalCode || '').trim()

  if (!stateCode && !cityName && !zip) {
    throw new Error('Select a US state and city, or enter a ZIP.')
  }

  const radius = zip && !cityName ? 3000 : 6500

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
      om.radius = 3000
      om.state = stateCode
      return om
    }
  }

  throw new Error('Could not look up that place. Pick state + city again.')
}

function categorySearchTerms(category) {
  const value = String(category || '').trim().toLowerCase()
  if (!value || value === 'business') return []
  const aliases = {
    'real estate': ['real estate', 'realtor', 'realty', 'estate agent', 'property management'],
    realtor: ['real estate', 'realtor', 'realty', 'estate agent'],
    dentist: ['dentist', 'dental clinic', 'dental office'],
    dentists: ['dentist', 'dental clinic', 'dental office'],
    restaurant: ['restaurant', 'restaurants'],
    cafe: ['cafe', 'coffee shop'],
  }
  return aliases[value] || [value]
}

function targetedOsmClauses(place, category) {
  const { lat, lon, radius: r } = place
  const value = String(category || '').trim().toLowerCase()
  if (!value || value === 'business') return ''
  const contactVariants = (selector) => [
    `node(around:${r},${lat},${lon})[name]${selector}[phone];`,
    `node(around:${r},${lat},${lon})[name]${selector}["contact:phone"];`,
    `node(around:${r},${lat},${lon})[name]${selector}[email];`,
    `node(around:${r},${lat},${lon})[name]${selector}["contact:email"];`,
  ].join('\n  ')

  if (/real\s*estate|realtor|realty|property/.test(value)) {
    return contactVariants('[office~"estate_agent|property_management|real_estate"]')
  }
  if (/dentist|dental/.test(value)) {
    return contactVariants('[amenity~"dentist|clinic"]')
  }
  if (/restaurant|cafe|coffee/.test(value)) {
    return contactVariants('[amenity~"restaurant|cafe|fast_food"]')
  }
  return ''
}

/** Proven-stable node query (volume + contact) plus category-targeted discovery. */
function buildNodeLeadQuery(place, category = '') {
  const { lat, lon, radius: r } = place
  const amenity =
    'restaurant|cafe|bar|fast_food|pub|biergarten|ice_cream|food_court|pharmacy|clinic|dentist|dentists|doctor|doctors|veterinary|car_rental|car_wash|marketplace|post_office|bank'
  const targeted = targetedOsmClauses(place, category)
  return `
[out:json][timeout:20];
(
  node(around:${r},${lat},${lon})[name][shop][phone];
  node(around:${r},${lat},${lon})[name][shop]["contact:phone"];
  node(around:${r},${lat},${lon})[name][shop][email];
  node(around:${r},${lat},${lon})[name][shop]["contact:email"];
  node(around:${r},${lat},${lon})[name][office][phone];
  node(around:${r},${lat},${lon})[name][office]["contact:phone"];
  node(around:${r},${lat},${lon})[name][office][email];
  node(around:${r},${lat},${lon})[name][office]["contact:email"];
  node(around:${r},${lat},${lon})[name][craft][phone];
  node(around:${r},${lat},${lon})[name][craft]["contact:phone"];
  node(around:${r},${lat},${lon})[name][craft][email];
  node(around:${r},${lat},${lon})[name][healthcare][phone];
  node(around:${r},${lat},${lon})[name][healthcare][email];
  node(around:${r},${lat},${lon})[name][amenity~"${amenity}"][phone];
  node(around:${r},${lat},${lon})[name][amenity~"${amenity}"]["contact:phone"];
  node(around:${r},${lat},${lon})[name][amenity~"${amenity}"][email];
  node(around:${r},${lat},${lon})[name][amenity~"${amenity}"]["contact:email"];
  node(around:${r},${lat},${lon})[name][tourism~"hotel|guest_house|hostel|motel"][phone];
  node(around:${r},${lat},${lon})[name][tourism~"hotel|guest_house|hostel|motel"][email];
  ${targeted}
);
out body ${MAX_RESULTS};
`.trim()
}

async function fetchOverpass(query, timeoutMs = 20000) {
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
  throw lastError || new Error('Lead lookup failed.')
}

function dedupe(list) {
  const seen = new Set()
  const out = []
  for (const b of list) {
    if (!b) continue
    const phone = String(b.phone || '').replace(/\D/g, '')
    const email = String(b.email || '').toLowerCase()
    const domain = (() => {
      try { return b.website ? new URL(b.website).hostname.replace(/^www\./i, '').toLowerCase() : '' } catch { return '' }
    })()
    const name = String(b.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const address = String(b.address || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

    const strongKeys = [
      phone && `p:${phone}`,
      email && `e:${email}`,
      domain && `d:${domain}`,
    ].filter(Boolean)
    if (strongKeys.some((key) => seen.has(key))) continue

    const fallbackKey = !strongKeys.length && name ? `n:${name}|a:${address}` : null
    if (fallbackKey && seen.has(fallbackKey)) continue

    strongKeys.forEach((key) => seen.add(key))
    if (fallbackKey) seen.add(fallbackKey)
    out.push(b)
  }
  return out
}

function webResultToBusiness(row, index) {
  const category = row.category || 'Business · Web discovery'
  const business = {
    id: `web/${row.websiteDomain || index}`,
    name: row.name,
    category,
    bucket: 'other',
    address: row.address || 'Address not listed',
    phone: normalizePhone(row.phone),
    email: normalizeEmail(row.email),
    website: normalizeWebsite(row.website),
    hasPhone: Boolean(row.phone),
    hasEmail: Boolean(row.email),
    hasWebsite: Boolean(row.website),
    socialLinks: row.socialLinks || [],
    socialSignals: row.socialSignals || 0,
    source: row.source || 'web-search',
    discoverySource: 'web',
    outreachReady: Boolean(row.phone || row.email),
    lat: null,
    lon: null,
  }
  business.legacyScore = leadScore(business)
  business.intelligence = analyzeBusiness(business, row.websiteAudit || null)
  business.opportunityScore = business.intelligence.opportunityScore
  business.confidenceScore = business.intelligence.confidenceScore
  business.recommendedServices = business.intelligence.recommendedServices
  business.opportunities = business.intelligence.reasoning
  return business
}

function gridPlaces(place) {
  const radius = Math.max(Math.floor((place.radius || 6500) * 0.65), 3500)
  const latStep = radius / 111000
  const lonStep = radius / (111000 * Math.max(Math.cos((place.lat * Math.PI) / 180), 0.2))
  return [
    place,
    ...GRID_OFFSETS.map(([y, x]) => ({
      ...place,
      lat: place.lat + y * latStep,
      lon: place.lon + x * lonStep,
      radius,
    })),
  ]
}

export async function searchBusinesses({ state, city, postalCode, category = '' }) {
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

  const places = gridPlaces(place)
  let elements = []
  const osmResults = await Promise.all(
    places.map(async (gridPlace) => {
      try {
        const data = await fetchOverpass(buildNodeLeadQuery(gridPlace, category), 16000)
        return data.elements || []
      } catch {
        return []
      }
    }),
  )
  elements = osmResults.flat()

  let webBusinesses = []
  try {
    webBusinesses = await discoverWebBusinesses({
      place,
      city: city?.trim() || place.city,
      state: state?.trim() || place.state,
      searchTerms: categorySearchTerms(category),
    })
  } catch {
    webBusinesses = []
  }

  const osmBusinesses = elements.map(elementToBusiness).filter(Boolean)
  const businesses = dedupe([
    ...osmBusinesses,
    ...webBusinesses.map(webResultToBusiness),
  ]).sort((a, b) => {
    const d = b.opportunityScore - a.opportunityScore
    if (d) return d
    return a.name.localeCompare(b.name)
  })

  if (!businesses.length) {
    throw new Error('No businesses were discovered here. Try another city or ZIP.')
  }

  const ready = businesses.filter((b) => b.outreachReady).length
  const withContact = businesses.filter((b) => b.hasPhone || b.hasEmail).length

  return {
    place: { ...place, country: COUNTRY.name },
    businesses: businesses.slice(0, MAX_RESULTS),
    totalFound: businesses.length,
    quality: {
      withContact,
      outreachReady: ready,
      sources: [...new Set(businesses.map((b) => b.discoverySource || 'osm'))],
      webDiscovery: webDiscoveryConfigured(),
    },
  }
}

export function applyLeadFilters(businesses, { category, contact, hasWebsite, outreachOnly }) {
  let list = businesses
  if (outreachOnly) list = list.filter((b) => b.outreachReady)
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
