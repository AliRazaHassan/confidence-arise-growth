import { toWhatsAppDigits } from './templates.js'

/**
 * Send email via Resend API
 * https://resend.com/docs/api-reference/emails/send-email
 */
export async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL || 'hello@confidencearise.com'
  const fromName = process.env.FROM_NAME || 'Confidence Arise'

  if (!apiKey) {
    return {
      ok: false,
      dryRun: true,
      error: 'RESEND_API_KEY not set — email not sent (dry run).',
      preview: { to, subject, text },
    }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text,
      html: html || undefined,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || data.error || `Resend ${res.status}`,
      raw: data,
    }
  }

  return { ok: true, id: data.id, provider: 'resend' }
}

/**
 * Send WhatsApp text via Meta Cloud API
 * https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */
export async function sendWhatsApp({ phone, text }) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'
  const to = toWhatsAppDigits(phone)

  if (!to) {
    return { ok: false, error: 'Invalid or missing phone number for WhatsApp.' }
  }

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      dryRun: true,
      error: 'WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set — message not sent (dry run).',
      preview: { to, text },
    }
  }

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: true, body: text },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `WhatsApp API ${res.status}`
    return { ok: false, error: msg, raw: data }
  }

  return {
    ok: true,
    id: data?.messages?.[0]?.id,
    provider: 'whatsapp-cloud',
    to,
  }
}
