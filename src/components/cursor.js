import gsap from 'gsap'
import { qs } from '../utils/dom.js'
import { hasFinePointer, prefersReducedMotion } from '../utils/device.js'
import { CSS } from '../data/brand.js'

/**
 * Custom cursor — desktop only, and only when the pointer is genuinely fine.
 *
 * A dot that tracks exactly, and a trailing carrier that holds the hover
 * word. There is no drawn ring: interactive elements grow the dot, and
 * anything with `data-cursor-label` sets the word under it instead.
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
    if (!this.root) return

    // Scoped to the cursor, and it has to be: `data-cursor-label` is also
    // how any element on the page ASKS for a word, and the intro's own
    // controls carry it further up the document than this span. An
    // unscoped lookup found the Sound button instead and then wrote the
    // hover word into it, replacing its icon and fading it out.
    this.label = qs('[data-cursor-label]', this.root)

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

  /**
   * Nothing here touches the carrier's own box.
   *
   * It used to be a drawn circle that grew and took a fill on hover; with
   * the circle gone, a background or a border on it would paint a rectangle
   * and a scale would stretch the word. All the feedback lives on the dot
   * and on the label now.
   *
   * The dot GROWS rather than shrinks, which is the opposite of what it did
   * while there was a ring around it to expand instead. Over a labelled
   * element it stays small but never disappears — the visitor still has to
   * be able to aim, and a floating word is not a pointer.
   */
  _expand(label) {
    gsap.to(this.dotInner, {
      scale: label ? 0.6 : 1.9,
      backgroundColor: label ? CSS.brand : CSS.paper,
      duration: 0.35,
      ease: 'power3.out'
    })

    if (this.label) {
      this.label.style.color = CSS.brand
      this.label.textContent = label ?? ''
      gsap.to(this.label, { opacity: label ? 1 : 0, duration: 0.25, ease: 'power2.out' })
    }
  }

  _reset() {
    gsap.to(this.dotInner, {
      scale: 1,
      backgroundColor: CSS.paper,
      duration: 0.4,
      ease: 'power3.out'
    })
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
