import crypto from 'crypto'

const COOKIE = 'ca_growth_session'

function authConfig() {
  const email = (process.env.AUTH_EMAIL || 'naeemah@confidencearise.org').trim().toLowerCase()
  const password = process.env.AUTH_PASSWORD || ''
  const secret = process.env.SESSION_SECRET || process.env.AUTH_PASSWORD || 'dev-only-change-me'
  return { email, password, secret }
}

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verify(token, secret) {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!data?.exp || Date.now() > data.exp) return null
    return data
  } catch {
    return null
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (!k) continue
    out[k] = decodeURIComponent(rest.join('=') || '')
  }
  return out
}

export function getSession(req) {
  const { secret } = authConfig()
  const cookies = parseCookies(req)
  return verify(cookies[COOKIE], secret)
}

export function requireAuth(req, res, next) {
  const session = getSession(req)
  if (!session) {
    return res.status(401).json({ error: 'Login required.', code: 'AUTH_REQUIRED' })
  }
  req.user = session
  next()
}

export function attachAuthRoutes(app) {
  app.get('/api/auth/me', (req, res) => {
    const session = getSession(req)
    if (!session) return res.json({ authenticated: false })
    res.json({ authenticated: true, email: session.email, name: session.name })
  })

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {}
    const cfg = authConfig()

    if (!cfg.password) {
      return res.status(503).json({
        error: 'AUTH_PASSWORD is not set on the server. Ask admin to configure login.',
      })
    }

    const emailNorm = String(email || '')
      .trim()
      .toLowerCase()
    const pass = String(password || '')

    if (emailNorm !== cfg.email || pass !== cfg.password) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const token = sign(
      {
        email: cfg.email,
        name: 'Naeema',
        exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
      },
      cfg.secret,
    )

    const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER)
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 24 * 60 * 60}${secure ? '; Secure' : ''}`,
    )
    res.json({ ok: true, email: cfg.email, name: 'Naeema' })
  })

  app.post('/api/auth/logout', (_req, res) => {
    const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER)
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`,
    )
    res.json({ ok: true })
  })
}
