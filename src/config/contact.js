/**
 * Contact form integration point.
 *
 * The form posts JSON to `endpoint`, resolved against the deploy base, and
 * both deploys answer it with the same rules: on Cloudflare the Worker
 * (worker/index.js), on a shared Linux host api/contact.php (shipped in
 * public/, routed by .htaccess). Either way the enquiry is stored in MySQL
 * and emailed to FKR. A host with neither answers 404 and the form falls
 * back to the pre-filled mailto route instead of claiming success.
 *
 * Set `endpoint` to null to disconnect the form: it will then validate but
 * report plainly that nothing was sent, keeping the visitor's text.
 */

export const contactConfig = {
  /**
   * @type {string|null} POST target. A leading slash means "under the deploy
   * base" (so /api/contact becomes /fkr-media-usa/api/contact on the
   * sub-directory host); a full URL is used as is. Null = not connected.
   */
  endpoint: '/api/contact',

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
