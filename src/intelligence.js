/**
 * Confidence Arise Growth — deterministic business intelligence.
 * This module intentionally uses only verifiable lead data and, when requested,
 * a bounded public website audit. It never invents reviews, revenue, owners, or SEO metrics.
 */

const SERVICE_RULES = [
  {
    id: 'ai-sales-assistant',
    name: 'AI Sales Assistant',
    when: (s) => s.website.present && !s.aiAssistant.detected,
    reason: 'A public website is present, but no conversational AI assistant was detected in the audited page.',
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture Optimization',
    when: (s) => s.website.present && !s.leadCapture.detected,
    reason: 'The audited page does not expose a clear contact/lead form.',
  },
  {
    id: 'ai-powered-website',
    name: 'AI-Powered Website',
    when: (s) => !s.website.present,
    reason: 'No business website was available in the discovered contact data, creating a clear digital presence opportunity.',
  },
  {
    id: 'whatsapp-automation',
    name: 'WhatsApp Automation',
    when: (s) => s.phone.present && !s.whatsappAutomation.detected,
    reason: 'A phone contact is available, but no WhatsApp automation signal was detected in the available data.',
  },
  {
    id: 'local-seo',
    name: 'Local SEO',
    when: (s) => s.website.present && (!s.website.title || !s.website.description),
    reason: 'The audited website is missing basic discoverability metadata (title/description).',
  },
]

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''))
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const h = url.hostname.toLowerCase()
    if (
      h === 'localhost' ||
      h === '::1' ||
      h.startsWith('127.') ||
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      h.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
    ) return null
    return url
  } catch {
    return null
  }
}

function hasAny(html, patterns) {
  return patterns.some((p) => p.test(html))
}

function textFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function analyzeBusiness(business, websiteAudit = null) {
  const websitePresent = Boolean(business?.website)
  const phonePresent = Boolean(business?.phone)
  const emailPresent = Boolean(business?.email)
  const addressPresent = Boolean(business?.address && business.address !== 'Address not listed')

  const website = {
    present: websitePresent,
    reachable: websiteAudit?.reachable ?? null,
    title: websiteAudit?.title || null,
    description: websiteAudit?.description || null,
    mobile: websiteAudit?.mobile ?? null,
  }

  const signals = {
    website,
    seo: {
      detected: websiteAudit ? Boolean(websiteAudit.title || websiteAudit.description) : null,
      title: website.title,
      description: website.description,
    },
    localSeo: { detected: null },
    reviews: { detected: false, count: null },
    socialPresence: {
      detected: websiteAudit?.socialLinks?.length ? true : null,
      links: websiteAudit?.socialLinks || [],
    },
    booking: { detected: websiteAudit?.bookingDetected ?? null },
    ecommerce: { detected: websiteAudit?.ecommerceDetected ?? null },
    aiAssistant: { detected: websiteAudit?.aiAssistantDetected ?? null },
    leadCapture: { detected: websiteAudit?.leadCaptureDetected ?? null },
    mobileExperience: { detected: websiteAudit?.mobile ?? null },
    phone: { present: phonePresent },
    email: { present: emailPresent },
    whatsappAutomation: { detected: websiteAudit?.whatsappDetected ?? null },
    address: { present: addressPresent },
  }

  // Unknown signals contribute no points. Score is an opportunity score, not a quality score.
  let score = 0
  const breakdown = []

  const add = (label, value, max, reason) => {
    const points = clamp(value, 0, max)
    score += points
    breakdown.push({ label, points, max, reason })
  }

  // Website / conversion: missing website is a larger opportunity; weak audited website is also actionable.
  if (!websitePresent) {
    add('Website / Conversion', 20, 20, 'No website was present in the discovered business data.')
  } else if (websiteAudit) {
    let points = 4
    if (!websiteAudit.leadCaptureDetected) points += 5
    if (!websiteAudit.bookingDetected && /restaurant|cafe|salon|spa|hotel|clinic|dentist|doctor/i.test(business.category || '')) points += 3
    if (!websiteAudit.mobile) points += 3
    if (!websiteAudit.aiAssistantDetected) points += 3
    if (!websiteAudit.title || !websiteAudit.description) points += 2
    add('Website / Conversion', points, 20, 'Opportunity is based on audited website gaps.')
  } else {
    add('Website / Conversion', 6, 20, 'Website exists but has not been audited yet.')
  }

  if (!websitePresent) {
    add('SEO / Local Visibility', 14, 20, 'Website presence is missing, so there is a clear digital visibility gap.')
  } else if (websiteAudit) {
    let points = 3
    if (!websiteAudit.title) points += 5
    if (!websiteAudit.description) points += 4
    if (!websiteAudit.socialLinks?.length) points += 2
    add('SEO / Local Visibility', points, 20, 'Based only on observable website metadata and links.')
  } else {
    add('SEO / Local Visibility', 5, 20, 'Website exists but SEO signals have not been audited.')
  }

  let capture = 0
  if (emailPresent) capture += 3
  if (phonePresent) capture += 3
  if (websitePresent && websiteAudit && !websiteAudit.leadCaptureDetected) capture += 6
  if (!websitePresent) capture += 3
  add('Lead Capture', capture, 15, websiteAudit ? 'Based on available contacts and audited lead-capture signals.' : 'Based on available contact data; website capture is not yet audited.')

  let demand = 0
  if (emailPresent) demand += 4
  if (phonePresent) demand += 4
  if (addressPresent) demand += 3
  if (business.category) demand += 2
  add('Customer Demand Signals', demand, 15, 'These are contact/market-presence signals, not fabricated review or revenue data.')

  let ai = 0
  if (websitePresent && websiteAudit && !websiteAudit.aiAssistantDetected) ai += 7
  if (websitePresent && websiteAudit && !websiteAudit.leadCaptureDetected) ai += 4
  if (phonePresent) ai += 2
  add('AI / Automation Opportunity', ai, 10, 'Based on observable conversational and automation signals.')

  const opportunities = []
  for (const rule of SERVICE_RULES) {
    if (rule.when(signals)) opportunities.push({ id: rule.id, name: rule.name, reason: rule.reason })
  }

  const recommendedServices = opportunities.slice(0, 4)
  const reasoning = []
  if (!websitePresent) reasoning.push('No website was present in the discovered contact data.')
  else if (websiteAudit) {
    if (!websiteAudit.leadCaptureDetected) reasoning.push('No clear lead-capture form was detected on the audited page.')
    if (!websiteAudit.aiAssistantDetected) reasoning.push('No conversational AI assistant signal was detected on the audited page.')
    if (!websiteAudit.mobile) reasoning.push('No mobile viewport metadata was detected.')
    if (!websiteAudit.title || !websiteAudit.description) reasoning.push('Basic page metadata is incomplete.')
  }
  if (phonePresent || emailPresent) reasoning.push('Direct contact information is available for outreach.')
  if (!reasoning.length) reasoning.push('Additional website analysis is needed before making a stronger recommendation.')

  const confidenceScore = websiteAudit ? 85 : 55

  return {
    businessId: business?.id || null,
    businessName: business?.name || 'Unknown business',
    category: business?.category || null,
    location: business?.address || null,
    signals,
    opportunityScore: clamp(score),
    confidenceScore,
    breakdown,
    opportunities: reasoning.slice(0, 5),
    recommendedServices,
    reasoning: reasoning.slice(0, 5),
    analyzedAt: new Date().toISOString(),
    source: websiteAudit ? 'business-data+public-website-audit' : 'business-data',
  }
}

export async function auditWebsite(website) {
  const url = safeUrl(website)
  if (!url) return { reachable: false, error: 'Unsupported or unsafe website URL.' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ConfidenceAriseGrowthBot/1.0 (+https://confidencearise.com)' },
    })
    if (!res.ok) return { reachable: false, status: res.status }
    const html = (await res.text()).slice(0, 600000)
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]?.trim() ||
      null
    const socialLinks = [...html.matchAll(/https?:\/\/(?:www\.)?(?:facebook|instagram|linkedin|youtube|tiktok)\.com\/[^"'\s<>]*/gi)]
      .map((m) => m[0])
      .slice(0, 8)
    const text = textFromHtml(html).toLowerCase()
    const bookingDetected = hasAny(html, [/book\s*(now|online)/i, /reserve/i, /appointment/i, /reservat/i, /calendly/i])
    const ecommerceDetected = hasAny(html, [/add to cart/i, /shopify/i, /woocommerce/i, /product-page/i])
    const aiAssistantDetected = hasAny(html, [/intercom/i, /drift/i, /zendesk/i, /tawk\.to/i, /chatwoot/i, /crisp/i, /livechat/i, /chatbot/i, /\bchat\b/i])
    const leadCaptureDetected =
      /<form\b/i.test(html) ||
      hasAny(html, [/contact us/i, /request a quote/i, /get a quote/i, /get in touch/i, /subscribe/i])
    const whatsappDetected = /wa\.me\//i.test(html) || /whatsapp/i.test(text)
    const mobile = /<meta[^>]+name=["']viewport["']/i.test(html)
    return {
      reachable: true,
      status: res.status,
      title,
      description,
      socialLinks,
      bookingDetected,
      ecommerceDetected,
      aiAssistantDetected,
      leadCaptureDetected,
      whatsappDetected,
      mobile,
      textSample: text.slice(0, 500),
    }
  } catch (error) {
    return { reachable: false, error: error?.name === 'AbortError' ? 'Website audit timed out.' : 'Website could not be reached.' }
  } finally {
    clearTimeout(timer)
  }
}

export function baselineBusinessAnalysis(business) {
  return analyzeBusiness(business)
}
