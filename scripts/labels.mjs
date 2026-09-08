/**
 * Generates public/api/labels.php from src/config/enquiry.js.
 *
 * The PHP endpoint needs the same id → label tables the Worker imports
 * directly, and PHP cannot read an ES module. Rather than keep a second
 * hand-written copy — which would drift the first time a service was added,
 * leaving the database holding a raw slug — the table is generated from the
 * same source on every build (`prebuild`, alongside scripts/pages.mjs).
 *
 * The output is build product, not source: it is gitignored, and editing it
 * by hand is pointless because the next build overwrites it.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { serviceLabels, budgetLabels } from '../src/config/enquiry.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'public/api/labels.php')

/** PHP single-quoted string: only \ and ' need escaping. */
const q = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const table = (map, indent = '    ') =>
  Object.entries(map)
    .map(([key, label]) => `${indent}${q(key)} => ${q(label)},`)
    .join('\n')

const php = `<?php
/**
 * GENERATED FILE — do not edit.
 *
 * Written by scripts/labels.mjs from src/config/enquiry.js on every build.
 * Any change made here is lost on the next \`npm run build\`; change the
 * service catalogue in src/data/services.js or the budget bands in
 * src/config/contact.js instead.
 *
 * These tables are both the allow-list the endpoint validates against and
 * the labels it stores, so the form can never submit a value the endpoint
 * would keep as a raw slug.
 */

declare(strict_types=1);

return [
    'services' => [
${table(serviceLabels, '        ')}
    ],
    'budgets' => [
${table(budgetLabels, '        ')}
    ],
];
`

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, php, 'utf8')

console.log(
  `[labels] public/api/labels.php — ${Object.keys(serviceLabels).length} services, ${Object.keys(budgetLabels).length} budget bands`
)
