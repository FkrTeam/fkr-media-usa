/**
 * Prints the deploy checklist after every build.
 *
 * There is exactly one step in this deployment that fails silently, and it
 * fails the same way every time: `.htaccess` begins with a dot, and FTP
 * clients and cPanel file managers hide dotfiles by default. The upload then
 * "succeeds" while quietly dropping the only file that tells the server not
 * to cache the HTML — and the symptom appears days later as a page that will
 * not update. Everything else here is automatic, so this note exists mainly
 * to keep that one file in view.
 *
 * Runs automatically after `npm run build`.
 *   node scripts/deploy-note.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')

if (!existsSync(dist)) {
  console.error('\n[deploy] dist/ does not exist — did the build fail?\n')
  process.exit(1)
}

let files = 0
let bytes = 0
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full)
    else { files += 1; bytes += stat.size }
  }
}
walk(dist)

const htaccess = existsSync(join(dist, '.htaccess'))
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const buildId = html.match(/data-build="([0-9a-f]+)"/)?.[1] ?? '??'
const base = html.match(/data-base="([^"]+)"/)?.[1] ?? '??'
const mb = (bytes / 1024 / 1024).toFixed(1)

// A zip of the site left inside the site is publicly downloadable once the
// folder is uploaded.
const archives = readdirSync(dist).filter((f) => /\.(zip|tar|gz|rar|7z)$/i.test(f))

console.log(`
[deploy] dist/ ready — ${files} files, ${mb} MB, base ${base}, build ${buildId}

  Upload the CONTENTS of dist/ to the target directory. That is the whole
  routine; the build id, the asset hashes and the cache rules are all
  generated for you.

  ${htaccess ? '⚠  dist/.htaccess is a HIDDEN file. Turn on "show hidden files"' : '✗  dist/.htaccess is MISSING — public/.htaccess should have been copied'}
  ${htaccess ? '   in your FTP client or file manager, or it will be skipped without' : ''}
  ${htaccess ? '   any warning and the HTML will keep being served from cache.' : ''}
${archives.length ? `
  ⚠  Remove before uploading — these would be publicly downloadable:
     ${archives.join(', ')}
` : ''}
  Only rebuild-and-reupload is needed after a change. If a page still looks
  stale afterwards, the HTML was cached: check that .htaccess arrived.
`)
