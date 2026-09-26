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

function compactContext(snapshot) {
  return {
    stats: snapshot.stats,
    priorityTasks: snapshot.tasks,
    dueFollowUps: snapshot.due.slice(0, 10).map((x) => ({ id: x.id, name: x.name, status: x.crm?.status, due: x.crm?.nextFollowUpAt })),
    actionableReplies: snapshot.hotReplies.slice(0, 10).map((x) => ({ leadId: x.businessId, classification: x.classification, objection: x.objection, nextAction: x.nextAction })),
    opportunities: snapshot.opportunities.slice(0, 10).map((x) => ({ id: x.id, name: x.name, score: x.opportunityScore || x.intelligence?.opportunityScore || 0 })),
  }
}

export async function answerConciergeAI(message) {
  const snapshot = conciergeSnapshot()
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ...answerConcierge(message), aiPowered: false, aiError: 'OPENAI_API_KEY is not configured.' }

  const system = `You are the AI Growth Concierge inside a lead-generation CRM. Be concise, practical and grounded only in the supplied workspace data. Help the operator prioritize leads, replies, follow-ups, pipeline and revenue. Never claim an action was executed unless the application actually executed it. When useful, give a short numbered action plan. If workspace data does not support a claim, say so.`
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_CONCIERGE_MODEL || 'gpt-5.6-luna',
        input: [
          { role: 'system', content: [{ type: 'input_text', text: system }] },
          { role: 'user', content: [{ type: 'input_text', text: `Workspace data:\n${JSON.stringify(compactContext(snapshot))}\n\nUser request: ${String(message || '')}` }] },
        ],
        max_output_tokens: 700,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message || `OpenAI API ${res.status}`)
    const answer = data.output_text || data.output?.flatMap((x) => x.content || []).find((x) => x.type === 'output_text')?.text
    if (!answer) throw new Error('OpenAI returned no text response.')
    return { ...snapshot, answer, aiPowered: true }
  } catch (err) {
    return { ...answerConcierge(message), aiPowered: false, aiError: err.message }
  }
}

export async function testConciergeAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ok: false, configured: false, error: 'OPENAI_API_KEY is not configured.' }
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.OPENAI_CONCIERGE_MODEL || 'gpt-5.6-luna', input: 'Reply with OK.', max_output_tokens: 10 }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, configured: true, error: data?.error?.message || `OpenAI API ${res.status}` }
    return { ok: true, configured: true, model: process.env.OPENAI_CONCIERGE_MODEL || 'gpt-5.6-luna' }
  } catch (err) {
    return { ok: false, configured: true, error: err.message }
  }
}
