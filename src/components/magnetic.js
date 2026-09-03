import gsap from 'gsap'
import { qsa } from '../utils/dom.js'
import { hasFinePointer, prefersReducedMotion } from '../utils/device.js'

/**
 * Magnetic buttons.
 *
 * The element leans toward the pointer inside a small radius and snaps back
 * on leave. Desktop-only: on touch it would fight the tap, and with reduced
 * motion it is skipped entirely.
 */
export function initMagnetic(selector = '[data-magnetic]', strength = 0.32) {
  if (!hasFinePointer() || prefersReducedMotion()) return () => {}

  const cleanups = qsa(selector).map((element) => {
    const setX = gsap.quickTo(element, 'x', { duration: 0.6, ease: 'power3.out' })
    const setY = gsap.quickTo(element, 'y', { duration: 0.6, ease: 'power3.out' })

    const onMove = (event) => {
      const rect = element.getBoundingClientRect()
      setX((event.clientX - (rect.left + rect.width / 2)) * strength)
      setY((event.clientY - (rect.top + rect.height / 2)) * strength)
    }

    const onLeave = () => {
      setX(0)
      setY(0)
    }

    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', onLeave)
    element.addEventListener('blur', onLeave)

    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      element.removeEventListener('blur', onLeave)
      gsap.set(element, { x: 0, y: 0 })
    }
  })

  return () => cleanups.forEach((fn) => fn())
}
