import { useCallback, useEffect, useMemo, useState } from 'react'
import { US_STATES, citiesForState, CATEGORY_FILTERS } from './usa.js'
import { applyLeadFilters } from './search.js'

const NAV = [
  { id: 'dashboard', label: 'Command Center' },
  { id: 'find', label: 'Find leads' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
]

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusTone(status) {
  if (status === 'sent') return 'ok'
  if (status === 'dry_run') return 'warn'
  return 'bad'
}

function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('naeemah@confidencearise.org')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Login failed')
      onLoggedIn({ email: data.email, name: data.name })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-visual" aria-hidden="true" />
      <form className="login-panel" onSubmit={onSubmit}>
        <p className="brand-mark">Confidence Arise</p>
        <h1>Growth Agent</h1>
        <p className="sub">Private workspace for US outreach — Naeema only.</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Enter workspace'}
        </button>
      </form>
    </div>
  )
}

function HistoryView() {
  const [tab, setTab] = useState('submissions')
  const [searches, setSearches] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [leads, setLeads] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [replies, setReplies] = useState([])
  const [followUpPreview, setFollowUpPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [s, sub, l, f, r] = await Promise.all([
        fetch('/api/history/searches?limit=50', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/history/submissions?limit=100', { credentials: 'include' }).then((r) =>
          r.json(),
        ),
        fetch('/api/history/leads?limit=200', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/crm/follow-ups?limit=100', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/crm/replies?limit=100', { credentials: 'include' }).then((r) => r.json()),
      ])
      setSearches(s.items || [])
      setSubmissions(sub.items || [])
      setLeads(l.items || [])
      setFollowUps(f.items || [])
      setReplies(r.items || [])
    } catch (err) {
      setError(err.message || 'Could not load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function syncEmailRepliesNow() {
    setError('')
    try {
      const res = await fetch('/api/crm/replies/sync-email', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Email sync failed')
      setReplies(data.items || [])
      setTab('replies')
    } catch (err) { setError(err.message) }
  }

  async function sendFollowUp() {
    if (!followUpPreview?.lead) return
    setError('')
    const lead = followUpPreview.lead
    const channels = [lead.email ? 'email' : null, lead.phone ? 'whatsapp' : null].filter(Boolean)
    if (!channels.length) {
      setError('This lead has no email or phone for follow-up.')
      return
    }
    try {
      const res = await fetch(`/api/crm/lead/${encodeURIComponent(lead.id)}/follow-up/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ business: lead, channels }),
      })
      const data = await res.json()
      if (!res.ok && res.status !== 207) throw new Error(data.error || 'Follow-up failed')
      if (data.status !== 'sent') throw new Error('Follow-up was not fully sent. Check outreach provider configuration.')
      setFollowUpPreview(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function previewFollowUp(lead) {
    setError('')
    try {
      const res = await fetch(`/api/crm/lead/${encodeURIComponent(lead.id)}/follow-up/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ business: lead }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate follow-up')
      setFollowUpPreview({ lead, ...data })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="view history-view">
      <header className="view-head">
        <div>
          <h2>History</h2>
          <p>Previous searches, outreach submissions, and contacted leads.</p>
        </div>
        <div className="head-actions"><button type="button" className="btn-ghost" onClick={syncEmailRepliesNow}>Sync email replies</button><button type="button" className="btn-ghost" onClick={load} disabled={loading}>Refresh</button></div>
      </header>

      <div className="tabs" role="tablist">
        {[
          { id: 'followups', label: `Due follow-ups (${followUps.length})` },
          { id: 'replies', label: `Replies (${replies.length})` },
          { id: 'submissions', label: `Submissions (${submissions.length})` },
          { id: 'leads', label: `Leads (${leads.length})` },
          { id: 'searches', label: `Searches (${searches.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={tab === t.id ? 'tab on' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading history…</p> : null}

      {!loading && tab === 'followups' ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Lead</th><th>Stage</th><th>Due</th><th>Sequence</th><th>Action</th></tr></thead>
            <tbody>
              {followUps.length ? followUps.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.name}</strong><div className="cell-sub">{row.email || row.phone || '—'}</div></td>
                  <td><span className="tone warn">{row.crm?.status || 'contacted'}</span></td>
                  <td>{fmtDate(row.crm?.nextFollowUpAt)}</td>
                  <td>Follow-up #{Math.min(Number(row.crm?.followUpCount || 0) + 1, 3)} of 3</td>
                  <td><button type="button" className="btn-primary tiny" onClick={() => previewFollowUp(row)}>Generate</button></td>
                </tr>
              )) : <tr><td colSpan={5} className="empty-row">No follow-ups are due right now.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && tab === 'replies' ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Channel</th><th>From</th><th>Intent</th><th>Reply</th><th>Next action</th></tr></thead>
            <tbody>{replies.length ? replies.map((row) => (
              <tr key={row.id}>
                <td>{fmtDate(row.at)}</td><td>{row.channel}</td><td>{row.from || '—'}</td>
                <td><strong>{String(row.classification || 'unknown').replaceAll('_',' ')}</strong>{row.objection ? <div className="cell-sub">Objection: {row.objection}</div> : null}</td>
                <td><div className="reply-text">{row.text}</div>{row.suggestedReply ? <div className="reply-suggestion"><strong>Suggested:</strong> {row.suggestedReply}</div> : null}</td>
                <td>{row.nextAction || 'Review manually'}</td>
              </tr>
            )) : <tr><td colSpan={6} className="empty-row">No inbound replies recorded yet.</td></tr>}</tbody>
          </table>
        </div>
      ) : null}

      {!loading && tab === 'submissions' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Business</th>
                <th>Channels</th>
                <th>Status</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length ? (
                submissions.map((row) => (
                  <tr key={row.id}>
                    <td>{fmtDate(row.at)}</td>
                    <td>
                      <strong>{row.businessName}</strong>
                      <div className="cell-sub">{row.email || row.phone || '—'}</div>
                    </td>
                    <td>{(row.channels || []).join(', ') || '—'}</td>
                    <td>
                      <span className={`tone ${statusTone(row.status)}`}>{row.status}</span>
                    </td>
                    <td>{row.by || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No submissions yet. Send outreach from Find leads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && tab === 'leads' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Times contacted</th>
                <th>Last contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.length ? (
                leads.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <div className="cell-sub">{row.address || '—'}</div>
                    </td>
                    <td>
                      {row.email || '—'}
                      <div className="cell-sub">{row.phone || ''}</div>
                    </td>
                    <td>{row.contactCount || 1}</td>
                    <td>{fmtDate(row.lastContactAt)}</td>
                    <td>
                      <span className={`tone ${statusTone(row.status)}`}>{row.status}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No contacted leads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && tab === 'searches' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Place</th>
                <th>Results</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {searches.length ? (
                searches.map((row) => (
                  <tr key={row.id}>
                    <td>{fmtDate(row.at)}</td>
                    <td>
                      <strong>
                        {row.city}, {row.state}
                      </strong>
                      <div className="cell-sub">{row.placeLabel}</div>
                    </td>
                    <td>{row.count}</td>
                    <td>{row.by || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No searches logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      {followUpPreview ? (
        <aside className="drawer">
          <div className="drawer-head">
            <div><h3>{followUpPreview.lead.name}</h3><div className="cell-sub">Follow-up #{followUpPreview.message.step} of 3{followUpPreview.message.final ? ' · final' : ''}</div></div>
            <button type="button" className="btn-ghost tiny" onClick={() => setFollowUpPreview(null)}>Close</button>
          </div>
          <h4>Email subject</h4><p className="subj">{followUpPreview.message.subject}</p>
          <h4>Email</h4><pre>{followUpPreview.message.email}</pre>
          <h4>WhatsApp</h4><pre>{followUpPreview.message.whatsapp}</pre>
          <button type="button" className="btn-primary followup-send" onClick={sendFollowUp}>Send follow-up</button>
        </aside>
      ) : null}
    </div>
  )
}

function DashboardView() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/analytics/funnel', { credentials: 'include' })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not load analytics'); return data })
      .then(setStats).catch((e) => setError(e.message))
  }, [])
  const cards = stats ? [
    ['Leads', stats.leads],
    ['Contacted', stats.contacted],
    ['Replies', stats.replied],
    ['Pipeline value', 'USD ' + Number(stats.pipelineValue || 0).toLocaleString()],
    ['Won revenue', 'USD ' + Number(stats.wonRevenue || 0).toLocaleString()],
    ['Qualified', stats.qualified],
    ['Proposals', stats.proposals],
    ['Won', stats.won],
    ['Follow-ups due', stats.followUpsDue],
    ['Reply rate', String(stats.replyRate) + '%'],
    ['Win rate', String(stats.winRate) + '%'],
  ] : []
  return <div className="view">
    <header className="view-head"><div><h2>Growth Command Center</h2><p>Live CRM funnel based only on stored outreach and reply activity.</p></div></header>
    {error ? <p className="error">{error}</p> : null}
    <div className="metric-grid">{cards.map(([label,value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    {stats ? <div className="settings-card funnel-card"><h3>Pipeline</h3><div className="funnel-row"><span>Contacted</span><strong>{stats.contacted}</strong></div><div className="funnel-row"><span>Replied</span><strong>{stats.replied}</strong></div><div className="funnel-row"><span>Qualified</span><strong>{stats.qualified}</strong></div><div className="funnel-row"><span>Proposal</span><strong>{stats.proposals}</strong></div><div className="funnel-row"><span>Won</span><strong>{stats.won}</strong></div></div> : <p className="muted">Loading metrics…</p>}
  </div>
}

function SettingsView({ config, onSaved }) {
  const account = config?.emailAccount
  const [form, setForm] = useState({
    provider: account?.provider || 'gmail',
    email: account?.email || '',
    fromName: account?.fromName || 'Confidence Arise',
    password: '',
    host: account?.host || '',
    port: account?.port || 587,
    secure: Boolean(account?.secure),
  })
  const wa = config?.whatsappAccount
  const [waForm, setWaForm] = useState({
    phoneNumberId: wa?.phoneNumberId || '',
    businessAccountId: wa?.businessAccountId || '',
    graphVersion: wa?.graphVersion || 'v21.0',
    accessToken: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [waBusy, setWaBusy] = useState(false)
  const [waMessage, setWaMessage] = useState('')

  function field(name, value) { setForm((x) => ({ ...x, [name]: value })) }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not connect email')
      setForm((x) => ({ ...x, password: '' }))
      setMessage('Email connected and SMTP login verified.')
      onSaved?.()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveWhatsApp(e) {
    e.preventDefault()
    setWaBusy(true); setWaMessage('')
    try {
      const res = await fetch('/api/settings/whatsapp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(waForm) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not connect WhatsApp')
      setWaForm((x) => ({ ...x, accessToken: '' }))
      setWaMessage('WhatsApp Cloud API connected and verified.')
      onSaved?.()
    } catch (err) { setWaMessage(err.message) } finally { setWaBusy(false) }
  }

  const custom = form.provider === 'custom'
  return (
    <div className="view settings-view">
      <header className="view-head"><div><h2>Settings</h2><p>Connect the mailbox used for outreach and follow-ups.</p></div></header>
      <form className="settings-card" onSubmit={save}>
        <h3>Email account</h3>
        <p className="muted">Credentials are stored encrypted on the server and the password is never returned to this browser.</p>
        <label>Provider
          <select value={form.provider} onChange={(e) => field('provider', e.target.value)}>
            <option value="gmail">Gmail / Google Workspace</option>
            <option value="outlook">Outlook / Microsoft 365</option>
            <option value="custom">Custom SMTP</option>
          </select>
        </label>
        <label>Sender name<input value={form.fromName} onChange={(e) => field('fromName', e.target.value)} /></label>
        <label>Email<input type="email" required value={form.email} onChange={(e) => field('email', e.target.value)} placeholder="you@company.com" /></label>
        <label>{form.provider === 'gmail' ? 'Google App Password' : 'SMTP password'}
          <input type="password" value={form.password} onChange={(e) => field('password', e.target.value)} placeholder={account?.configured ? 'Leave blank to keep current password' : 'Required'} />
        </label>
        {custom ? <>
          <label>SMTP host<input required value={form.host} onChange={(e) => field('host', e.target.value)} placeholder="smtp.example.com" /></label>
          <label>SMTP port<input type="number" required value={form.port} onChange={(e) => field('port', Number(e.target.value))} /></label>
          <label className="check"><input type="checkbox" checked={form.secure} onChange={(e) => field('secure', e.target.checked)} />Use TLS/SSL immediately</label>
        </> : null}
        {form.provider === 'gmail' ? <p className="cell-sub">Gmail requires 2-Step Verification and an App Password; do not enter your normal Google password.</p> : null}
        {message ? <p className={message.startsWith('Email connected') ? 'success-line' : 'error'}>{message}</p> : null}
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Testing connection…' : account?.configured ? 'Test & Update' : 'Test & Connect'}</button>
        {account?.configured ? <p className="cell-sub">Currently connected: {account.email} via {account.provider}</p> : null}
      </form>
      <form className="settings-card" onSubmit={saveWhatsApp}>
        <h3>WhatsApp Business</h3>
        <p className="muted">Connect Meta WhatsApp Cloud API. The access token is encrypted and never returned to the browser.</p>
        <label>Phone Number ID<input required value={waForm.phoneNumberId} onChange={(e) => setWaForm((x) => ({ ...x, phoneNumberId: e.target.value }))} /></label>
        <label>WhatsApp Business Account ID<input value={waForm.businessAccountId} onChange={(e) => setWaForm((x) => ({ ...x, businessAccountId: e.target.value }))} /></label>
        <label>Access Token<input type="password" value={waForm.accessToken} onChange={(e) => setWaForm((x) => ({ ...x, accessToken: e.target.value }))} placeholder={wa?.configured ? 'Leave blank to keep current token' : 'Required'} /></label>
        <label>Graph API Version<input value={waForm.graphVersion} onChange={(e) => setWaForm((x) => ({ ...x, graphVersion: e.target.value }))} /></label>
        {waMessage ? <p className={waMessage.startsWith('WhatsApp Cloud') ? 'success-line' : 'error'}>{waMessage}</p> : null}
        <button className="btn-primary" type="submit" disabled={waBusy}>{waBusy ? 'Testing connection…' : wa?.configured ? 'Test & Update WhatsApp' : 'Test & Connect WhatsApp'}</button>
        {wa?.configured ? <><p className="cell-sub">Connected Phone Number ID: {wa.phoneNumberId}</p><p className="cell-sub">Webhook: /api/webhooks/whatsapp · Verify token: {wa.verifyToken}</p></> : null}
      </form>
    </div>
  )
}

function FindView({ config, onSent }) {
  const [state, setState] = useState('TX')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [category, setCategory] = useState('all')
  const [contact, setContact] = useState('reachable')
  const [hasWebsite, setHasWebsite] = useState('all')
  const [outreachOnly, setOutreachOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [placeLabel, setPlaceLabel] = useState('')
  const [businesses, setBusinesses] = useState([])
  const [quality, setQuality] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [sendChannels, setSendChannels] = useState({ email: true, whatsapp: true })
  const [dryRun, setDryRun] = useState(true)
  const [lastSend, setLastSend] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [minScore, setMinScore] = useState(0)
  const [q, setQ] = useState('')
  const [crm, setCrm] = useState(null)

  const stateCities = useMemo(() => citiesForState(state), [state])

  useEffect(() => {
    if (!stateCities.includes(city)) setCity(stateCities[0] || '')
  }, [state, stateCities, city])

  const leads = useMemo(() => {
    let list = applyLeadFilters(businesses, { category, contact, hasWebsite, outreachOnly })
    if (minScore > 0) list = list.filter((b) => (b.opportunityScore || 0) >= minScore)
    const needle = q.trim().toLowerCase()
    if (needle) {
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(needle) ||
          (b.address || '').toLowerCase().includes(needle) ||
          (b.email || '').toLowerCase().includes(needle),
      )
    }
    return list
  }, [businesses, category, contact, hasWebsite, outreachOnly, minScore, q])

  const selectedBusinesses = useMemo(
    () => leads.filter((b) => selected.has(b.id)),
    [leads, selected],
  )

  async function onSearch(e) {
    e.preventDefault()
    setError('')
    setSelected(new Set())
    setLastSend(null)
    setPreview(null)
    if (!state) return setError('Select a state.')
    if (!city && !postalCode.trim()) return setError('Select a city or ZIP.')
    setLoading(true)
    try {
      const params = new URLSearchParams({ state, city, postalCode: postalCode.trim() })
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 40000)
      const res = await fetch(`/api/businesses?${params}`, {
        signal: controller.signal,
        credentials: 'include',
      })
      clearTimeout(timer)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setPlaceLabel(data.place?.label || `${city}, ${state}`)
      setBusinesses(data.businesses || [])
      setQuality(data.quality || null)
    } catch (err) {
      setBusinesses([])
      setError(err?.name === 'AbortError' ? 'Timed out — try again.' : err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function analyzeOne(business) {
    setAnalyzing(true)
    setError('')
    try {
      const res = await fetch('/api/intelligence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ business }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setAnalysis({ business, ...data })
    } catch (err) {
      setError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveCRM(business, patch) {
    const res = await fetch(`/api/crm/lead/${encodeURIComponent(business.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'CRM update failed')
    setCrm(data.crm)
  }

  async function openCRM(business) {
    setError('')
    try {
      const res = await fetch(`/api/crm/lead/${encodeURIComponent(business.id)}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load lead')
      setCrm({ business, ...(data.crm || { id: business.id, status: 'new', notes: '', nextFollowUpAt: null, outcome: null }) })
    } catch (err) {
      setError(err.message)
    }
  }

  async function previewOne(business) {
    const res = await fetch('/api/outreach/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ business }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'Preview failed')
    setPreview({ business, ...data })
  }

  async function sendSelected() {
    if (!selectedBusinesses.length) return setError('Select at least one lead.')
    const channels = []
    if (sendChannels.email) channels.push('email')
    if (sendChannels.whatsapp) channels.push('whatsapp')
    if (!channels.length) return setError('Pick Email and/or WhatsApp.')

    setSending(true)
    setError('')
    setLastSend(null)
    try {
      const res = await fetch('/api/outreach/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          businesses: selectedBusinesses,
          channels,
          dryRun,
          limit: 40,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setLastSend(data)
      onSent?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="view find-view">
      <header className="view-head">
        <div>
          <h2>Find leads</h2>
          <p>
            Outreach-ready US businesses only (phone or email). Junk map POIs, embassies, and
            artwork are excluded — unlike the old Italy dump.
          </p>
        </div>
        <div className="api-pills">
          <span className={config?.emailReady ? 'pill ok' : 'pill warn'}>
            Email {config?.emailReady ? 'ready' : 'dry-run'}
          </span>
          <span className={config?.whatsappReady ? 'pill ok' : 'pill warn'}>
            WhatsApp {config?.whatsappReady ? 'ready' : 'dry-run'}
          </span>
        </div>
      </header>

      <form className="toolbar" onSubmit={onSearch}>
        <label>
          State
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value)
              setBusinesses([])
              setPlaceLabel('')
            }}
          >
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          City
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {stateCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          ZIP
          <input
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="filters-bar">
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_FILTERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contact
          <select value={contact} onChange={(e) => setContact(e.target.value)}>
            <option value="reachable">Email or phone</option>
            <option value="email">Has email</option>
            <option value="phone">Has phone</option>
            <option value="both">Both</option>
            <option value="all">Any</option>
          </select>
        </label>
        <label>
          Website
          <select value={hasWebsite} onChange={(e) => setHasWebsite(e.target.value)}>
            <option value="all">Any website</option>
            <option value="without">No website (best)</option>
            <option value="with">Has website</option>
          </select>
        </label>
        <label className="check filter-check">
          <input
            type="checkbox"
            checked={outreachOnly}
            onChange={(e) => setOutreachOnly(e.target.checked)}
          />
          Hot leads only (contact + no site)
        </label>
        <label>
          Opportunity
          <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
            <option value={0}>Any score</option>
            <option value={60}>60+</option>
            <option value={70}>70+</option>
            <option value={80}>80+</option>
            <option value={90}>90+</option>
          </select>
        </label>
        <label className="grow">
          Filter list
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, address, email…"
          />
        </label>
      </div>

      <div className="outreach-bar">
        <label className="check">
          <input
            type="checkbox"
            checked={sendChannels.email}
            onChange={(e) => setSendChannels((s) => ({ ...s, email: e.target.checked }))}
          />
          Email
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={sendChannels.whatsapp}
            onChange={(e) => setSendChannels((s) => ({ ...s, whatsapp: e.target.checked }))}
          />
          WhatsApp
        </label>
        <label className="check">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry run
        </label>
        <div className="spacer" />
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setSelected(new Set(leads.map((b) => b.id)))}
          disabled={!leads.length}
        >
          Select all ({leads.length})
        </button>
        <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())}>
          Clear
        </button>
        <button
          type="button"
          className="btn-accent"
          onClick={sendSelected}
          disabled={sending || !selected.size}
        >
          {sending ? 'Sending…' : dryRun ? `Preview send (${selected.size})` : `Send (${selected.size})`}
        </button>
      </div>

      {placeLabel ? (
        <p className="meta-line">
          <strong>{placeLabel}</strong>
          <span>
            {businesses.length} with contact
            {quality?.outreachReady != null ? ` · ${quality.outreachReady} legacy hot leads` : ''}
            {businesses.length ? ` · ${businesses.filter((b) => (b.opportunityScore || 0) >= 70).length} high opportunity` : ''}
            {' · '}
            {leads.length} shown · {selected.size} selected
          </span>
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {lastSend ? (
        <p className="success-line">
          Logged {lastSend.count} submission{lastSend.count === 1 ? '' : 's'}
          {dryRun ? ' (dry run)' : ''}. See History → Submissions.
        </p>
      ) : null}

      <div className="table-wrap leads-table">
        <table>
          <thead>
              <tr>
                <th className="check-col" />
                <th>Business</th>
                <th>Opportunity</th>
                <th>Recommended</th>
                <th>Category</th>
                <th>Email</th>
                <th>Phone</th>
                <th />
              </tr>
          </thead>
          <tbody>
            {leads.length ? (
              leads.map((b) => (
                <tr key={b.id} className={selected.has(b.id) ? 'row-on' : ''} onContextMenu={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('ask-concierge', { detail: { context: b, prompt: 'Analyze ' + b.name + ' and tell me the best sales angle, risks, and next action.' } })) }} title="Right-click to Ask AI">
                  <td className="check-col">
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggle(b.id)}
                    />
                  </td>
                  <td>
                    <strong>{b.name}</strong>
                    <div className="cell-sub">{b.address}</div>
                    {b.website ? (
                      <a href={b.website} target="_blank" rel="noreferrer" className="cell-link">
                        Website
                      </a>
                    ) : null}
                  </td>
                  <td>
                    <strong className="score-value">{b.opportunityScore ?? '—'}/100</strong>
                    <div className="cell-sub">{b.confidenceScore ?? '—'}% confidence</div>
                  </td>
                  <td>
                    {b.recommendedServices?.[0]?.name || 'Analyze for recommendation'}
                  </td>
                  <td>{b.category}</td>
                  <td>{b.email || '—'}</td>
                  <td>{b.phone || '—'}</td>
                  <td>
                    <button type="button" className="btn-ghost tiny" onClick={() => analyzeOne(b)} disabled={analyzing}>Analyze</button>
                    <button type="button" className="btn-ghost tiny" onClick={() => openCRM(b)}>CRM</button>
                    <button type="button" className="btn-ghost tiny" onClick={() => previewOne(b)}>
                      Preview
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="empty-row">
                  {loading
                    ? 'Searching outreach-ready leads…'
                    : 'Pick a state and city, then search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {analysis ? (
        <aside className="drawer intelligence-drawer">
          <div className="drawer-head">
            <div><h3>{analysis.business.name}</h3><div className="cell-sub">Business Growth Intelligence</div></div>
            <button type="button" className="btn-ghost tiny" onClick={() => setAnalysis(null)}>Close</button>
          </div>
          <div className="score-hero"><strong>{analysis.intelligence.opportunityScore}/100</strong><span>Growth Opportunity</span></div>
          <h4>Why this lead</h4>
          <ul className="reason-list">{analysis.intelligence.reasoning.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <h4>Recommended services</h4>
          <div className="service-list">{analysis.intelligence.recommendedServices.length ? analysis.intelligence.recommendedServices.map((s) => <div className="service-item" key={s.id}><strong>{s.name}</strong><span>{s.reason}</span></div>) : <p className="muted">No service recommendation can be supported by the available evidence yet.</p>}</div>
          <h4>Score breakdown</h4>
          <div className="breakdown">{analysis.intelligence.breakdown.map((x) => <div className="breakdown-row" key={x.label}><span>{x.label}</span><strong>{x.points}/{x.max}</strong></div>)}</div>
          {analysis.audit?.reachable ? <p className="muted">Website audited successfully. Only observable page signals were used.</p> : analysis.business.website ? <p className="muted">Website audit unavailable: {analysis.audit?.error || 'unreachable'}.</p> : null}
        </aside>
      ) : null}

      {crm ? (
        <aside className="drawer crm-drawer">
          <div className="drawer-head">
            <div><h3>{crm.business?.name || 'Lead CRM'}</h3><div className="cell-sub">Pipeline memory</div></div>
            <button type="button" className="btn-ghost tiny" onClick={() => setCrm(null)}>Close</button>
          </div>
          <label>Status
            <select value={crm.status || 'new'} onChange={(e) => saveCRM(crm.business, { status: e.target.value })}>
              {['new','contacted','replied','qualified','proposal','won','lost','paused'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Next follow-up
            <input type="datetime-local" value={crm.nextFollowUpAt ? String(crm.nextFollowUpAt).slice(0,16) : ''} onChange={(e) => saveCRM(crm.business, { nextFollowUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </label>
          <label>Deal value ($)
            <input type="number" min="0" value={crm.dealValue || ''} placeholder="e.g. 1500" onChange={(e) => setCrm((x) => ({ ...x, dealValue: e.target.value }))} onBlur={() => saveCRM(crm.business, { dealValue: Number(crm.dealValue || 0) })} />
          </label>
          <label>Outcome
            <input value={crm.outcome || ''} placeholder="e.g. interested, no response" onChange={(e) => setCrm((x) => ({ ...x, outcome: e.target.value }))} onBlur={() => saveCRM(crm.business, { outcome: crm.outcome || null })} />
          </label>
          <label>Notes
            <textarea rows="5" value={crm.notes || ''} placeholder="Conversation notes, objections, requirements…" onChange={(e) => setCrm((x) => ({ ...x, notes: e.target.value }))} onBlur={() => saveCRM(crm.business, { notes: crm.notes || '' })} />
          </label>
        </aside>
      ) : null}

      {preview ? (
        <aside className="drawer">
          <div className="drawer-head">
            <h3>{preview.business.name}</h3>
            <button type="button" className="btn-ghost tiny" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
          <h4>Email → {preview.email.to || 'none'}</h4>
          <p className="subj">{preview.email.subject}</p>
          <pre>{preview.email.body}</pre>
          <h4>WhatsApp → {preview.whatsapp.to || 'none'}</h4>
          <pre>{preview.whatsapp.body}</pre>
        </aside>
      ) : null}
    </div>
  )
}

function Concierge() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [chat, setChat] = useState([{ role: 'assistant', text: 'I track your leads, replies, follow-ups and pipeline. I can also run lead searches for you.' }])
  const [tasks, setTasks] = useState([])
  const [aiStatus, setAiStatus] = useState(null)
  const [actionLeads, setActionLeads] = useState([])
  const [selectedContext, setSelectedContext] = useState(null)

  useEffect(() => {
    fetch('/api/concierge/snapshot', { credentials: 'include' }).then((r) => r.json()).then((d) => setTasks(d.tasks || [])).catch(() => {})
    fetch('/api/concierge/ai-status', { credentials: 'include' }).then((r) => r.json()).then(setAiStatus).catch(() => setAiStatus({ ok: false }))
  }, [])

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {}
      setOpen(true)
      setSelectedContext(detail.context || null)
      setMessage(detail.prompt || ('Tell me what I should do with ' + (detail.context?.name || detail.context?.title || 'this item')))
    }
    window.addEventListener('ask-concierge', handler)
    return () => window.removeEventListener('ask-concierge', handler)
  }, [])

  async function ask(text) {
    const q = String(text || message).trim()
    if (!q || busy) return
    setMessage(''); setProgress(8); setActionLeads([])
    setChat((x) => [...x, { role: 'user', text: q }]); setBusy(true)
    const timer = setInterval(() => setProgress((p) => Math.min(p + Math.max(1, Math.round((92-p)/8)), 92)), 450)
    try {
      const endpoint = selectedContext ? '/api/concierge/context' : '/api/concierge/chat'
      const payload = selectedContext ? { question: q, context: selectedContext } : { message: q }
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Concierge unavailable')
      setTasks(data.tasks || [])
      if (data.action?.leads) setActionLeads(data.action.leads)
      if (selectedContext) setSelectedContext(null)
      if (data.aiPowered != null) setAiStatus((s) => ({ ...(s || {}), ok: Boolean(data.aiPowered), error: data.aiError || null }))
      setChat((x) => [...x, { role: 'assistant', text: data.answer }]); setProgress(100)
    } catch (err) { setChat((x) => [...x, { role: 'assistant', text: err.message }]) }
    finally { clearInterval(timer); setTimeout(() => setProgress(0), 700); setBusy(false) }
  }

  return <>
    <button type="button" className="concierge-fab" onClick={() => setOpen((x) => !x)} aria-label="Open AI concierge"><span className="robot-icon" aria-hidden="true">🤖</span></button>
    {open ? <aside className="concierge-panel">
      <div className="concierge-head"><div className="concierge-title"><span className="robot-avatar" aria-hidden="true">🤖</span><div><strong>AI Concierge</strong><span>Growth copilot · <i className={aiStatus?.ok ? 'ai-live' : 'ai-fallback'}>{aiStatus?.ok ? 'AI live' : 'fallback'}</i></span></div></div><button className="btn-ghost tiny" onClick={() => setOpen(false)}>Close</button></div>
      {busy || progress ? <div className="agent-progress"><div style={{width: progress + '%'}} /><span>{progress}% · {progress < 35 ? 'Understanding request' : progress < 75 ? 'Working through data' : 'Preparing results'}</span></div> : null}
      <div className="concierge-quick">{['What should I do today?', 'Show hot leads', 'Follow-ups due?', 'Pipeline status', 'Sync email replies'].map((q) => <button type="button" key={q} onClick={() => ask(q)}>{q}</button>)}</div>
      {tasks.length ? <div className="concierge-tasks"><strong>Priority queue</strong>{tasks.slice(0,3).map((t,i) => <div className="concierge-task" key={t.leadId || i}><span>{t.priority}</span><div><b>{t.title}</b><small>{t.detail}</small></div></div>)}</div> : null}
      <div className="concierge-chat">{chat.map((m,i) => <div key={i} className={'concierge-msg ' + m.role}>{m.text}</div>)}{busy ? <div className="concierge-msg assistant">Working…</div> : null}</div>
      {actionLeads.length ? <div className="agent-results"><strong>Agent results</strong>{actionLeads.slice(0,10).map((b) => <div className="agent-lead" key={b.id}><div><b>{b.name}</b><small>{b.address || b.category}</small></div><span>{b.opportunityScore || 0}/100</span><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('ask-concierge',{detail:{context:b,prompt:'How should I pitch ' + b.name + '?'}}))}>Ask AI</button></div>)}</div> : null}
      <form className="concierge-input" onSubmit={(e) => { e.preventDefault(); ask() }}><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Try: Find 20 dentists leads in Austin, TX" /><button className="btn-primary tiny" disabled={busy}>Ask</button></form>
    </aside> : null}
  </>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [nav, setNav] = useState('dashboard')
  const [config, setConfig] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) setUser({ email: data.email, name: data.name })
      })
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!user) return
    fetch('/api/config', { credentials: 'include' })
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {})
  }, [user, historyKey])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setConfig(null)
  }

  if (!authChecked) {
    return (
      <div className="boot">
        <p>Loading workspace…</p>
      </div>
    )
  }

  if (!user) return <LoginScreen onLoggedIn={setUser} />

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="side-brand">
          <p className="brand-mark">Confidence Arise</p>
          <h1>Growth Agent</h1>
          <p className="side-user">{user.name || 'Naeema'}</p>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={nav === item.id ? 'nav-item on' : 'nav-item'}
              onClick={() => setNav(item.id)}
            >
              {item.label}
              {item.id === 'history' && config?.history ? (
                <span className="nav-count">{config.history.submissions || 0}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <a href={config?.siteUrl || 'https://confidencearise.com'} target="_blank" rel="noreferrer">
            confidencearise.com
          </a>
          <button type="button" className="btn-ghost tiny" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        {nav === 'dashboard' ? (
          <DashboardView />
        ) : nav === 'find' ? (
          <FindView
            config={config}
            onSent={() => setHistoryKey((k) => k + 1)}
          />
        ) : nav === 'settings' ? (
          <SettingsView config={config} onSaved={() => setHistoryKey((k) => k + 1)} />
        ) : (
          <HistoryView key={historyKey} />
        )}
      </main>
      <Concierge />
    </div>
  )
}
