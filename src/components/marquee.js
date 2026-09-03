import gsap from 'gsap'
import { qsa } from '../utils/dom.js'
import { prefersReducedMotion } from '../utils/device.js'

/**
 * Logo filmstrip.
 *
 * Deliberately slow. The duration is derived from the track width, not fixed,
 * so the marks always drift at the same ~42px/s no matter how many clients
 * are on the roster — adding one lengthens the lap instead of speeding
 * everything up. It eases almost to a stop when the pointer is over it, so a
 * visitor can actually read a client's name. With reduced motion it does not
 * move at all; the roster stays completely legible, just static.
 *
 * The track holds two identical groups, so the loop has no seam.
 */
export default class Marquee {
  constructor(selector = '[data-marquee]') {
    this.tweens = []
    this._cleanups = []

    if (prefersReducedMotion()) return

    for (const marquee of qsa(selector)) {
      const track = marquee.querySelector('.marquee__track')
      const group = marquee.querySelector('.marquee__group')
      if (!track || !group) continue

      const distance = group.offsetWidth
      if (distance < 10) continue

      const direction = Number(marquee.dataset.marquee) || 1
      if (direction < 0) gsap.set(track, { x: -distance })

      const tween = gsap.to(track, {
        x: direction > 0 ? -distance : 0,
        duration: Math.max(26, distance / 42),
        ease: 'none',
        repeat: -1
      })

      this.tweens.push(tween)
      this._on(marquee, 'pointerenter', () => gsap.to(tween, { timeScale: 0.12, duration: 0.6 }))
      this._on(marquee, 'pointerleave', () => gsap.to(tween, { timeScale: 1, duration: 0.6 }))
    }
  }

  _on(target, type, handler) {
    target.addEventListener(type, handler)
    this._cleanups.push(() => target.removeEventListener(type, handler))
  }

  destroy() {
    for (const off of this._cleanups ?? []) off()
    this._cleanups = []
    for (const tween of this.tweens) tween.kill()
    this.tweens = []
  }
}
