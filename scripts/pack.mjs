/**
 * Packs the build for upload to a shared host.
 *
 *   npm run pack            → dist/ built for the domain root, then the zip
 *   npm run pack -- /sub/   → the same for a sub-directory deploy
 *
 * Three mistakes this exists to prevent, all of which are silent:
 *
 *   THE BASE. `.env` carries VITE_BASE=/fkr-media-usa/ for the Apache test
 *   host. A build made with that and uploaded to a domain root asks for
 *   /fkr-media-usa/assets/… — every stylesheet, script and image 404s and
 *   the page renders as unstyled text. This script builds with an explicit
 *   base and says which one it used.
 *
 *   THE ARCHIVE'S OWN LOCATION. Zipping dist/ from inside dist/ puts the
 *   archive in the upload, where it is then publicly downloadable — a copy
 *   of the whole site, including api/contact.php, at a guessable URL. The
 *   archive is written next to dist/, never into it.
 *
 *   THE PATH SEPARATOR. Windows PowerShell 5.1 writes zip entries with
 *   BACKSLASHES, which Linux extractors take literally: the upload ends up
 *   holding flat files actually named "api\contact.php" and the form 404s
 *   with nothing obviously wrong. pwsh (PowerShell 7, .NET Core) writes
 *   forward slashes — and the archive is inspected afterwards rather than
 *   trusted.
 *
 * Hidden files are included: .htaccess IS the routing, the HTTPS redirect
 * and the cache policy, and an upload without it serves api/contact.php as
 * a plain file.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const zip = resolve(root, 'site-upload.zip')

const base = (process.argv[2] || '/').replace(/\/*$/, '/')

console.log(`[pack] building with base ${base}`)
execFileSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_BASE: base }
})

if (!existsSync(resolve(dist, '.htaccess'))) {
  console.error('[pack] dist/.htaccess is missing — the upload would have no routing or cache policy')
  process.exit(1)
}

if (existsSync(zip)) rmSync(zip)

const pwsh = (script) =>
  execFileSync('pwsh', ['-NoProfile', '-Command', script], { encoding: 'utf8' })

console.log('[pack] packing')
if (process.platform === 'win32') {
  pwsh(`Add-Type -A System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${dist}', '${zip}')`)
} else {
  execFileSync('zip', ['-r', '-q', zip, '.'], { cwd: dist, stdio: 'inherit' })
}

// Refuse to hand over an archive that would extract wrongly on the host.
const names = pwsh(
  `Add-Type -A System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${zip}'); $z.Entries.FullName; $z.Dispose()`
)
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

const BACKSLASH = String.fromCharCode(92)
if (names.some((name) => name.includes(BACKSLASH))) {
  console.error('[pack] the archive holds backslash paths and would extract as flat, wrongly named files')
  process.exit(1)
}
for (const required of ['.htaccess', 'index.html', 'api/contact.php', 'contact/index.html']) {
  if (!names.includes(required)) {
    console.error(`[pack] ${required} is missing from the archive`)
    process.exit(1)
  }
}

const mb = (statSync(zip).size / 1024 / 1024).toFixed(1)
console.log(`[pack] ${names.length} entries, paths verified`)
console.log(`\n[pack] ${zip}  (${mb} MB)`)
console.log('[pack] upload it to public_html and EXTRACT it there — the zip itself is not the site.')
console.log('[pack] then check that .htaccess arrived: File Manager → Settings → show hidden files.')
