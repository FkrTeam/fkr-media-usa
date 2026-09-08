/**
 * A minimal SMTP client for Cloudflare Workers.
 *
 * Workers cannot use Node's `net`, but they can open raw TCP sockets through
 * `cloudflare:sockets`, and that is all SMTP needs. This speaks just enough
 * of RFC 5321 to hand one message to an authenticated relay — the hosting
 * account's own mail server — and nothing more:
 *
 *   EHLO → (STARTTLS → EHLO) → AUTH PLAIN → MAIL FROM → RCPT TO → DATA → QUIT
 *
 * Transport, by `secure`:
 *   'tls'       implicit TLS from the first byte — port 465. Preferred.
 *   'starttls'  plain connect, then upgrade before anything sensitive is
 *               sent — port 587. AUTH is refused if the upgrade fails.
 *   'none'      plaintext throughout. Local testing only; credentials would
 *               cross the network in the clear.
 *
 * Credentials are used for AUTH PLAIN inside the TLS session and never
 * logged. The server's replies are checked line by line, so a refusal at any
 * step (bad login, relay denied, recipient rejected) surfaces as an Error
 * naming the step and the server's own text.
 */

import { connect } from 'cloudflare:sockets'

const CRLF = '\r\n'
const TIMEOUT_MS = 20_000

/**
 * @param {object} options
 * @param {string} options.host
 * @param {number} options.port
 * @param {'tls'|'starttls'|'none'} options.secure
 * @param {string} options.user
 * @param {string} options.pass
 * @param {string} options.from         bare address used in MAIL FROM
 * @param {string[]} options.to         bare addresses used in RCPT TO
 * @param {string} options.message      the full RFC 5322 message, CRLF lines
 */
export async function sendMail({ host, port, secure = 'tls', user, pass, from, to, message }) {
  if (!host || !port) throw new Error('SMTP host and port are required')
  if (secure === 'starttls' && !user) throw new Error('SMTP user is required')

  const socket = connect({ hostname: host, port: Number(port) }, {
    secureTransport: secure === 'tls' ? 'on' : secure === 'starttls' ? 'starttls' : 'off',
    allowHalfOpen: false
  })

  let session = await Session.open(socket)
  try {
    await session.expect(220, 'greeting')

    let ehlo = await session.command(`EHLO fkrmediausa.com`, 250, 'EHLO')

    if (secure === 'starttls') {
      if (!/STARTTLS/i.test(ehlo)) throw new Error('SMTP server does not offer STARTTLS')
      await session.command('STARTTLS', 220, 'STARTTLS')
      session = await Session.open(socket.startTls())
      ehlo = await session.command(`EHLO fkrmediausa.com`, 250, 'EHLO')
    }

    if (user) {
      if (!/AUTH[ =].*PLAIN/i.test(ehlo) && !/AUTH[ =].*LOGIN/i.test(ehlo)) {
        throw new Error('SMTP server offers neither AUTH PLAIN nor AUTH LOGIN')
      }
      if (/AUTH[ =].*PLAIN/i.test(ehlo)) {
        const token = b64(`\0${user}\0${pass}`)
        await session.command(`AUTH PLAIN ${token}`, 235, 'AUTH')
      } else {
        await session.command('AUTH LOGIN', 334, 'AUTH LOGIN')
        await session.command(b64(user), 334, 'AUTH LOGIN user')
        await session.command(b64(pass), 235, 'AUTH LOGIN password')
      }
    }

    await session.command(`MAIL FROM:<${from}>`, 250, 'MAIL FROM')
    for (const rcpt of to) await session.command(`RCPT TO:<${rcpt}>`, [250, 251], `RCPT TO ${rcpt}`)

    await session.command('DATA', 354, 'DATA')
    // Dot-stuffing: a line that is only "." would end the message early.
    const body = message.replace(/\r?\n/g, CRLF).replace(/^\./gm, '..')
    await session.command(`${body}${CRLF}.`, 250, 'message body')

    await session.command('QUIT', 221, 'QUIT').catch(() => {})
  } finally {
    await session.close()
  }
}

class Session {
  static async open(socket) {
    const s = new Session()
    s.socket = socket
    s.writer = socket.writable.getWriter()
    s.reader = socket.readable.getReader()
    s.buffer = ''
    s.decoder = new TextDecoder()
    s.encoder = new TextEncoder()
    return s
  }

  /** Sends one command and waits for a complete reply with the given code. */
  async command(line, expected, step) {
    await this.writer.write(this.encoder.encode(line + CRLF))
    return this.expect(expected, step)
  }

  /**
   * Reads one full SMTP reply (all "250-..." continuation lines through the
   * final "250 ...") and checks its code.
   */
  async expect(expected, step) {
    const codes = Array.isArray(expected) ? expected : [expected]
    const reply = await this.readReply()
    const code = Number(reply.slice(0, 3))
    if (!codes.includes(code)) {
      // The server's text is useful ("535 authentication failed"), the
      // command that got it is not — it may hold the password.
      throw new Error(`SMTP ${step} failed: ${reply.split(CRLF)[0].slice(0, 200)}`)
    }
    return reply
  }

  async readReply() {
    const deadline = Date.now() + TIMEOUT_MS
    for (;;) {
      const lines = this.buffer.split(CRLF)
      // A reply is complete once a line reads "NNN " (space, not dash).
      const end = lines.findIndex((l) => /^\d{3}(\s|$)/.test(l))
      if (end !== -1 && this.buffer.includes(CRLF, this.buffer.indexOf(lines[end]))) {
        const consumed = lines.slice(0, end + 1)
        this.buffer = lines.slice(end + 1).join(CRLF)
        return consumed.join(CRLF)
      }
      if (Date.now() > deadline) throw new Error('SMTP timeout waiting for the server')
      const { value, done } = await Promise.race([
        this.reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({ done: true, timeout: true }), Math.max(1, deadline - Date.now())))
      ])
      if (done) {
        if (this.buffer) { const b = this.buffer; this.buffer = ''; return b }
        throw new Error('SMTP connection closed by the server')
      }
      this.buffer += this.decoder.decode(value, { stream: true })
    }
  }

  async close() {
    try { this.reader.releaseLock() } catch {}
    try { this.writer.releaseLock() } catch {}
    try { await this.socket.close() } catch {}
  }
}

/* ---------- message building ---------- */

/**
 * Builds a multipart/alternative RFC 5322 message with UTF-8 text and HTML
 * parts. Every header value that may carry non-ASCII goes through an RFC
 * 2047 encoded-word, so a Turkish name in the subject arrives intact.
 */
export function buildMessage({ from, fromName, to, replyTo, subject, text, html }) {
  const boundary = `=_fkr_${crypto.randomUUID().replace(/-/g, '')}`
  const date = new Date().toUTCString().replace('GMT', '+0000')
  const id = `<${crypto.randomUUID()}@fkrmediausa.com>`

  const headers = [
    `Date: ${date}`,
    `Message-ID: ${id}`,
    `From: ${mailbox(fromName, from)}`,
    `To: ${to.map((a) => `<${a}>`).join(', ')}`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${encodeWord(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    'X-Mailer: fkr-media-usa worker'
  ].filter(Boolean)

  const part = (type, content) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset=UTF-8`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(b64(content))
    ].join(CRLF)

  return [
    ...headers,
    '',
    part('text/plain', text),
    part('text/html', html),
    `--${boundary}--`,
    ''
  ].join(CRLF)
}

/** `"Name" <addr>` with the name encoded when it needs to be. */
function mailbox(name, addr) {
  if (!name) return `<${addr}>`
  const safe = /^[\w .'-]+$/.test(name) ? `"${name}"` : encodeWord(name)
  return `${safe} <${addr}>`
}

function encodeWord(value) {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`
}

function b64(value) {
  const bytes = new TextEncoder().encode(value)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function wrap76(value) {
  return value.replace(/(.{76})/g, `$1${CRLF}`)
}

/** Splits `"Name" <addr>` or `addr` into its parts. */
export function parseAddress(value) {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(value || '')
  if (m) return { name: (m[1] || '').trim(), address: m[2].trim() }
  return { name: '', address: (value || '').trim() }
}
