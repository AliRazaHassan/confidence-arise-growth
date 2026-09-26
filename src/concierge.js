import { funnelAnalytics, listDueFollowUps, listLeadCRM, listLeads, listReplies } from './store.js'

function leadName(id, leads) {
  return leads.find((x) => x.id === id)?.name || 'a lead'
}

export function conciergeSnapshot() {
  const stats = funnelAnalytics()
  const leads = listLeads(2000)
  const crm = listLeadCRM(2000)
  const replies = listReplies(100)
  const due = listDueFollowUps(new Date(), 100)
  const hotReplies = replies.filter((r) => ['interested', 'meeting_request', 'question', 'objection'].includes(r.classification)).slice(0, 8)
  const opportunities = leads
    .filter((x) => !x.crm || x.crm.status === 'new')
    .sort((a, b) => Number(b.opportunityScore || b.intelligence?.opportunityScore || 0) - Number(a.opportunityScore || a.intelligence?.opportunityScore || 0))
    .slice(0, 8)
  const proposals = crm.filter((x) => x.status === 'proposal').sort((a,b) => Number(b.dealValue||0)-Number(a.dealValue||0)).slice(0,8)
  const tasks = []
  for (const r of hotReplies.slice(0, 3)) tasks.push({ priority: 'high', type: 'reply', leadId: r.businessId, title: `Reply to ${leadName(r.businessId, leads)}`, detail: r.nextAction || 'Review the inbound reply.' })
  for (const d of due.slice(0, 3)) tasks.push({ priority: 'high', type: 'followup', leadId: d.id, title: `Follow up with ${d.name}`, detail: `Follow-up #${Math.min(Number(d.crm?.followUpCount || 0)+1,3)} is due.` })
  for (const p of proposals.slice(0, 2)) tasks.push({ priority: 'medium', type: 'pipeline', leadId: p.id, title: `Advance proposal: ${leadName(p.id, leads)}`, detail: p.dealValue ? `USD ${Number(p.dealValue).toLocaleString()} is in proposal stage.` : 'Proposal is waiting for the next action.' })
  if (!tasks.length && opportunities.length) tasks.push({ priority: 'medium', type: 'leadgen', leadId: opportunities[0].id, title: 'Work the strongest new opportunity', detail: `${opportunities[0].name} currently ranks highest among unworked leads.` })
  return { stats, due, hotReplies, opportunities, proposals, tasks: tasks.slice(0,8) }
}

function includesAny(q, words) { return words.some((w) => q.includes(w)) }

export function answerConcierge(message) {
  const q = String(message || '').trim().toLowerCase()
  const s = conciergeSnapshot()
  if (!q) return { answer: 'Ask me about leads, follow-ups, replies, pipeline, revenue, or what you should do next.', ...s }
  if (includesAny(q, ['what should', 'next action', 'today', 'priority', 'karna', 'kya kar'])) {
    const lines = s.tasks.slice(0,5).map((x,i) => `${i+1}. ${x.title} — ${x.detail}`)
    return { answer: lines.length ? `Your priority queue:\n${lines.join('\n')}` : 'Nothing urgent is due. Generate fresh leads and start with the highest opportunity scores.', ...s }
  }
  if (includesAny(q, ['follow', 'due'])) return { answer: s.due.length ? `${s.due.length} follow-ups are due. Highest priority: ${s.due.slice(0,5).map(x=>x.name).join(', ')}.` : 'No follow-ups are due right now.', ...s }
  if (includesAny(q, ['reply', 'interested', 'objection'])) return { answer: s.hotReplies.length ? `${s.hotReplies.length} recent actionable replies need attention. ${s.hotReplies.slice(0,4).map(x=>`${leadName(x.businessId, listLeads(2000))}: ${x.classification}${x.objection ? ' ('+x.objection+')' : ''}`).join('; ')}.` : 'There are no recent actionable replies in the inbox.', ...s }
  if (includesAny(q, ['pipeline', 'revenue', 'money', 'sales'])) return { answer: `Pipeline value is USD ${Number(s.stats.pipelineValue||0).toLocaleString()}, won revenue is USD ${Number(s.stats.wonRevenue||0).toLocaleString()}, with ${s.stats.proposals} proposals and ${s.stats.won} won deals.`, ...s }
  if (includesAny(q, ['lead', 'prospect', 'opportunit'])) return { answer: s.opportunities.length ? `I found ${s.opportunities.length} strong unworked leads in current data. Start with: ${s.opportunities.slice(0,5).map(x=>`${x.name} (${x.opportunityScore || x.intelligence?.opportunityScore || 0})`).join(', ')}.` : 'There are no unworked scored leads in the current CRM. Use Find leads to generate a fresh batch.', ...s }
  return { answer: `Current picture: ${s.stats.leads} leads, ${s.stats.contacted} contacted, ${s.stats.replied} replies, ${s.stats.followUpsDue} follow-ups due, and USD ${Number(s.stats.pipelineValue||0).toLocaleString()} pipeline value. Ask “what should I do today?” for a prioritized action queue.`, ...s }
}
