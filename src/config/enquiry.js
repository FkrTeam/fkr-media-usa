/**
 * The options the enquiry form offers — THE one list of them.
 *
 * Four things read this: the form's own <select>s (components/render.js),
 * the Cloudflare Worker (worker/index.js), the PHP endpoint by way of the
 * table generated into public/api/labels.php (scripts/labels.mjs), and the
 * validation in both backends.
 *
 * That matters because the form submits an id (`digital-advertising`) and
 * the enquiry is stored and emailed as a label (`Digital Advertising`).
 * Two lists would drift the moment a service was added: the select would
 * offer an option the server rejects, or the database would keep a raw
 * slug for it. There is one list, so it cannot.
 *
 * Add a service in data/services.js and it appears here automatically.
 * `other` is the form's own option and has no catalogue entry, so it is
 * named here.
 */

import { services } from '../data/services.js'
import { budgetRanges } from './contact.js'

/** `{ value, label }` per service, in the order the catalogue lists them. */
export const serviceOptions = [
  ...services.map(({ id, name }) => ({ value: id, label: name })),
  { value: 'other', label: 'Something else' }
]

/** `{ value, label }` per budget band. The first has an empty value: optional. */
export const budgetOptions = budgetRanges

/** id → label, for turning a submitted value into something readable. */
export const serviceLabels = Object.fromEntries(
  serviceOptions.map(({ value, label }) => [value, label])
)

export const budgetLabels = Object.fromEntries(
  budgetOptions.filter(({ value }) => value).map(({ value, label }) => [value, label])
)
