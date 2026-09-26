import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { getEmailSettings } from './emailSettings.js'
import { findLeadByContact, recordInboundReply } from './store.js'

function imapConfig(account) {
  if (account.provider === 'gmail') return { host: 'imap.gmail.com', port: 993, secure: true }
  if (account.provider === 'outlook') return { host: 'outlook.office365.com', port: 993, secure: true }
  return {
    host: account.imapHost || account.host,
    port: Number(account.imapPort || 993),
    secure: account.imapSecure !== false,
  }
}

export async function syncEmailReplies({ maxMessages = 40 } = {}) {
  const account = getEmailSettings({ includeSecret: true })
  if (!account?.configured || !account.password) throw new Error('Connect an email account first.')
  const cfg = imapConfig(account)
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: account.email, pass: account.password },
    logger: false,
  })
  const summary = { checked: 0, matched: 0, recorded: 0 }
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const exists = Number(client.mailbox?.exists || 0)
      if (!exists) return summary
      const start = Math.max(1, exists - Math.max(1, Number(maxMessages)) + 1)
      for await (const message of client.fetch(`${start}:*`, { uid: true, envelope: true, source: true })) {
        summary.checked += 1
        const parsed = await simpleParser(message.source)
        const from = parsed.from?.value?.[0]?.address || message.envelope?.from?.[0]?.address || ''
        if (!from || from.toLowerCase() === account.email.toLowerCase()) continue
        const lead = findLeadByContact({ email: from })
        if (!lead) continue
        summary.matched += 1
        const text = String(parsed.text || parsed.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000)
        if (!text) continue
        const externalId = parsed.messageId || `imap:${account.email}:${message.uid}`
        recordInboundReply({ businessId: lead.id, channel: 'email', from, text, externalId })
        summary.recorded += 1
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
  return summary
}
