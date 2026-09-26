/** Outreach message templates for Confidence Arise */

export function defaultEmailSubject(businessName) {
  return `${businessName} × Confidence Arise — a growth opportunity`
}

export function defaultEmailBody(business, { siteUrl, fromName }) {
  const name = business.name || 'there'
  const score = business.opportunityScore
  const service = business.recommendedServices?.[0]?.name
  const reasons = (business.opportunities || []).slice(0, 2)
  const opportunity = service
    ? `One opportunity I noticed is ${service.toLowerCase()}.`
    : 'I noticed a few areas where your digital customer journey may have room to improve.'
  const evidence = reasons.length ? `\n\nA couple of signals behind that:\n- ${reasons.join('\n- ')}` : ''
  const scoreLine = Number.isFinite(score) ? `\n\nOur initial growth-opportunity assessment is ${score}/100.` : ''
  return `Hi ${name} team,\n\nI came across ${name} and took a quick look at the publicly available business information.\n\n${opportunity}${evidence}${scoreLine}\n\nWe help local businesses turn these gaps into better websites, AI sales assistance, lead capture and follow-up systems.\n\nIf useful, I can show you a short example tailored to ${name}.\n\nBest,\n${fromName}\n${siteUrl}`
}

export function defaultWhatsAppBody(business, { siteUrl, fromName }) {
  const name = business.name || 'there'
  const service = business.recommendedServices?.[0]?.name
  const reason = business.opportunities?.[0]
  return `Hi ${name} 👋 — this is ${fromName}. I came across your business and noticed ${reason ? reason.charAt(0).toLowerCase() + reason.slice(1) : 'a potential digital growth opportunity'}. ${service ? `We can help with ${service.toLowerCase()}.` : ''} Open to a quick look? ${siteUrl} Reply STOP to opt out.`
}

export function toWhatsAppDigits(phone) {
  if (!phone) return null
  let digits = String(phone).replace(/[^\\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  digits = digits.replace(/\\D/g, '')
  if (digits.length === 10) digits = `1${digits}`
  if (digits.length < 10 || digits.length > 15) return null
  return digits
}
