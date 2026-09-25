import { useCallback, useEffect, useMemo, useState } from 'react'
import { US_STATES, citiesForState, CATEGORY_FILTERS } from './usa.js'
import { applyLeadFilters } from './search.js'

const NAV = [
  { id: 'find', label: 'Find leads' },
  { id: 'history', label: 'History' },
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [s, sub, l] = await Promise.all([
        fetch('/api/history/searches?limit=50', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/history/submissions?limit=100', { credentials: 'include' }).then((r) =>
          r.json(),
        ),
        fetch('/api/history/leads?limit=200', { credentials: 'include' }).then((r) => r.json()),
      ])
      setSearches(s.items || [])
      setSubmissions(sub.items || [])
      setLeads(l.items || [])
    } catch (err) {
      setError(err.message || 'Could not load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="view history-view">
      <header className="view-head">
        <div>
          <h2>History</h2>
          <p>Previous searches, outreach submissions, and contacted leads.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
          Refresh
        </button>
      </header>

      <div className="tabs" role="tablist">
        {[
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
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [placeLabel, setPlaceLabel] = useState('')
  const [businesses, setBusinesses] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [sendChannels, setSendChannels] = useState({ email: true, whatsapp: true })
  const [dryRun, setDryRun] = useState(true)
  const [lastSend, setLastSend] = useState(null)
  const [preview, setPreview] = useState(null)
  const [q, setQ] = useState('')

  const stateCities = useMemo(() => citiesForState(state), [state])

  useEffect(() => {
    if (!stateCities.includes(city)) setCity(stateCities[0] || '')
  }, [state, stateCities, city])

  const leads = useMemo(() => {
    let list = applyLeadFilters(businesses, { category, contact, hasWebsite })
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
  }, [businesses, category, contact, hasWebsite, q])

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
          <p>State → city → filter → outreach. Messages include your site link.</p>
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
            <option value="all">Any</option>
            <option value="with">Has site</option>
            <option value="without">No site</option>
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
            {businesses.length} found · {leads.length} shown · {selected.size} selected
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
              <th>Category</th>
              <th>Email</th>
              <th>Phone</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {leads.length ? (
              leads.map((b) => (
                <tr key={b.id} className={selected.has(b.id) ? 'row-on' : ''}>
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
                  <td>{b.category}</td>
                  <td>{b.email || '—'}</td>
                  <td>{b.phone || '—'}</td>
                  <td>
                    <button type="button" className="btn-ghost tiny" onClick={() => previewOne(b)}>
                      Preview
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty-row">
                  {loading ? 'Searching…' : 'Pick a state and city, then search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [nav, setNav] = useState('find')
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
        {nav === 'find' ? (
          <FindView
            config={config}
            onSent={() => {
              setHistoryKey((k) => k + 1)
            }}
          />
        ) : (
          <HistoryView key={historyKey} />
        )}
      </main>
    </div>
  )
}
