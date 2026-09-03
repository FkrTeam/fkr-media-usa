import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { qs, qsa } from '../utils/dom.js'
import { prefersReducedMotion } from '../utils/device.js'

/**
 * Navigation behaviour — shell level, created once for the session.
 *
 * Two things only: the bar compacts once the hero is behind you, and
 * in-page anchors scroll smoothly. Route highlighting belongs to the
 * router, which knows the current path; it is not re-derived here.
 *
 * The bar never hides on scroll-down. A floating bar that plays
 * hide-and-seek is a nuisance, not a flourish.
 */
export function initNavigation({ router } = {}) {
  const nav = qs('[data-nav]')
  if (!nav) return

  ScrollTrigger.create({
    start: 'top -80',
    end: 99999,
    onUpdate: (self) => nav.classList.toggle('is-compact', self.scroll() > 80),
    onToggle: (self) => nav.classList.toggle('is-compact', self.isActive)
  })

  const reduced = prefersReducedMotion()

  // Same-document anchors only. Cross-route links carry `data-route-link`
  // and are claimed by the router before this listener ever sees them.
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[href^="#"]')
    if (!anchor || anchor.hasAttribute('data-route-link')) return

    const id = anchor.getAttribute('href')
    if (!id || id === '#') return

    const target = document.querySelector(id)
    if (!target) return

    event.preventDefault()
    const top = id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY

    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
    // Keep the keyboard where the eye went.
    target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
  })

  // Warm the next route on intent, so the swap has nothing to wait for.
  if (router) {
    for (const link of qsa('a[data-route-link]')) {
      const warm = () => router.prefetch(link.getAttribute('href'))
      link.addEventListener('pointerenter', warm, { once: true })
      link.addEventListener('focus', warm, { once: true })
    }
  }

  gsap.set(nav, { y: '-101%' })
}
