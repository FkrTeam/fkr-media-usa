import gsap from 'gsap'
import { qs, qsa } from '../utils/dom.js'

/**
 * Fullscreen mobile menu.
 *
 * Opens with a clip-path wipe and staggered line reveals. While open the
 * page behind it is `inert` and the scroll is locked; Escape and a link tap
 * both close it, and focus returns to the trigger.
 */
export default class Menu {
  constructor({ reducedMotion = false } = {}) {
    this.root = qs('[data-menu]')
    this.toggle = qs('[data-menu-toggle]')
    this.label = qs('[data-menu-label]')
    this.links = qsa('[data-menu-link]')
    this.foot = qs('[data-menu-foot]')
    this.site = qs('[data-site]')
    this.reducedMotion = reducedMotion
    this.open = false

    if (!this.root || !this.toggle) return

    this.duration = reducedMotion ? 0.01 : 1
    this._buildTimeline()
    this._bind()
  }

  _buildTimeline() {
    this.tl = gsap.timeline({
      paused: true,
      onStart: () => this.root.classList.add('is-open'),
      onReverseComplete: () => this.root.classList.remove('is-open')
    })

    this.tl
      .fromTo(
        this.root,
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0% 0)', duration: this.duration * 0.72, ease: 'power4.inOut' }
      )
      .fromTo(
        this.links,
        { y: '110%' },
        { y: '0%', duration: this.duration * 0.9, ease: 'power4.out', stagger: 0.06 },
        this.duration * 0.24
      )
      .fromTo(
        this.foot,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: this.duration * 0.6, ease: 'power3.out' },
        '-=0.4'
      )
  }

  _bind() {
    this.toggle.addEventListener('click', () => this.set(!this.open))

    for (const link of this.links) {
      link.addEventListener('click', () => this.set(false))
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.open) {
        this.set(false)
        this.toggle.focus()
      }
    })

    // A resize past the desktop breakpoint must not leave a hidden menu open.
    window.addEventListener('resize', () => {
      if (this.open && window.innerWidth > 1024) this.set(false)
    }, { passive: true })
  }

  set(open) {
    if (open === this.open) return
    this.open = open

    this.toggle.setAttribute('aria-expanded', String(open))
    if (this.label) this.label.textContent = open ? 'Close' : 'Menu'
    document.body.classList.toggle('is-locked', open)

    if (open) {
      this.root.removeAttribute('inert')
      this.site?.setAttribute('inert', '')
      this.tl.timeScale(1).play()
    } else {
      this.root.setAttribute('inert', '')
      this.site?.removeAttribute('inert')
      // Exit runs faster than entry — it should feel like a dismissal.
      this.tl.timeScale(1.6).reverse()
    }
  }
}
