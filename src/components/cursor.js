import gsap from 'gsap'
import { qs } from '../utils/dom.js'
import { hasFinePointer, prefersReducedMotion } from '../utils/device.js'
import { CSS } from '../data/brand.js'

/**
 * Custom cursor — desktop only, and only when the pointer is genuinely fine.
 *
 * A dot that tracks exactly and a ring that trails. Interactive elements
 * expand the ring; anything with `data-cursor-label` fills it with a word.
 * Touch devices never see it and never pay for it.
 */
export default class Cursor {
  constructor() {
    this.enabled = hasFinePointer() && !prefersReducedMotion()
    if (!this.enabled) return

    this.root = qs('[data-cursor]')
    this.dot = qs('[data-cursor-dot]')
    this.ring = qs('[data-cursor-ring]')
    this.dotInner = qs('[data-cursor-dot-inner]')
    this.ringInner = qs('[data-cursor-ring-inner]')
    this.label = qs('[data-cursor-label]')
    if (!this.root) return

    document.documentElement.classList.add('has-cursor')

    // Parked off-screen until the pointer moves, so it never appears
    // stranded mid-page on load or on a hybrid touch/mouse device.
    this.pos = { x: -200, y: -200 }
    this.ringPos = { ...this.pos }
    this.awake = false
    gsap.set(this.root, { opacity: 0 })

    this.setDot = gsap.quickSetter(this.dot, 'css')
    this.setRing = gsap.quickSetter(this.ring, 'css')

    this._bind()
  }

  _bind() {
    window.addEventListener('pointermove', (event) => {
      this.pos.x = event.clientX
      this.pos.y = event.clientY
      if (!this.awake) {
        this.awake = true
        this.ringPos = { ...this.pos }
        gsap.to(this.root, { opacity: 1, duration: 0.4, ease: 'power2.out' })
      }
    }, { passive: true })

    document.addEventListener('pointerover', (event) => {
      const target = event.target.closest?.(
        'a, button, [data-cursor-label], input, textarea, select, summary'
      )
      if (!target) return this._reset()

      const label = target.getAttribute('data-cursor-label')
      this._expand(label)
    })

    document.addEventListener('pointerout', (event) => {
      if (!event.relatedTarget) this._reset()
    })

    // A toggle (the intro's sound control) rewrites its label on click, and
    // the pointer is still resting on it — pick the new word up right away.
    document.addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-cursor-label]')
      if (target) this._expand(target.getAttribute('data-cursor-label'))
    })

    // The cursor must never linger over a page the visitor has left.
    document.addEventListener('pointerleave', () => gsap.to(this.root, { opacity: 0, duration: 0.2 }))
    document.addEventListener('pointerenter', () => gsap.to(this.root, { opacity: 1, duration: 0.2 }))
  }

  _expand(label) {
    gsap.to(this.ringInner, {
      scale: label ? 1.75 : 1.4,
      backgroundColor: label ? CSS.brandSoft : CSS.neutralSoft,
      borderColor: label ? CSS.brand : CSS.brandBorder,
      duration: 0.4,
      ease: 'power3.out'
    })
    gsap.to(this.dotInner, { scale: label ? 0 : 0.5, duration: 0.3, ease: 'power3.out' })

    if (this.label) {
      this.label.style.color = label ? CSS.brand : CSS.paper
      this.label.textContent = label ?? ''
      gsap.to(this.label, { opacity: label ? 1 : 0, duration: 0.25, ease: 'power2.out' })
    }
  }

  _reset() {
    gsap.to(this.ringInner, {
      scale: 1,
      backgroundColor: CSS.transparent,
      borderColor: CSS.neutralBorder,
      duration: 0.45,
      ease: 'power3.out'
    })
    gsap.to(this.dotInner, { scale: 1, duration: 0.3, ease: 'power3.out' })
    if (this.label) gsap.to(this.label, { opacity: 0, duration: 0.2 })
  }

  /** Called from the shared render loop — no rAF of its own. */
  update(delta) {
    if (!this.enabled || !this.root) return

    const ease = 1 - Math.pow(0.0005, delta)
    this.ringPos.x += (this.pos.x - this.ringPos.x) * ease
    this.ringPos.y += (this.pos.y - this.ringPos.y) * ease

    this.setDot({ transform: `translate3d(${this.pos.x}px, ${this.pos.y}px, 0)` })
    this.setRing({ transform: `translate3d(${this.ringPos.x}px, ${this.ringPos.y}px, 0)` })
  }
}
