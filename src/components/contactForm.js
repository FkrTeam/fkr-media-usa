import { qs, qsa } from '../utils/dom.js'
import { contactConfig } from '../config/contact.js'

/**
 * Project enquiry form.
 *
 * Validation is done here rather than left to the browser so the messages
 * can say what is actually wrong, appear next to the field, and be
 * announced. Errors are marked with `aria-invalid` and text — never with
 * colour alone.
 *
 * The submit path is honest about its own state: while
 * `contactConfig.endpoint` is null the form will NOT claim success. It
 * reports that it is not connected, keeps everything the visitor typed, and
 * offers the mailto route instead. Silently discarding an enquiry would
 * lose real business.
 */

const VALIDATORS = {
  name: (value) => (value.trim().length >= 2 ? '' : 'Please enter your name.'),
  email: (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? '' : 'Please enter a valid email address.',
  service: (value) => (value ? '' : 'Please choose the service you are interested in.'),
  message: (value) =>
    value.trim().length >= 10 ? '' : 'Please tell us a little more — at least a sentence.'
}

export default class ContactForm {
  constructor() {
    // Assigned before any early return so destroy() is always safe.
    this._cleanups = []

    this.form = qs('[data-contact-form]')
    if (!this.form) return

    this.status = qs('[data-contact-status]')
    this.submit = qs('[data-contact-submit]')
    this.submitLabel = qs('[data-submit-label]')
    this.loadedAt = Date.now()
    this.sending = false

    this._bind()
  }

  _bind() {
    this._on(this.form, 'submit', (event) => this._onSubmit(event))

    // Validate on blur, not on every keystroke — nobody wants to be told
    // their email is invalid while they are still typing it.
    for (const field of qsa('[name]', this.form)) {
      if (!VALIDATORS[field.name]) continue
      this._on(field, 'blur', () => this._validateField(field))
      this._on(field, 'input', () => {
        if (field.getAttribute('aria-invalid') === 'true') this._validateField(field)
      })
    }
  }

  _on(target, type, handler) {
    if (!target) return
    target.addEventListener(type, handler)
    this._cleanups.push(() => target.removeEventListener(type, handler))
  }

  _validateField(field) {
    const validate = VALIDATORS[field.name]
    if (!validate) return true

    const message = validate(field.value)
    const error = qs(`[data-error-for="${field.name}"]`, this.form)

    field.setAttribute('aria-invalid', message ? 'true' : 'false')
    field.classList.toggle('is-invalid', Boolean(message))
    if (error) error.textContent = message

    return !message
  }

  _validateAll() {
    let firstInvalid = null

    for (const field of qsa('[name]', this.form)) {
      if (!VALIDATORS[field.name]) continue
      if (!this._validateField(field) && !firstInvalid) firstInvalid = field
    }

    if (firstInvalid) {
      firstInvalid.focus()
      this._setStatus('Please correct the highlighted fields.', 'error')
    }

    return !firstInvalid
  }

  _setStatus(message, tone = '') {
    if (!this.status) return
    this.status.textContent = message
    this.status.dataset.tone = tone
  }

  _setSending(sending) {
    this.sending = sending
    if (this.submit) this.submit.disabled = sending
    if (this.submitLabel) this.submitLabel.textContent = sending ? 'Sending…' : 'Send enquiry'
  }

  async _onSubmit(event) {
    event.preventDefault()
    if (this.sending) return

    const data = new FormData(this.form)

    // Honeypot + time trap. A bot fills the hidden field, or submits faster
    // than a person could have read the form.
    const trapped =
      Boolean(data.get(contactConfig.honeypotField)) ||
      (Date.now() - this.loadedAt) / 1000 < contactConfig.minSubmitSeconds

    if (!this._validateAll()) return

    if (trapped) {
      // Say nothing useful to a bot, but never block a real person twice.
      this._setStatus(contactConfig.messages.error, 'error')
      return
    }

    const payload = Object.fromEntries(data.entries())
    delete payload[contactConfig.honeypotField]

    if (!contactConfig.endpoint) {
      // Not connected. Be explicit, keep the visitor's text, and hand them
      // a route that actually works.
      this._setStatus(contactConfig.messages.notConnected, 'warn')
      this._offerMailto(payload)
      console.warn(
        '[contact] No endpoint configured — nothing was sent. Set `endpoint` in src/config/contact.js.',
        payload
      )
      return
    }

    this._setSending(true)
    this._setStatus(contactConfig.messages.sending, '')

    try {
      const response = await fetch(contactConfig.endpoint, {
        method: 'POST',
        headers:
          contactConfig.encoding === 'json'
            ? { 'Content-Type': 'application/json', Accept: 'application/json', ...contactConfig.headers }
            : { ...contactConfig.headers },
        body: contactConfig.encoding === 'json' ? JSON.stringify(payload) : data
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      this.form.reset()
      this._setStatus(contactConfig.messages.success, 'success')
    } catch (error) {
      console.warn('[contact] submission failed', error)
      this._setStatus(contactConfig.messages.error, 'error')
      this._offerMailto(payload)
    } finally {
      this._setSending(false)
    }
  }

  /** Appends a pre-filled mailto so the enquiry is never simply lost. */
  _offerMailto(payload) {
    if (!this.status || !contactConfig.fallbackMailto) return
    if (qs('[data-mailto-fallback]', this.status)) return

    const subject = encodeURIComponent(`Project enquiry — ${payload.name || 'FKR Media USA'}`)
    const body = encodeURIComponent(
      [
        `Name: ${payload.name || ''}`,
        `Company: ${payload.company || ''}`,
        `Email: ${payload.email || ''}`,
        `Phone: ${payload.phone || ''}`,
        `Service: ${payload.service || ''}`,
        `Budget: ${payload.budget || ''}`,
        '',
        payload.message || ''
      ].join('\n')
    )

    const link = document.createElement('a')
    link.className = 'link'
    link.dataset.mailtoFallback = 'true'
    link.href = `mailto:${contactConfig.fallbackMailto}?subject=${subject}&body=${body}`
    link.textContent = 'Send it by email instead'

    this.status.append(document.createTextNode(' '), link)
  }

  destroy() {
    for (const off of this._cleanups ?? []) off()
    this._cleanups = []
  }
}
