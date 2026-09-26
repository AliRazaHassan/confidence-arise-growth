import nodemailer from 'nodemailer'
import { toWhatsAppDigits } from './templates.js'
import { getEmailSettings } from './emailSettings.js'

/**
 * Send email via Resend API
 * https://resend.com/docs/api-reference/emails/send-email
 */
export async function sendEmail({ to, subject, text, html }) {
  const smtp = getEmailSettings({ includeSecret: true })
  if (smtp?.configured && smtp.password) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.email, pass: smtp.password },
      })
      const info = await transporter.sendMail({
        from: `${smtp.fromName} <${smtp.email}>`,
        to,
        subject,
        text,
        html: html || undefined,
      })
      return { ok: true, id: info.messageId, provider: `smtp-${smtp.provider}` }
    } catch (err) {
      return { ok: false, error: err.message || 'SMTP send failed', provider: `smtp-${smtp.provider}` }
    }
  }

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL || 'hello@confidencearise.com'
  const fromName = process.env.FROM_NAME || 'Confidence Arise'

  if (!apiKey) return { ok: false, dryRun: true, error: 'No email account configured.', preview: { to, subject, text } }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, text, html: html || undefined }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: data.message || data.error || `Resend ${res.status}`, raw: data }
  return { ok: true, id: data.id, provider: 'resend' }
}

export async function testEmailConnection(settings) {
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.email, pass: settings.password },
  })
  await transporter.verify()
  return { ok: true }
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
