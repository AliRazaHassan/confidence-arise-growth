import { useEffect, useMemo, useState } from 'react'
import { US_STATES, citiesForState, CATEGORY_FILTERS } from './usa.js'
import { applyLeadFilters } from './search.js'

function contactLine(b) {
  const bits = []
  if (b.email) bits.push(b.email)
  if (b.phone) bits.push(b.phone)
  return bits.join(' · ') || 'No contact'
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
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <p className="eyebrow">Confidence Arise</p>
        <h1>Growth Agent</h1>
        <p className="lede">Private access — Naeema only.</p>
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
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

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
  const [config, setConfig] = useState(null)
  const [sendChannels, setSendChannels] = useState({ email: true, whatsapp: true })
  const [dryRun, setDryRun] = useState(true)
  const [lastSend, setLastSend] = useState(null)
  const [preview, setPreview] = useState(null)

  const stateCities = useMemo(() => citiesForState(state), [state])

  useEffect(() => {
    if (!stateCities.includes(city)) {
      setCity(stateCities[0] || '')
    }
  }, [state, stateCities, city])

  const leads = useMemo(
    () => applyLeadFilters(businesses, { category, contact, hasWebsite }),
    [businesses, category, contact, hasWebsite],
  )

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
  }, [user])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setBusinesses([])
    setConfig(null)
  }

  async function onSearch(e) {
    e.preventDefault()
    setError('')
    setSelected(new Set())
    setLastSend(null)
    setPreview(null)
    if (!state) {
      setError('Select a US state first.')
      return
    }
    if (!city && !postalCode.trim()) {
      setError('Select a city in that state (or enter a ZIP).')
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        state,
        city,
        postalCode: postalCode.trim(),
      })
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 40000)
      const res = await fetch(`/api/businesses?${params}`, {
        signal: controller.signal,
        credentials: 'include',
      })
      clearTimeout(timer)
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setUser(null)
        throw new Error('Session expired — sign in again.')
      }
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

  function selectVisible() {
    setSelected(new Set(leads.map((b) => b.id)))
  }

  function clearSelected() {
    setSelected(new Set())
  }

  const selectedBusinesses = useMemo(
    () => leads.filter((b) => selected.has(b.id)),
    [leads, selected],
  )

  async function previewOne(business) {
    setPreview(null)
    const res = await fetch('/api/outreach/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ business }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Preview failed')
      return
    }
    setPreview({ business, ...data })
  }

  async function sendSelected() {
    if (!selectedBusinesses.length) {
      setError('Select at least one business.')
      return
    }
    const channels = []
    if (sendChannels.email) channels.push('email')
    if (sendChannels.whatsapp) channels.push('whatsapp')
    if (!channels.length) {
      setError('Pick Email and/or WhatsApp.')
      return
    }

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
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="login-wrap">
        <p className="lede">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLoggedIn={setUser} />
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <p className="eyebrow">Confidence Arise</p>
          <h1>Growth Agent</h1>
          <p className="lede">
            USA leads — pick state, then city, filter businesses, reach out with Email + WhatsApp
            (site link included).
          </p>
        </div>
        <div className="status">
          <span className="pill ok">Signed in · {user.name || user.email}</span>
          <span className={config?.emailReady ? 'pill ok' : 'pill warn'}>
            Email {config?.emailReady ? 'API ready' : 'dry-run'}
          </span>
          <span className={config?.whatsappReady ? 'pill ok' : 'pill warn'}>
            WhatsApp {config?.whatsappReady ? 'API ready' : 'dry-run'}
          </span>
          <button type="button" className="ghost small" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <section className="panel find">
        <h2>1 · State → city → businesses</h2>
        <form className="finder" onSubmit={onSearch}>
          <label>
            State
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value)
                setBusinesses([])
                setPlaceLabel('')
              }}
              required
            >
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            City
            <select value={city} onChange={(e) => setCity(e.target.value)} required={!postalCode}>
              {stateCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            ZIP (optional)
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="78701"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Find businesses'}
          </button>
        </form>
        {placeLabel ? (
          <p className="meta">
            Showing: <strong>{placeLabel}</strong> · {businesses.length} raw · {leads.length} after
            filters
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel filters">
        <h2>2 · Filter leads</h2>
        <div className="filter-row">
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
              <option value="both">Email + phone</option>
              <option value="all">Any</option>
            </select>
          </label>
          <label>
            Website
            <select value={hasWebsite} onChange={(e) => setHasWebsite(e.target.value)}>
              <option value="all">Any</option>
              <option value="with">Has website</option>
              <option value="without">No website</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel outreach">
        <h2>3 · Reach out</h2>
        <div className="outreach-controls">
          <label className="check">
            <input
              type="checkbox"
              checked={sendChannels.email}
              onChange={(e) => setSendChannels((s) => ({ ...s, email: e.target.checked }))}
            />
            Email (Resend API)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={sendChannels.whatsapp}
              onChange={(e) => setSendChannels((s) => ({ ...s, whatsapp: e.target.checked }))}
            />
            WhatsApp (Meta Cloud API)
          </label>
          <label className="check">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry run (preview only)
          </label>
          <div className="actions">
            <button type="button" className="ghost" onClick={selectVisible} disabled={!leads.length}>
              Select filtered ({leads.length})
            </button>
            <button type="button" className="ghost" onClick={clearSelected}>
              Clear
            </button>
            <button
              type="button"
              className="primary"
              onClick={sendSelected}
              disabled={sending || !selected.size}
            >
              {sending
                ? 'Sending…'
                : dryRun
                  ? `Dry-run ${selected.size}`
                  : `Send to ${selected.size}`}
            </button>
          </div>
        </div>
        {lastSend ? (
          <div className="send-result">
            <p>
              Batch: <strong>{lastSend.count}</strong>
              {dryRun ? ' (dry run)' : ''}
            </p>
            <ul>
              {lastSend.items?.slice(0, 8).map((item) => (
                <li key={item.id}>
                  {item.business}: email {item.results.email?.ok ? '✓' : '—'} / WhatsApp{' '}
                  {item.results.whatsapp?.ok ? '✓' : '—'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="panel list" id="listings">
        <h2>Leads</h2>
        {!leads.length ? (
          <p className="empty">Pick state + city, then search.</p>
        ) : (
          <ul className="leads">
            {leads.map((b) => (
              <li key={b.id} className={selected.has(b.id) ? 'selected' : ''}>
                <label className="lead-check">
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={() => toggle(b.id)}
                  />
                  <div>
                    <strong>{b.name}</strong>
                    <span className="cat">{b.category}</span>
                    <span className="addr">{b.address}</span>
                    <span className="contacts">{contactLine(b)}</span>
                    {b.website ? (
                      <a href={b.website} target="_blank" rel="noreferrer">
                        {b.website.replace(/^https?:\/\//, '').slice(0, 40)}
                      </a>
                    ) : null}
                  </div>
                </label>
                <button type="button" className="ghost small" onClick={() => previewOne(b)}>
                  Preview msg
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {preview ? (
        <aside className="preview">
          <button type="button" className="close" onClick={() => setPreview(null)}>
            Close
          </button>
          <h3>Preview · {preview.business.name}</h3>
          <h4>Email → {preview.email.to || 'no email'}</h4>
          <p className="subj">{preview.email.subject}</p>
          <pre>{preview.email.body}</pre>
          <h4>WhatsApp → {preview.whatsapp.to || 'no phone'}</h4>
          <pre>{preview.whatsapp.body}</pre>
        </aside>
      ) : null}

      <footer>
        <p>
          Site link:{' '}
          <a href={config?.siteUrl || 'https://confidencearise.com'} target="_blank" rel="noreferrer">
            {config?.siteUrl || 'https://confidencearise.com'}
          </a>
        </p>
      </footer>
    </div>
  )
}
