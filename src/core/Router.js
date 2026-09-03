import gsap from 'gsap'
import { qs, qsa } from '../utils/dom.js'
import { prefersReducedMotion } from '../utils/device.js'
import { resetScroll, scrollToHash } from '../animations/scroll.js'

/**
 * Client-side router.
 *
 * Each route is also a real static document, so a direct URL or a hard
 * refresh works with no server rewrites. This router only takes over
 * *in-session* navigation: it fetches the target document, swaps `<main>`,
 * and lifts its metadata across — which is what keeps the WebGL context,
 * the render loop and the intro's session state alive across a route change.
 *
 * Nothing here recreates the renderer. That is the whole point.
 */

const HEAD_KEYS = [
  ['title', null],
  ['meta[name="description"]', 'content'],
  ['link[rel="canonical"]', 'href'],
  ['meta[property="og:title"]', 'content'],
  ['meta[property="og:description"]', 'content'],
  ['meta[property="og:url"]', 'content'],
  ['meta[name="twitter:title"]', 'content'],
  ['meta[name="twitter:description"]', 'content']
]

/** Normalises `/services`, `/services/`, `/services/index.html` to `/services`. */
export function normalisePath(pathname) {
  let path = pathname.replace(/index\.html$/, '')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  return path || '/'
}

export default class Router {
  /**
   * @param {object} opts
   * @param {(ctx:{path:string,route:string}) => void} opts.onEnter  wire the new page
   * @param {() => void} opts.onLeave  tear the old page down
   */
  constructor({ onEnter, onLeave }) {
    this.onEnter = onEnter
    this.onLeave = onLeave
    this.reduced = prefersReducedMotion()
    this.curtain = qs('[data-curtain]')
    this.main = qs('#main')
    this.navigating = false
    this.cache = new Map()
  }

  init() {
    this.path = normalisePath(location.pathname)
    this.markActive()

    document.addEventListener('click', this._onClick, { capture: false })
    window.addEventListener('popstate', this._onPop)
  }

  _onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const link = event.target.closest?.('a[data-route-link]')
    if (!link) return

    const href = link.getAttribute('href')
    if (!href) return

    const url = new URL(href, location.href)
    if (url.origin !== location.origin) return
    if (link.target && link.target !== '_self') return
    if (link.hasAttribute('download')) return

    const path = normalisePath(url.pathname)

    // Same route: let the in-page anchor behaviour handle it.
    if (path === this.path) {
      if (url.hash) return
      // Clicking the current route is a "take me back up" gesture, not a
      // navigation — so this one stays animated on purpose.
      event.preventDefault()
      window.scrollTo({ top: 0, behavior: this.reduced ? 'auto' : 'smooth' })
      return
    }

    event.preventDefault()
    this.go(url.pathname + url.hash, { push: true })
  }

  _onPop = () => {
    const path = normalisePath(location.pathname)
    if (path === this.path) return
    this.go(location.pathname + location.hash, { push: false })
  }

  /**
   * Warms a route document so the eventual swap is instant.
   *
   * The request always uses the directory form (`/services/`) because that
   * is what resolves to `services/index.html` on every static host — a
   * bare `/services` can hit an SPA fallback and quietly return the home
   * document instead.
   */
  prefetch(href) {
    const url = new URL(href, location.href)
    const key = normalisePath(url.pathname)
    if (this.cache.has(key)) return

    const request = key === '/' ? '/' : `${key}/`

    // `no-cache` means "revalidate before using", not "do not store": the
    // browser keeps its copy and still gets a cheap 304 when nothing has
    // changed. Route documents are the one asset class here with a stable
    // URL and changing contents — they name the hashed bundle, so a stale
    // document would pin the whole site to an old build.
    this.cache.set(key, fetch(request, { credentials: 'same-origin', cache: 'no-cache' })
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null))
  }

  async go(href, { push = true } = {}) {
    if (this.navigating) return
    this.navigating = true

    try {
      await this._navigate(href, push)
    } catch (error) {
      // Never leave the visitor behind a curtain because of one bad swap.
      console.error('[router] navigation failed', error)
      this.navigating = false
      gsap.set('[data-curtain]', { scaleY: 0 })
      gsap.set('[data-site]', { opacity: 1, y: 0 })
    }
  }

  async _navigate(href, push) {

    const url = new URL(href, location.href)
    const path = normalisePath(url.pathname)

    if (!this.cache.has(path)) this.prefetch(url.pathname)

    const d = this.reduced ? 0.01 : 1
    const out = gsap.timeline()

    // 1 · The page recedes behind a curtain rather than blinking away.
    if (this.curtain) {
      gsap.set(this.curtain, { transformOrigin: 'bottom' })
      out.fromTo(this.curtain,
        { scaleY: 0, opacity: 1 },
        { scaleY: 1, duration: d * 0.52, ease: 'power4.inOut' })
    }
    out.to('[data-site]', { opacity: 0, y: -24, duration: d * 0.4, ease: 'power2.in' }, 0)

    const [html] = await Promise.all([this.cache.get(path), out.then()])

    if (!html) {
      // Could not fetch the route — fall back to a full navigation rather
      // than stranding the visitor behind a curtain.
      location.href = url.href
      return
    }

    const doc = new DOMParser().parseFromString(html, 'text/html')
    const nextMain = doc.querySelector('#main')
    if (!nextMain) {
      location.href = url.href
      return
    }

    // 2 · Tear the old page down before its nodes are removed.
    this.onLeave?.()

    this.main.replaceChildren(...nextMain.childNodes)
    this.main.dataset.page = nextMain.dataset.page ?? ''
    document.body.dataset.route = doc.body.dataset.route ?? ''

    this._syncHead(doc)

    if (push) history.pushState({ path }, '', url.pathname + url.hash)
    this.path = path
    this.markActive()

    // The new route starts at its own beginning — never at the offset the
    // previous one happened to be left at. `onEnter` resets it a second time
    // after mounting, because ScrollTrigger.refresh() runs in there.
    if (!url.hash) resetScroll()

    // 3 · Wire the new page while it is still hidden.
    this.onEnter?.({ path, route: this.main.dataset.page })

    // 4 · Curtain lifts, content arrives.
    const enter = gsap.timeline({
      onComplete: () => {
        this.navigating = false
        this._focusMain()
        if (url.hash) this._jumpToHash(url.hash)
      }
    })

    enter.set('[data-site]', { y: 24 })
    if (this.curtain) {
      gsap.set(this.curtain, { transformOrigin: 'top' })
      enter.to(this.curtain, { scaleY: 0, duration: d * 0.62, ease: 'power4.inOut' })
    }
    enter.to('[data-site]', { opacity: 1, y: 0, duration: d * 0.7, ease: 'power3.out' }, d * 0.18)
  }

  _syncHead(doc) {
    for (const [selector, attr] of HEAD_KEYS) {
      const next = doc.querySelector(selector)
      const current = document.querySelector(selector)
      if (!next || !current) continue
      if (attr) current.setAttribute(attr, next.getAttribute(attr) ?? '')
      else current.textContent = next.textContent
    }
  }

  /** Marks the current route in both navigations. */
  markActive() {
    for (const link of qsa('[data-nav-link]')) {
      const href = link.getAttribute('href')
      if (!href) continue
      const active = normalisePath(new URL(href, location.href).pathname) === this.path
      link.classList.toggle('is-active', active)
      if (active) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    }
  }

  /** Screen-reader users must land in the new content, not at the old scroll. */
  _focusMain() {
    if (!this.main) return
    this.main.setAttribute('tabindex', '-1')
    this.main.focus({ preventScroll: true })
  }

  _jumpToHash(hash) {
    scrollToHash(hash, { smooth: !this.reduced })
  }

  destroy() {
    document.removeEventListener('click', this._onClick)
    window.removeEventListener('popstate', this._onPop)
  }
}
