/**
 * FKR MEDIA USA — company metrics.
 *
 * All four figures below were supplied by FKR and are live: `value` is set,
 * `placeholder` is false, and the renderer counts each one up when it scrolls
 * into view.
 *
 * Each figure carries a `+` suffix, which the renderer sets in the brand red
 * beside the number. That makes every one of them a floor rather than an
 * exact count — "at least 24 years", "at least 400 projects" — which is the
 * safer of the two claims and the one FKR asked for. Clear `suffix` on any
 * record that should read as an exact figure instead.
 *
 * Adding a record: the numbers grid is laid out for FOUR columns
 * (styles/sections.css, `.numbers__grid`). Changing the count here means
 * changing that rule too, or the row will not fill.
 *
 * A record with `value: null` and `placeholder: true` renders its `display`
 * string verbatim, dimmed, and never animates — so an unverified figure can
 * never be mistaken for a measured one.
 */

export const stats = [
  { id: 'years',     value: 24,  display: null, suffix: '+', label: 'Years of experience', placeholder: false },
  { id: 'projects',  value: 400, display: null, suffix: '+', label: 'Projects delivered',  placeholder: false },
  { id: 'clients',   value: 250, display: null, suffix: '+', label: 'Clients',             placeholder: false },
  { id: 'countries', value: 6,   display: null, suffix: '+', label: 'Countries',           placeholder: false }
]

export default stats
