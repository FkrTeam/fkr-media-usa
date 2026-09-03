/**
 * Composes the static route documents from one shell.
 *
 * Every route ships as a real HTML file so a direct URL works on any static
 * host with no rewrite rules, and so the per-route metadata is in the markup
 * for crawlers rather than being patched in by JavaScript. In-session
 * navigation is then taken over by the client router, which swaps <main>
 * only and keeps the WebGL context alive.
 *
 * Inputs   src/pages/_shell.html + src/pages/<route>.html
 * Outputs  index.html, services/index.html, about/index.html, contact/index.html
 *
 * Runs automatically before `npm run dev` and `npm run build`.
 *   node scripts/pages.mjs
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { siteData, addressLine, addressShort } from '../src/data/site.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = resolve(root, 'src/pages')

/**
 * The deploy base, from .env (or the environment). Vite reads the same
 * value for asset URLs; this script applies it to the internal links and
 * records it on <html data-base> so the router and the asset helper agree
 * with the markup at runtime.
 */
function readEnv(key, fallback) {
  if (process.env[key]) return process.env[key]

  const envFile = resolve(root, '.env')
  if (!existsSync(envFile)) return fallback

  // Double-escaped: this is a template literal, so `\s` alone would be
  // flattened to a bare `s` before RegExp ever saw it.
  const match = readFileSync(envFile, 'utf8')
    .match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, 'm'))

  return match ? match[1].trim().replace(/^["']|["']$/g, '') : fallback
}

const normaliseBase = (value) => `/${String(value).replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')

const BASE = normaliseBase(readEnv('VITE_BASE', '/'))

/** Production origin — canonical and social URLs only, never asset paths. */
const ORIGIN = readEnv('VITE_SITE_URL', 'https://fkrmediausa.com').replace(/\/+$/, '')
const shell = readFileSync(resolve(pagesDir, '_shell.html'), 'utf8')

/**
 * A cache-busting id for everything under public/.
 *
 * Vite already writes a content hash into every filename it emits, so the
 * JavaScript, the CSS and the fonts can never be served stale — a changed
 * file simply has a different name. Files copied verbatim out of public/
 * get no such treatment: a client logo replaced at the same path keeps the
 * same URL forever, and a browser that cached it will go on showing the old
 * one. This id closes that gap.
 *
 * It is a hash of the actual bytes in public/, NOT a timestamp. A build that
 * changes nothing produces the same id, so visitors keep their cached copies
 * instead of re-downloading 400 KB of identical logos on every deploy —
 * while a single replaced image changes the id and invalidates them all.
 */
function hashDirectory(dir) {
  const hash = createHash('sha256')

  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) walk(full)
      else {
        // Path separators are normalised so a build on Windows and a build
        // on CI produce the same id for the same files.
        hash.update(full.slice(dir.length).split(sep).join('/'))
        hash.update(readFileSync(full))
      }
    }
  }

  if (existsSync(dir)) walk(dir)
  return hash.digest('hex').slice(0, 8)
}

const BUILD_ID = hashDirectory(resolve(root, 'public'))

/**
 * Contact facts, substituted into the markup at build time.
 *
 * They live in src/data/site.js and are written into the HTML here rather
 * than rendered by JavaScript, so an address or an email is real crawlable
 * prose AND exists in exactly one place. The email drifting across six files
 * once was enough.
 *
 * `{{sameAs}}` is the JSON-LD social list, built from the same `socials`
 * array the footer renders — search engines get the accounts from the
 * markup rather than from a second, drift-prone copy.
 */
const { contact } = siteData
const FACTS = {
  '{{email}}': contact.email,
  '{{addressLine}}': addressLine,
  '{{addressShort}}': addressShort,
  '{{addressStreet}}': contact.address.street,
  '{{addressCityRegion}}': `${contact.address.city}, ${contact.address.region} ${contact.address.postalCode}`,
  '{{addressCountry}}': contact.address.country,
  '{{addressCity}}': contact.address.city,
  '{{addressRegion}}': contact.address.region,
  '{{addressPostal}}': contact.address.postalCode,
  '{{addressCountryCode}}': contact.address.countryCode,
  '{{sameAs}}': JSON.stringify(siteData.socials.map((s) => s.url)),

  // Appended to the handful of public/ asset URLs written straight into the
  // shell markup. Everything the app requests at runtime gets the same query
  // from asset(), which reads the id back off <html data-build>.
  '{{v}}': `?v=${BUILD_ID}`
}

const applyFacts = (html) =>
  Object.entries(FACTS).reduce((out, [token, value]) => out.replaceAll(token, value), html)

const META = /^\s*<!--@meta\s*([\s\S]*?)-->/

const pages = readdirSync(pagesDir)
  .filter((file) => file.endsWith('.html') && !file.startsWith('_'))
  .sort()

let written = 0

for (const file of pages) {
  const source = readFileSync(resolve(pagesDir, file), 'utf8')
  const match = source.match(META)

  if (!match) {
    console.warn(`[pages] ${file} has no @meta block — skipped`)
    continue
  }

  const meta = JSON.parse(match[1])
  const body = source.slice(match[0].length).replace(/^\s*\n/, '')

  // Order matters: the body goes in first, then the shared facts and the
  // deploy base are applied to the WHOLE document — otherwise placeholders
  // and links inside a page body would never be touched.
  const composed = shell
    .replaceAll('{{title}}', escapeAttr(meta.title))
    .replaceAll('{{description}}', escapeAttr(meta.description))
    .replaceAll('{{canonical}}', canonicalFor(meta.path))
    .replaceAll('{{origin}}', `${ORIGIN}/`)
    .replaceAll('{{route}}', meta.route)
    .replace('{{body}}', body.trimEnd())

  const html = applyBase(applyFacts(composed))

  const out = resolve(root, meta.out)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html, 'utf8')
  written += 1
  console.log(`[pages] ${meta.out.padEnd(22)} ← ${file}`)
}

console.log(`[pages] ${written} route document${written === 1 ? '' : 's'} written — base ${BASE}, origin ${ORIGIN}, build ${BUILD_ID}`)

/**
 * Rewrites internal links and stamps the base onto <html>.
 *
 * Only `<a href="/…">` is touched. Stylesheet, script, icon and image URLs
 * are left alone because Vite already prefixes those with the same base
 * when it processes the document — prefixing them here would double it.
 */
function applyBase(html) {
  let out = html.replace('<html lang="en">', `<html lang="en" data-base="${BASE}" data-build="${BUILD_ID}">`)

  // `<a` followed by whitespace — the tag may be broken across lines.
  out = out.replace(/(<a[ \t\r\n][^>]*?href=")\/([^"]*)(")/g, (_match, head, path, tail) => {
    const clean = path.replace(/^\/+|\/+$/g, '')
    return `${head}${BASE}${clean ? `${clean}/` : ''}${tail}`
  })

  return out
}

/**
 * The absolute URL a route declares as its own.
 *
 * Deliberately built from the production origin and the route path ONLY —
 * the deploy base is left out. A staging copy at /fkr-media-usa/ should
 * still tell search engines that the original lives at
 * https://fkrmediausa.com/services/, not at the staging URL. That is what
 * stops the test site being indexed as a duplicate.
 */
function canonicalFor(path) {
  const clean = String(path).replace(/^\/+|\/+$/g, '')
  return `${ORIGIN}/${clean ? `${clean}/` : ''}`
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}
