import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const FILE = path.join(DATA_DIR, 'email-settings.json')

const PROVIDERS = {
  gmail: { host: 'smtp.gmail.com', port: 465, secure: true },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
  custom: null,
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function key() {
  const secret = process.env.EMAIL_SETTINGS_SECRET || process.env.SESSION_SECRET
  if (!secret) throw new Error('Set EMAIL_SETTINGS_SECRET or SESSION_SECRET before saving email credentials.')
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((x) => x.toString('base64')).join('.')
}

function decrypt(value) {
  const [iv, tag, encrypted] = String(value).split('.').map((x) => Buffer.from(x, 'base64'))
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function read() {
  try {
    ensureDir()
    if (!fs.existsSync(FILE)) return null
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return null
  }
}

export function providerDefaults(provider) {
  return PROVIDERS[provider] || null
}

export function getEmailSettings({ includeSecret = false } = {}) {
  const row = read()
  if (!row) return null
  const result = {
    provider: row.provider,
    email: row.email,
    fromName: row.fromName,
    host: row.host,
    port: row.port,
    secure: row.secure,
    configured: Boolean(row.passwordEncrypted),
    updatedAt: row.updatedAt,
  }
  if (includeSecret && row.passwordEncrypted) result.password = decrypt(row.passwordEncrypted)
  return result
}

export function saveEmailSettings(input) {
  ensureDir()
  const provider = String(input.provider || 'gmail').toLowerCase()
  const defaults = providerDefaults(provider)
  const previous = read()
  const email = String(input.email || '').trim()
  if (!email || !email.includes('@')) throw new Error('Valid sender email is required.')
  const passwordEncrypted = input.password
    ? encrypt(input.password)
    : previous?.email === email
      ? previous.passwordEncrypted
      : null
  if (!passwordEncrypted) throw new Error('App password / SMTP password is required.')

  const row = {
    provider,
    email,
    fromName: String(input.fromName || process.env.FROM_NAME || 'Confidence Arise').trim(),
    host: String(defaults?.host || input.host || '').trim(),
    port: Number(defaults?.port || input.port || 587),
    secure: defaults ? defaults.secure : Boolean(input.secure),
    passwordEncrypted,
    updatedAt: new Date().toISOString(),
  }
  if (!row.host) throw new Error('SMTP host is required.')
  fs.writeFileSync(FILE, JSON.stringify(row, null, 2), 'utf8')
  return getEmailSettings()
}
