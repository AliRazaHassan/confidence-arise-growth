const ACTIVE_STATUSES = new Set(['contacted', 'replied', 'qualified', 'proposal'])

const CADENCE_DAYS = [3, 4, 7]

export function followUpStep(crm = {}, lead = {}) {
  const sent = Number(crm.followUpCount || 0)
  const contactCount = Number(lead.contactCount || 0)
  if (!ACTIVE_STATUSES.has(crm.status || 'new')) return 0
  if (!contactCount && crm.status === 'contacted') return 0
  return Math.min(sent + 1, 3)
}

export function isFollowUpStopped(crm = {}) {
  return ['won', 'lost', 'paused'].includes(crm.status) || Number(crm.followUpCount || 0) >= 3
}

export function defaultNextFollowUpAt(from = new Date(), followUpCount = 0) {
  const days = CADENCE_DAYS[Math.min(Number(followUpCount || 0), CADENCE_DAYS.length - 1)]
  const date = new Date(from)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export function followUpDue(crm = {}, lead = {}, now = new Date()) {
  if (isFollowUpStopped(crm)) return false
  if (!ACTIVE_STATUSES.has(crm.status || 'new')) return false
  const due = crm.nextFollowUpAt || (lead.lastContactAt ? defaultNextFollowUpAt(lead.lastContactAt, crm.followUpCount || 0) : null)
  return Boolean(due && new Date(due).getTime() <= now.getTime())
}

function contextLine(business, crm) {
  if (crm?.outcome) return `You mentioned / we noted: ${crm.outcome}.`
  const service = business?.recommendedServices?.[0]?.name
  if (service) return `I wanted to follow up on the ${service.toLowerCase()} opportunity I shared.`
  return 'I wanted to follow up on the growth opportunity I shared.'
}

export function buildFollowUp(business, crm = {}, config = {}) {
  const step = followUpStep(crm, { contactCount: 1 }) || 1
  const name = business?.name || 'your team'
  const fromName = config.fromName || 'Confidence Arise'
  const siteUrl = config.siteUrl || 'https://confidencearise.com'
  const context = contextLine(business, crm)

  const variants = {
    1: {
      subject: `Quick follow-up — ${name}`,
      email: `Hi ${name} team,\n\nJust following up on my earlier note. ${context}\n\nIf it helps, I can send a short, no-obligation example showing what this could look like specifically for ${name}.\n\nBest,\n${fromName}\n${siteUrl}`,
      whatsapp: `Hi ${name} 👋 Just following up on my earlier message. ${context} I can send a short example tailored to your business if useful. Reply STOP to opt out.`,
    },
    2: {
      subject: `One practical idea for ${name}`,
      email: `Hi ${name} team,\n\nOne more quick follow-up. ${context}\n\nRather than a long call, I can outline one practical improvement and the expected customer journey in a few bullets. Would that be useful?\n\nBest,\n${fromName}\n${siteUrl}`,
      whatsapp: `Hi ${name} — one more quick follow-up. I can outline one practical improvement for your customer journey in a few bullets, no call needed. Interested? Reply STOP to opt out.`,
    },
    3: {
      subject: `Closing the loop — ${name}`,
      email: `Hi ${name} team,\n\nI’ll close the loop after this note so I don’t crowd your inbox. ${context}\n\nIf improving this becomes a priority later, you can reach us anytime at ${siteUrl}.\n\nBest,\n${fromName}`,
      whatsapp: `Hi ${name} — I’ll close the loop after this so I don’t keep messaging. If this becomes useful later, you can reach us at ${siteUrl}. Reply STOP to opt out.`,
    },
  }
  return { step, final: step >= 3, ...variants[step] }
}
