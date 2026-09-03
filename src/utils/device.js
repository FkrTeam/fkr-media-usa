/**
 * Device capability detection.
 *
 * Everything expensive in this build is gated on the values here: particle
 * counts, post-processing, the custom cursor, which intro film is fetched
 * and how hard the render loop is allowed to work.
 */

const mq = (query) => window.matchMedia(query)

/** True when the browser can give us a WebGL context at all. */
export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    )
  } catch {
    return false
  }
}

export const prefersReducedMotion = () => mq('(prefers-reduced-motion: reduce)').matches

/** Fine pointer + hover: the only place a custom cursor belongs. */
export const hasFinePointer = () => mq('(hover: hover) and (pointer: fine)').matches

export const isTouch = () => mq('(hover: none)').matches || navigator.maxTouchPoints > 0

export const isMobileViewport = () => window.innerWidth < 768

/**
 * Whether this device should get the smaller cut of the intro film.
 *
 * Deliberately NOT `isMobileViewport()`. That threshold is 768px because it
 * is a layout question, and reusing it here handed the full 1080p file to
 * every tablet and small laptop — devices that gain nothing from the extra
 * pixels and often pay for the bytes. The film is a bandwidth question, so
 * it gets a bandwidth threshold.
 *
 * Data Saver wins outright when the browser reports it: a visitor who has
 * asked for less data has answered this question already, at any width. The
 * same goes for a connection that reports itself as 2g/3g.
 */
export function prefersLightVideo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection

  if (connection) {
    if (connection.saveData) return true
    if (/^(slow-)?2g$/.test(connection.effectiveType || '')) return true
    if (connection.effectiveType === '3g') return true
  }

  return window.innerWidth < 1024
}

/**
 * Three quality tiers drive every performance decision.
 *   high   — desktop, plenty of cores, full particle count + post-processing
 *   medium — tablets and modest laptops
 *   low    — phones and low-core devices: no post, a third of the particles
 */
export function detectTier() {
  if (!supportsWebGL()) return 'none'

  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 4
  const width = Math.max(window.innerWidth, window.innerHeight)
  const coarse = isTouch()

  if (coarse && (width < 900 || cores <= 4 || memory <= 4)) return 'low'
  if (cores <= 4 || memory <= 4 || width < 1280) return 'medium'
  return 'high'
}

/** Particle budget per tier — the brief's 100 / 60 / 30 percent split. */
export const PARTICLE_SCALE = { high: 1, medium: 0.6, low: 0.3, none: 0 }

/** Device pixel ratio, capped so a 3× phone screen does not melt. */
export function cappedDPR(tier = 'high') {
  const max = tier === 'low' ? 1.25 : 1.5
  return Math.min(window.devicePixelRatio || 1, max)
}

/** requestIdleCallback with a setTimeout fallback for Safari. */
export function onIdle(callback, timeout = 2000) {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout })
  }
  return window.setTimeout(callback, 1)
}
