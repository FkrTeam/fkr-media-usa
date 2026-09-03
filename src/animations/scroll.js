import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { qs, qsa, asset } from '../utils/dom.js'
import { clamp } from '../utils/math.js'
import { prefersReducedMotion } from '../utils/device.js'
import { revealOnScroll, revealWords, revealLines, countUp, EASE } from './transitions.js'

/**
 * The scroll layer.
 *
 * Native scrolling throughout — no hijacking, no smoothing library. Nothing
 * is pinned; the sticky service index on /services uses `position: sticky`
 * and ScrollTrigger only observes it.
 *
 * Every trigger created here is registered against the current page so the
 * router can kill the whole set in one call on route change.
 */

/* ── WebGL response per section ────────────────────────────────────────
   One idea, tuned per section, rather than a different effect each time:
   the field's accent rises where the page is asking for energy and falls
   where it is asking to be read. */
const SECTION_ACCENT = [
  ['.hero', 0.10],
  ['.logostrip', 0.14],
  ['.intro-block', 0.28],   // About — the world opens a little
  ['.services', 0.20],
  ['.services-overview', 0.20],
  ['.services-detail', 0.24],
  ['.numbers', 0.42],       // signal density rises
  ['.reviews', 0.04],       // quiet: readability first
  ['.references', 0.16],
  ['.manifesto', 0.12],
  ['.approach', 0.18],
  ['.values', 0.22],
  ['.process', 0.24],
  ['.propositions', 0.20],
  ['.enquiry', 0.30],
  ['.contact-cta', 0.62]    // resolves toward the brand focal energy
]

function initSectionMoods(experience) {
  if (!experience) return

  for (const [selector, accent] of SECTION_ACCENT) {
    for (const section of qsa(selector)) {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 62%',
        end: 'bottom 38%',
        onToggle: (self) => {
          if (self.isActive) experience.ambient = accent
        }
      })
    }
  }
}

/* ── The DOM-synced media plane ───────────────────────────────────────── */

function initMediaPlane({ experience }) {
  const stage = qs('[data-media-stage]')
  const plane = experience?.world.mediaPlane

  if (!experience) return
  if (!stage || !plane) {
    experience.setMediaStage(null)
    return
  }

  experience.setMediaStage(stage)

  // The texture belongs to the section, not to the boot sequence: it is
  // fetched the first time the section is anywhere near the viewport.
  const src = stage.dataset.mediaSrc
  let requested = false

  const loadTexture = () => {
    if (requested || !src) return
    requested = true

    // Keyed by source: a different route asking for a different visual gets
    // its own stage rather than silently reusing the first one loaded.
    const stageKey = `media:${src}`
    experience.resources
      .registerStage(stageKey, [{ id: stageKey, type: 'texture', src }])
      .loadStage(stageKey)
      .then(() => {
        const texture = experience.resources.get(stageKey)
        if (texture) plane.setTextures([texture])
      })
  }

  const fallback = qs('[data-media-fallback]', stage)
  if (fallback && src) fallback.style.backgroundImage = `url(${asset(src)})`

  ScrollTrigger.create({
    trigger: stage,
    start: 'top bottom+=40%',
    once: true,
    onEnter: loadTexture
  })

  ScrollTrigger.create({
    trigger: stage,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      gsap.to(plane, { opacity: self.isActive ? 1 : 0, duration: 0.6, ease: 'power2.out' })
    }
  })

  stage.addEventListener('pointerenter', () => { plane.hover = 1 })
  stage.addEventListener('pointerleave', () => { plane.hover = 0 })
}

/* ── Home · services index ────────────────────────────────────────────── */

function initServicesIndex({ experience }) {
  const rows = qsa('.srv')
  if (!rows.length) return

  for (const row of rows) {
    const open = () => { if (experience) experience.accent = 0.9 }
    const close = () => { if (experience) experience.accent = 0 }

    row.addEventListener('pointerenter', open)
    row.addEventListener('pointerleave', close)
    // Keyboard gets the identical state — red is never the only signal.
    row.addEventListener('focus', open)
    row.addEventListener('blur', close)
  }
}

/* ── /services · sticky index + scroll progress ───────────────────────── */

function initServiceDetail({ experience }) {
  const layout = qs('.services-detail__layout')
  if (!layout) return

  const articles = qsa('[data-detail]')
  const links = qsa('[data-index-for]')
  const progress = qs('[data-detail-progress]')
  if (!articles.length) return

  const setActive = (id) => {
    for (const link of links) {
      link.classList.toggle('is-active', link.dataset.indexFor === id)
    }
  }

  articles.forEach((article, i) => {
    ScrollTrigger.create({
      trigger: article,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        if (!self.isActive) return
        setActive(article.dataset.detail)
        if (experience) experience.accent = 0.25 + (i / articles.length) * 0.5
      }
    })
  })

  if (progress) {
    ScrollTrigger.create({
      trigger: layout,
      start: 'top 55%',
      end: 'bottom 65%',
      onUpdate: (self) => {
        progress.style.transform = `scaleY(${clamp(self.progress)})`
      }
    })
  }

  setActive(articles[0].dataset.detail)

  // Overview cards and index links jump within the page.
  for (const jump of qsa('[data-jump]')) {
    jump.addEventListener('click', (event) => {
      const target = document.getElementById(jump.dataset.jump)
      if (!target) return
      event.preventDefault()
      const top = target.getBoundingClientRect().top + window.scrollY - 120
      window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    })
  }
}

/* ── Ambient reveals ──────────────────────────────────────────────────── */

function initReveals(splits) {
  revealOnScroll()

  for (const [node, targets] of splits) {
    if (node.hasAttribute('data-split-words')) {
      revealWords(targets, node.closest('.section') ?? node)
      continue
    }

    ScrollTrigger.create({
      trigger: node,
      start: 'top 84%',
      once: true,
      onEnter: () => revealLines(targets, { duration: 1.15, stagger: 0.08 })
    })
  }

  for (const counter of qsa('[data-count]')) countUp(counter)

  // `[data-rule]` opts anything else into the same draw — the practice
  // ladder's vertical line uses it, so the section rules and that line are
  // never animated by two different pieces of code.
  for (const head of qsa('.section-head, [data-rule]')) {
    gsap.fromTo(
      head,
      { '--rule-scale': 0 },
      {
        '--rule-scale': 1,
        duration: 1.2,
        ease: EASE.state,
        scrollTrigger: { trigger: head, start: 'top 90%', once: true }
      }
    )
  }
}

/**
 * Wires the scroll layer for whichever route is currently in the DOM.
 * Returns nothing — teardown is handled by `killPageTriggers`.
 */
export function initScroll({ experience, splits }) {
  ScrollTrigger.config({ ignoreMobileResize: true })

  initSectionMoods(experience)
  initMediaPlane({ experience })
  initServicesIndex({ experience })
  initServiceDetail({ experience })
  initReveals(splits)

  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh())
}

/**
 * Kills the ScrollTriggers belonging to the page content, leaving the
 * shell's own (the navigation bar's compact-state trigger) alive. Called
 * before the router swaps `<main>`, so nothing is left pointing at
 * detached nodes.
 */
/**
 * Puts the document back to the top, immediately.
 *
 * Three separate things fight a route change for the scroll position, and
 * this has to beat all of them:
 *
 *  1. `styles/base.css` sets `scroll-behavior: smooth` on <html>, which turns
 *     a bare `scrollTo(0, 0)` into a ~700ms ANIMATION. That animation is
 *     measured against the outgoing document, the router replaces <main>
 *     underneath it, and it ends wherever the new height leaves it — which
 *     is exactly the "new page opens halfway down" symptom. An explicit
 *     `behavior` on the options object overrides the stylesheet.
 *  2. ScrollTrigger keeps its own record of where each document was scrolled
 *     and restores it on `refresh()`. Clearing that memory in the same breath
 *     stops it undoing this a frame later.
 *  3. The browser's own `history.scrollRestoration`, which puts a reloaded
 *     page back where the visitor left it — on this site, halfway down a
 *     document hidden behind a 40s intro film.
 *
 * Point 3 is why `clearScrollMemory` is passed 'manual' rather than called
 * bare. Assigning `history.scrollRestoration` directly does NOT hold:
 * ScrollTrigger reads the original value when its module first loads and
 * writes that value back after every `refresh()`, so a direct assignment is
 * silently reverted on the next refresh. Passing 'manual' through this call
 * updates ScrollTrigger's own copy as well, which is the only version that
 * survives.
 *
 * A hash in the URL is the one case where the top is the wrong answer, so
 * callers check for it before calling.
 */
/**
 * Scrolls to an in-page target, if it exists.
 *
 * Needed on first load as well as on route changes: most sections on this
 * site are built from data AFTER the document parses, so at the moment the
 * browser tries to resolve `/services/#seo` natively the element does not
 * exist yet and it silently gives up at the top. Calling this once the page
 * is mounted is what makes a shared deep link land where it says it will.
 *
 * Returns whether it found the target, so a caller can fall back to the top.
 */
export function scrollToHash(hash, { smooth = true } = {}) {
  if (!hash || hash === '#') return false

  let target = null
  try {
    target = document.querySelector(hash)
  } catch {
    return false   // not a valid selector — e.g. "#2024"
  }
  if (!target) return false

  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY,
    behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'instant'
  })
  return true
}

export function resetScroll() {
  ScrollTrigger.clearScrollMemory('manual')
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

export function killPageTriggers() {
  const main = document.querySelector('#main')
  if (!main) return

  for (const trigger of ScrollTrigger.getAll()) {
    if (trigger.trigger && main.contains(trigger.trigger)) trigger.kill()
  }
}
