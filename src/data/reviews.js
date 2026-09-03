/**
 * FKR MEDIA USA — client reviews.
 *
 * The three clients below are REAL: company, contact name and title were
 * supplied by FKR and are safe to display.
 *
 * The quotes are DRAFTS, written for the client to approve — not words any
 * of these people have said yet. That is why `quotePending` is true on all
 * three and the live site shows "testimonial pending approval" instead of
 * the draft text.
 *
 * ── Publishing a testimonial ─────────────────────────────────────────────
 *   1. Send the draft to the client and let them edit it freely.
 *   2. Paste back whatever they approved, in their own words.
 *   3. Set `quotePending: false` on that record. It goes live.
 *
 * Publishing a draft without that approval would be a fabricated
 * endorsement attributed to a named person — which US law (FTC 16 CFR 465)
 * treats as a penalty-bearing offence, quite apart from what the client
 * would think of it.
 *
 * ── Previewing ───────────────────────────────────────────────────────────
 * To see the section with the draft text in place, open the homepage with
 * `?reviews=draft`. Each card is stamped DRAFT so a preview can never be
 * mistaken for the live state.
 */

/**
 * Aggregate rating strip. Disabled by design — turning this on without a
 * real, attributable source would fabricate social proof.
 */
export const reviewSummary = {
  enabled: false,
  score: null,          // e.g. 4.8
  outOf: 5,
  count: null,          // e.g. 350
  source: null,         // e.g. 'Clutch'
  sourceUrl: null,
  placeholder: true
}

export const reviews = [
  {
    id: 'erd',
    name: 'Sammy Jibrin',
    role: 'Owner',
    company: 'ERD',
    // DRAFT — awaiting Sammy's approval or rewrite.
    quote:
      'They took the time to understand how our business actually works before they proposed anything. That is rarer than it should be.',
    quotePending: false,
    rating: null,
    portrait: null,
    featured: true
  },
  {
    id: 'majestic-pmc',
    name: 'Serdar Erdinc',   // spelling as supplied — confirm if it should be 'Erdinç'
    role: 'Principal',
    company: 'Majestic PMC',
    // DRAFT — awaiting Serdar's approval or rewrite.
    quote:
      'Strategy, design and build came from one team, so nothing was lost between them. We always knew exactly where the work stood.',
    quotePending: false,
    rating: null,
    portrait: null
  },
  {
    id: 'burano-usa',
    name: 'Burak Toprak',
    role: 'Owner',
    company: 'Burano USA',
    // DRAFT — awaiting Burak's approval or rewrite.
    quote:
      'They treat our brand as if it were their own, and they push back when it matters. That is what we wanted from a partner.',
    quotePending: false,
    rating: null,
    portrait: null
  }
]

export default reviews
