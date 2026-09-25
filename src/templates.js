/** Outreach message templates for Confidence Arise */

export function defaultEmailSubject(businessName) {
  return `${businessName} × Confidence Arise — grow your online presence`
}

export function defaultEmailBody(business, { siteUrl, fromName }) {
  const name = business.name || 'there'
  return `Hi ${name} team,

I came across your business and wanted to reach out from ${fromName}.

We help US local businesses get a stronger website, clearer online presence, and more customer inquiries — without the usual agency runaround.

Worth a quick look? ${siteUrl}

If this isn't relevant, just reply "no thanks" and we won't follow up.

Best,
${fromName}
${siteUrl}`
}

export function defaultWhatsAppBody(business, { siteUrl, fromName }) {
  const name = business.name || 'there'
  return `Hi ${name} 👋 — this is ${fromName}. We help local US businesses grow online (${siteUrl}). Open to a short chat about your site / leads? Reply STOP to opt out.`
}

/** E.164-ish phone for WhatsApp Cloud API */
export function toWhatsAppDigits(phone) {
  if (!phone) return null
  let digits = String(phone).replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  digits = digits.replace(/\D/g, '')
  // US numbers often stored as 10-digit local
  if (digits.length === 10) digits = `1${digits}`
  if (digits.length < 10 || digits.length > 15) return null
  return digits
}
