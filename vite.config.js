import { defineConfig, loadEnv } from 'vite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Serves `/services` from `services/index.html`, the way every static host
 * does (nginx `try_files $uri $uri/index.html`, Netlify, Vercel, S3+
 * CloudFront). Without it the dev and preview servers 404 on a route URL
 * that works perfectly in production, which is a trap rather than a test.
 */
function directoryIndex(projectRoot, distRoot, base) {
  const rewriteFrom = (dir) => (req, _res, next) => {
    const [pathname] = (req.url || '/').split('?')
    if (pathname.endsWith('/') || pathname.includes('.')) return next()

    // Files live at the root of the served directory; the URL carries the
    // deploy base in front of them.
    const relative = pathname.startsWith(base) ? pathname.slice(base.length - 1) : pathname

    if (existsSync(resolve(dir, `.${relative}/index.html`))) {
      req.url = `${pathname}/index.html${(req.url || '').slice(pathname.length)}`
    }
    next()
  }

  return {
    name: 'fkr-directory-index',
    // Dev serves from the project root; preview serves from the build output.
    // These must not return a value — Vite treats a returned function as a
    // post-hook and would call the connect app with no arguments.
    configureServer(server) {
      server.middlewares.use(rewriteFrom(projectRoot))
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteFrom(distRoot))
    }
  }
}

export default defineConfig(({ mode }) => {
  // Where the site is served from. Route documents live in nested
  // directories (services/index.html), so relative asset URLs would resolve
  // wrongly from different depths — the base has to be explicit.
  // Set it once in .env; scripts/pages.mjs reads the same value.
  const env = loadEnv(mode, process.cwd(), '')
  const base = (env.VITE_BASE || '/').replace(/\/*$/, '/')

  return {
  base,
  // Multi-page, not single-page: each route is a real document on disk, so
  // the dev/preview servers must resolve /services to services/index.html
  // rather than falling back to the home page.
  appType: 'mpa',
  plugins: [directoryIndex(__dirname, resolve(__dirname, 'dist'), base)],
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    cssCodeSplit: false,
    reportCompressedSize: false,
    // Three.js is ~520 kB raw / ~130 kB gzipped in its own chunk — expected
    // for a WebGL experience, so the warning threshold is raised rather than
    // left to cry wolf on every build.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      // One real document per route — direct URLs work on any static host
      // without rewrite rules, and each carries its own metadata.
      input: {
        home: resolve(__dirname, 'index.html'),
        services: resolve(__dirname, 'services/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        contact: resolve(__dirname, 'contact/index.html')
      },
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap']
        }
      }
    }
  }
  }
})
