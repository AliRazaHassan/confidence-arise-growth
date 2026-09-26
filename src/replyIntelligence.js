const POSITIVE = ['interested', 'sounds good', 'tell me more', 'yes', 'sure', 'send details', 'let us talk', "let's talk"]
const NEGATIVE = ['not interested', 'no thanks', 'no thank you', 'do not need', "don't need"]
const OBJECTIONS = {
  price: ['too expensive', 'expensive', 'budget', 'cost too much', 'price is high'],
  timing: ['not now', 'later', 'next month', 'busy', 'bad time'],
  trust: ['who are you', 'references', 'case study', 'proof', 'portfolio'],
  existing_solution: ['already have', 'already using', 'current agency', 'our provider'],
}

export function analyzeReply(text) {
  const value = String(text || '').trim().toLowerCase()
  if (!value) return { classification: 'unknown', objection: null, sentiment: 'neutral', nextAction: 'Review reply manually.' }
  if (/\b(stop|unsubscribe|remove me|do not contact|don't contact)\b/i.test(value)) return { classification: 'unsubscribe', objection: null, sentiment: 'negative', nextAction: 'Stop all automated outreach.' }
  if (NEGATIVE.some((x) => value.includes(x))) return { classification: 'not_interested', objection: null, sentiment: 'negative', nextAction: 'Close outreach respectfully and stop follow-ups.' }
  for (const [objection, phrases] of Object.entries(OBJECTIONS)) {
    if (phrases.some((x) => value.includes(x))) {
      const action = objection === 'price' ? 'Respond with value, scope, and a lower-friction option without discounting automatically.'
        : objection === 'timing' ? 'Acknowledge timing and ask permission for a specific later follow-up.'
        : objection === 'trust' ? 'Send relevant proof, portfolio, or case study and answer the concern directly.'
        : 'Differentiate the proposed improvement from their current solution and ask where gaps remain.'
      return { classification: 'objection', objection, sentiment: 'mixed', nextAction: action }
    }
  }
  if (/\b(meeting|call me|schedule|book a call|appointment|zoom|teams)\b/i.test(value)) return { classification: 'meeting_request', objection: null, sentiment: 'positive', nextAction: 'Offer concrete meeting times and move the lead toward qualification.' }
  if (/\b(price|pricing|cost|how much|quote|proposal|package)\b/i.test(value)) return { classification: 'question', objection: null, sentiment: 'positive', nextAction: 'Answer pricing/scope clearly and ask one qualification question.' }
  if (POSITIVE.some((x) => value.includes(x))) return { classification: 'interested', objection: null, sentiment: 'positive', nextAction: 'Qualify the need and propose the next concrete step.' }
  if (/\?|\b(how|what|when|where|can you|could you|do you)\b/i.test(value)) return { classification: 'question', objection: null, sentiment: 'neutral', nextAction: 'Answer the question directly, then ask one relevant qualification question.' }
  return { classification: 'unknown', objection: null, sentiment: 'neutral', nextAction: 'Review the reply and respond manually before continuing automation.' }
}

export function suggestedReply(lead, analysis) {
  const name = lead?.name || 'there'
  if (analysis.classification === 'meeting_request') return `Thanks for getting back to me. Happy to set up a quick call to discuss what would be most useful for ${name}. What day/time works best for you?`
  if (analysis.classification === 'interested') return `Thanks for getting back to me. I’d be happy to share a focused recommendation for ${name}. What is the biggest growth or lead-generation challenge you want to solve first?`
  if (analysis.classification === 'question') return `Thanks for the question. I can give you a clear answer based on what ${name} needs. Could you share the main outcome you want to achieve so I can keep the recommendation relevant?`
  if (analysis.classification === 'objection' && analysis.objection === 'price') return `I understand the budget concern. Rather than pushing a large scope, we can focus on the highest-impact piece first and make the value measurable. If useful, I can outline a smaller starting option for ${name}.`
  if (analysis.classification === 'objection' && analysis.objection === 'timing') return `Understood. I don’t want to add pressure at the wrong time. If you’d like, I can follow up at a more suitable date—what timing would work better for you?`
  if (analysis.classification === 'objection') return `Thanks for being direct. I understand the concern. I can address it with a specific example relevant to ${name} rather than sending a generic pitch. Would that be useful?`
  if (analysis.classification === 'not_interested' || analysis.classification === 'unsubscribe') return 'Understood. Thanks for letting me know. I will not send further follow-ups.'
  return `Thanks for getting back to me. I want to make sure I respond to what matters most for ${name}. Could you share a little more about what you’re looking for?`
}
