/**
 * FKR Media USA — the Worker behind the static site.
 *
 * Every request that matches a file in dist/ is answered by Cloudflare's
 * asset layer before this code runs. What reaches here is the one dynamic
 * route the site has, POST /api/contact, plus anything that matched nothing
 * (answered 404 so a typo never becomes a 200).
 *
 * The enquiry path does two things, in this order, and treats them as
 * independent so a failure in one never loses the enquiry to the other:
 *
 *   1. STORE  — the enquiry is written to the hosting account's MySQL
 *               database (worker/db.js). This is the record of truth; it is
 *               what FKR can query later, and what survives a mail outage.
 *   2. NOTIFY — an email goes to FKR through the hosting account's own SMTP
 *               server (worker/smtp.js), over TLS, authenticated with the
 *               mailbox credentials held as Worker secrets. The visitor's
 *               address is set as Reply-To, never as From, so the mail
 *               cannot be spoofed and a reply still reaches them.
 *
 * The response is 200 as long as at least one of the two succeeded. Only
 * when both fail does the visitor get an error, and then the client offers
 * the mailto route instead of pretending.
 *
 * SECURITY DECISIONS, so nobody undoes one without knowing what it held up:
 *
 *   - Same-origin only. The Origin header must match the request host; a
 *     third-party page cannot post into this endpoint from a browser. No
 *     CORS headers are ever sent.
 *   - Everything is validated again here, with hard length caps. The client
 *     validates for good messages; the server validates because the client
 *     is not to be trusted.
 *   - The honeypot is checked here too. A filled honeypot is answered with a
 *     bland 200 so a bot learns nothing, and stores nothing.
 *   - Rate limit per visitor: too many enquiries from one address inside the
 *     window is a 429. The address is never stored — only a salted SHA-256
 *     of it, enough to count repeats and useless for identifying anyone.
 *   - The email body is HTML-escaped field by field. Enquiry text is data;
 *     it is never allowed to become markup in FKR's inbox.
 *   - No credential is in the code or the repo. MYSQL_USER, MYSQL_PASSWORD,
 *     SMTP_USER, SMTP_PASS and IP_SALT are Worker secrets; server addresses
 *     and mail addresses are plain vars in wrangler.jsonc.
 */

import { sendMail, buildMessage, parseAddress } from './smtp.js'
import { withDb, configured as dbConfigured, toDateTime } from './db.js'

const LIMITS = {
  name: 120,
  company: 160,
  email: 254,
  phone: 40,
  service: 40,
  budget: 40,
  message: 4000,
  body: 16 * 1024          // bytes — nothing legitimate is anywhere near this
}

const SERVICES = new Set([
  'digital-advertising', 'social-media', 'seo', 'web', 'branding', 'content', 'other'
])
const BUDGETS = new Set(['', 'under-25k', '25-50k', '50-100k', '100k-plus', 'unsure'])

const HONEYPOT = 'company_website'

const RATE = { window: 60 * 60, max: 5 }   // per address, per hour

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
      }
      return handleContact(request, env, ctx)
    }

    // Anything else that reached the Worker matched no static asset.
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
}

async function handleContact(request, env, ctx) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403)

  const length = Number(request.headers.get('content-length') || 0)
  if (length > LIMITS.body) return json({ error: 'Request too large' }, 413)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Expected JSON' }, 400)
  }
  if (!body || typeof body !== 'object') return json({ error: 'Expected JSON' }, 400)

  // A bot filled the field people cannot see. Tell it nothing.
  if (str(body[HONEYPOT])) return json({ ok: true })

  const { enquiry, errors } = validate(body)
  if (errors) return json({ error: 'Please correct the highlighted fields.', fields: errors }, 422)

  const ip = request.headers.get('cf-connecting-ip') || ''
  const ipHash = await hash(`${env.IP_SALT || ''}:${ip}`)

  const hasDb = dbConfigured(env)
  if (!hasDb) console.warn('[contact] MYSQL_* not set — enquiries will not be stored')

  if (hasDb) {
    const recent = await withDb(env, (db) => countRecent(db, ipHash)).catch((error) => {
      console.error('[contact] rate-limit lookup failed', error)
      return 0
    })
    if (recent >= RATE.max) {
      return json({ error: 'Too many enquiries from this connection. Please try again later, or email us directly.' }, 429, {
        'Retry-After': String(RATE.window)
      })
    }
  }

  const meta = {
    ipHash,
    country: request.headers.get('cf-ipcountry') || null,
    userAgent: (request.headers.get('user-agent') || '').slice(0, 300),
    referer: (request.headers.get('referer') || '').slice(0, 500),
    receivedAt: new Date().toISOString()
  }

  const stored = hasDb ? await withDb(env, (db) => store(db, enquiry, meta)).catch((error) => {
    console.error('[contact] MySQL insert failed', error)
    return null
  }) : null

  const mailed = await notify(env, enquiry, meta, stored).catch((error) => {
    console.error('[contact] email failed', error)
    return false
  })

  if (!stored && !mailed) {
    return json({ error: 'We could not take your enquiry just now. Please email us directly.' }, 500)
  }

  // Record how the notification went on the row, so a follow-up can find
  // enquiries FKR was never told about. Off the response path.
  if (stored) {
    ctx.waitUntil(
      withDb(env, (db) =>
        db.execute(
          'UPDATE enquiries SET notified_at = ?, notify_error = ? WHERE id = ?',
          [mailed ? toDateTime(new Date().toISOString()) : null, mailed ? null : (mailed === false ? 'send failed' : null), stored]
        )
      ).catch(() => {})
    )
  }

  return json({ ok: true })
}

/* ---------- validation ---------- */

function str(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function validate(body) {
  const e = {
    name: str(body.name),
    company: str(body.company),
    email: str(body.email),
    phone: str(body.phone),
    service: str(body.service),
    budget: str(body.budget),
    message: str(body.message)
  }
  const errors = {}

  for (const [key, max] of Object.entries(LIMITS)) {
    if (key in e && e[key].length > max) errors[key] = `Too long (max ${max} characters).`
  }
  if (e.name.length < 2) errors.name = 'Please enter your name.'
  if (!EMAIL_RE.test(e.email)) errors.email = 'Please enter a valid email address.'
  if (!SERVICES.has(e.service)) errors.service = 'Please choose the service you are interested in.'
  if (!BUDGETS.has(e.budget)) errors.budget = 'Please choose a listed range.'
  if (e.message.length < 10) errors.message = 'Please tell us a little more — at least a sentence.'
  // The visitor's address becomes a Reply-To header. A line break in it
  // would let them append headers of their own, so refuse it outright.
  if (/[\r\n<>]/.test(e.email)) errors.email = 'Please enter a valid email address.'

  return Object.keys(errors).length ? { errors } : { enquiry: e }
}

/* ---------- storage ---------- */

async function countRecent(db, ipHash) {
  const since = toDateTime(new Date(Date.now() - RATE.window * 1000).toISOString())
  const [rows] = await db.execute(
    'SELECT COUNT(*) AS n FROM enquiries WHERE ip_hash = ? AND received_at > ?',
    [ipHash, since]
  )
  return Number(rows[0]?.n || 0)
}

async function store(db, e, meta) {
  const id = crypto.randomUUID()
  await db.execute(
    `INSERT INTO enquiries
       (id, received_at, name, company, email, phone, service, budget, message,
        ip_hash, country, user_agent, referer, notified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      id, toDateTime(meta.receivedAt), e.name, e.company || null, e.email, e.phone || null,
      e.service, e.budget || null, e.message,
      meta.ipHash, meta.country, meta.userAgent || null, meta.referer || null
    ]
  )
  return id
}

/* ---------- email ---------- */

async function notify(env, e, meta, id) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn('[contact] SMTP_HOST / SMTP_USER / SMTP_PASS not set — enquiry stored but no email sent')
    return false
  }
  const to = (env.MAIL_TO || '').split(',').map((s) => parseAddress(s).address).filter(Boolean)
  const sender = parseAddress(env.MAIL_FROM || '')
  if (!to.length || !sender.address) {
    console.warn('[contact] MAIL_TO / MAIL_FROM not set — enquiry stored but no email sent')
    return false
  }

  const subject = `Project enquiry — ${e.name}${e.company ? ` (${e.company})` : ''}`
  const rows = [
    ['Name', e.name],
    ['Company', e.company || '—'],
    ['Email', e.email],
    ['Phone', e.phone || '—'],
    ['Service', e.service],
    ['Budget', e.budget || '—'],
    ['Country', meta.country || '—'],
    ['Received', meta.receivedAt],
    ['Record', id || 'not stored']
  ]

  const text = [
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Message:',
    e.message
  ].join('\n')

  const html = `<!doctype html><html><body style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;padding:24px">
<h2 style="margin:0 0 16px;font-size:18px">New project enquiry</h2>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px">
${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#666;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join('\n')}
</table>
<div style="white-space:pre-wrap;border-left:3px solid #ee473d;padding:8px 14px;background:#faf9f7">${esc(e.message)}</div>
</body></html>`

  const message = buildMessage({
    from: sender.address,
    fromName: sender.name || 'FKR Media USA',
    to,
    replyTo: e.email,
    subject,
    text,
    html
  })

  await sendMail({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 465),
    secure: env.SMTP_SECURE || 'tls',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: sender.address,
    to,
    message
  })

  return true
}

/* ---------- helpers ---------- */

function sameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

async function hash(input) {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  })
}
