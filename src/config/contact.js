/**
 * Contact form integration point.
 *
 * ══════════════════════════════════════════════════════════════════════
 *  THE FORM IS NOT CONNECTED TO A BACKEND.
 *
 *  `endpoint` is null. While it is null the form validates, but it will
 *  NOT report a successful submission — it shows an explicit "not yet
 *  connected" error and preserves everything the visitor typed.
 *
 *  This is deliberate. Silently swallowing an enquiry and showing a green
 *  tick would lose real business.
 *
 *  To connect it, set `endpoint` to a URL that accepts a JSON POST and
 *  returns 2xx on success. Anything works: a form service (Formspree,
 *  Basin, Web3Forms), a serverless function, or your own API.
 * ══════════════════════════════════════════════════════════════════════
 */

export const contactConfig = {
  /** @type {string|null} POST target. Null = not connected. */
  endpoint: null,

  /** Sent as JSON unless you switch this to 'form'. */
  encoding: 'json',

  /** Extra headers for the request, if your endpoint needs them. */
  headers: {},

  /** Name of the hidden honeypot field; a filled value is treated as spam. */
  honeypotField: 'company_website',

  /** Minimum seconds between page load and submit — bots submit instantly. */
  minSubmitSeconds: 2,

  /** Where the enquiry should be mailed if you use a mailto fallback. */
  fallbackMailto: 'hello@fkrmediausa.com',

  messages: {
    sending: 'Sending your enquiry…',
    success: 'Thank you — your enquiry is with us. We will be in touch.',
    error: 'Something went wrong sending that. Please email us directly and we will pick it up.',
    notConnected:
      'This form is not connected to a mail service yet, so nothing was sent. Please email us directly — your message has been kept in the form.'
  }
}

/** Budget bands offered in the enquiry form. PLACEHOLDER — confirm before launch. */
export const budgetRanges = [
  { value: '', label: 'Select a range (optional)' },
  { value: 'under-25k', label: 'Under $25,000' },
  { value: '25-50k', label: '$25,000 – $50,000' },
  { value: '50-100k', label: '$50,000 – $100,000' },
  { value: '100k-plus', label: '$100,000+' },
  { value: 'unsure', label: 'Not sure yet' }
]

export default contactConfig
