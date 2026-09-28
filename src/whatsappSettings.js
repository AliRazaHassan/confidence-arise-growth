import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const FILE = path.join(DATA_DIR, 'whatsapp-settings.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}
function key() {
  const secret = process.env.WHATSAPP_SETTINGS_SECRET || process.env.SESSION_SECRET
  if (!secret) throw new Error('Set WHATSAPP_SETTINGS_SECRET or SESSION_SECRET before saving WhatsApp credentials.')
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
  } catch { return null }
}
export function getWhatsAppSettings({ includeSecret = false } = {}) {
  const row = read()
  if (!row) return null
  const result = {
    phoneNumberId: row.phoneNumberId,
    businessAccountId: row.businessAccountId || '',
    graphVersion: row.graphVersion || 'v21.0',
    verifyToken: row.verifyToken || '',
    configured: Boolean(row.accessTokenEncrypted && row.phoneNumberId),
    updatedAt: row.updatedAt,
  }
  if (includeSecret && row.accessTokenEncrypted) result.accessToken = decrypt(row.accessTokenEncrypted)
  return result
}
export function saveWhatsAppSettings(input) {
  ensureDir()
  const previous = read()
  const phoneNumberId = String(input.phoneNumberId || '').trim()
  const accessTokenEncrypted = input.accessToken
    ? encrypt(input.accessToken)
    : previous?.phoneNumberId === phoneNumberId ? previous.accessTokenEncrypted : null
  if (!phoneNumberId) throw new Error('WhatsApp Phone Number ID is required.')
  if (!accessTokenEncrypted) throw new Error('WhatsApp access token is required.')
  const row = {
    phoneNumberId,
    businessAccountId: String(input.businessAccountId || '').trim(),
    graphVersion: String(input.graphVersion || 'v21.0').trim(),
    verifyToken: String(input.verifyToken || previous?.verifyToken || crypto.randomBytes(18).toString('hex')).trim(),
    accessTokenEncrypted,
    updatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(FILE, JSON.stringify(row, null, 2), 'utf8')
  return getWhatsAppSettings()
}
