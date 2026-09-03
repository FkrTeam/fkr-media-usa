import gsap from 'gsap'
import { qsa } from '../utils/dom.js'
import { splitLines, splitWords, restore } from '../utils/splitText.js'
import { prefersReducedMotion } from '../utils/device.js'

/**
 * Reusable motion. Every timeline in the site is assembled from these, so
 * the easing vocabulary stays consistent: `power4.out` for entries,
 * `power3.inOut` for state changes, `expo.out` for anything cinematic.
 */

export const EASE = {
  enter: 'power4.out',
  exit: 'power3.in',
  state: 'power3.inOut',
  cinematic: 'expo.out'
}

/**
 * Prepares split-text elements. Returns a map of element → line/word nodes,
 * ready for a ScrollTrigger or an intro timeline to animate.
 */
export function prepareSplits(reduced = prefersReducedMotion()) {
  const result = new Map()

  for (const node of qsa('[data-split-lines]')) {
    if (reduced) {
      restore(node)
      gsap.set(node, { opacity: 1 })
      continue
    }
    const lines = splitLines(node)
    gsap.set(lines, { yPercent: 108 })
    gsap.set(node, { opacity: 1 })
    result.set(node, lines)
  }

  for (const node of qsa('[data-split-words]')) {
    if (reduced) {
      restore(node)
      gsap.set(node, { opacity: 1 })
      continue
    }
    const words = splitWords(node)
    gsap.set(words, { yPercent: 60, opacity: 0 })
    gsap.set(node, { opacity: 1 })
    result.set(node, words)
  }

  return result
}

/** Masked-line entrance — the site's signature reveal. */
export function revealLines(lines, { delay = 0, stagger = 0.09, duration = 1.25 } = {}) {
  return gsap.to(lines, {
    yPercent: 0,
    duration,
    ease: EASE.cinematic,
    stagger,
    delay
  })
}

/** Word-by-word statement reveal, driven by scroll rather than time. */
export function revealWords(words, trigger) {
  return gsap.to(words, {
    yPercent: 0,
    opacity: 1,
    ease: 'power2.out',
    stagger: 0.6,
    scrollTrigger: {
      trigger,
      start: 'top 78%',
      end: 'bottom 62%',
      scrub: 0.8
    }
  })
}

/** Generic entrance for `[data-reveal]` elements. */
export function revealOnScroll(scope = document) {
  const reduced = prefersReducedMotion()
  // Hero reveals are owned by the intro handoff — never double-animate them.
  const items = qsa('[data-reveal]', scope).filter((node) => !node.closest('.hero'))

  for (const item of items) {
    if (reduced) {
      gsap.set(item, { opacity: 1, y: 0 })
      continue
    }

    gsap.to(item, {
      opacity: 1,
      y: 0,
      duration: 1.1,
      ease: EASE.enter,
      scrollTrigger: { trigger: item, start: 'top 88%', once: true }
    })
  }
}

/** Counts a statistic up when it enters the viewport. */
export function countUp(node) {
  const target = Number(node.dataset.count)
  if (!Number.isFinite(target)) return

  if (prefersReducedMotion()) {
    node.textContent = String(target)
    return
  }

  const state = { value: 0 }
  gsap.to(state, {
    value: target,
    duration: 2.2,
    ease: 'power3.out',
    scrollTrigger: { trigger: node, start: 'top 88%', once: true },
    onUpdate: () => {
      node.textContent = String(Math.round(state.value))
    }
  })
}
