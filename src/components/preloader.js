import gsap from 'gsap'
import { qs } from '../utils/dom.js'

/**
 * Preloader.
 *
 * Progress is driven by real resource completion, not a timer — the number
 * only moves when something actually finished. It eases toward the target so
 * a burst of fast loads still reads as motion rather than a jump.
 */
export default class Preloader {
  constructor({ reducedMotion = false } = {}) {
    this.root = qs('[data-preloader]')
    this.mark = qs('[data-preloader-mark]')
    this.fill = qs('[data-preloader-fill]')
    this.pct = qs('[data-preloader-pct]')
    this.stage = qs('[data-preloader-stage]')
    this.reducedMotion = reducedMotion

    this.value = 0
    this.display = { value: 0 }
    if (!this.root) return

    gsap.set(this.mark, { opacity: 0, y: 12 })
    gsap.to(this.mark, {
      opacity: 1,
      y: 0,
      duration: reducedMotion ? 0.01 : 1.1,
      ease: 'power3.out',
      delay: 0.15
    })
  }

  /** @param {number} value 0–1 */
  set(value) {
    if (!this.root) return
    this.value = Math.max(this.value, Math.min(value, 1))

    gsap.to(this.display, {
      value: this.value,
      duration: this.reducedMotion ? 0.01 : 0.8,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => {
        const v = this.display.value
        if (this.fill) this.fill.style.transform = `scaleX(${v})`
        if (this.pct) this.pct.textContent = `${Math.round(v * 100)}%`
      }
    })
  }

  label(text) {
    if (this.stage) this.stage.textContent = text
  }

  /** Fades out and removes itself from the accessibility tree. */
  hide() {
    if (!this.root) return Promise.resolve()

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.root.remove()
          resolve()
        }
      })

      const d = this.reducedMotion ? 0.01 : 1

      tl.to(this.display, {
        value: 1,
        duration: d * 0.4,
        ease: 'power2.inOut',
        onUpdate: () => {
          if (this.fill) this.fill.style.transform = `scaleX(${this.display.value})`
          if (this.pct) this.pct.textContent = `${Math.round(this.display.value * 100)}%`
        }
      })
        .to([this.mark, this.pct, this.stage], {
          opacity: 0,
          y: -10,
          duration: d * 0.5,
          ease: 'power2.in',
          stagger: 0.04
        }, '+=0.15')
        .to(this.fill, { scaleY: 0, transformOrigin: 'center', duration: d * 0.4, ease: 'power2.in' }, '<')
        .to(this.root, { opacity: 0, duration: d * 0.6, ease: 'power2.inOut' }, '-=0.2')
    })
  }
}
