import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

import { qs, qsa } from '../utils/dom.js'
import {
  supportsWebGL,
  detectTier,
  prefersReducedMotion,
  isMobileViewport,
  onIdle
} from '../utils/device.js'

import Experience from './Experience.js'
import Router from './Router.js'
import { renderIntroSources } from '../components/render.js'
import Preloader from '../components/preloader.js'
import Cursor from '../components/cursor.js'
import Menu from '../components/menu.js'
import { initNavigation } from '../animations/navigation.js'
import { mountPage, unmountPage } from '../animations/page.js'
import { resetScroll, scrollToHash } from '../animations/scroll.js'
import Intro from '../animations/intro.js'

/**
 * Application orchestrator.
 *
 * Owns the boot sequence and the split between what is built once and what
 * is rebuilt per route.
 *
 *   SHELL (once per session)   renderer, render loop, cursor, navigation,
 *                              menu, footer, router, intro film
 *   PAGE  (per route)          content, splits, ScrollTriggers, components
 *
 * Staged loading:
 *   Stage 0  fonts, logo, navigation, critical CSS   blocks the preloader
 *   Stage 1  intro film + hero shaders (pre-compiled) blocks the film
 *   Stage 2  the current route's own media            on scroll approach
 *   Stage 3  the other routes' documents              on idle / on intent
 */
export default class App {
  constructor() {
    this.reducedMotion = prefersReducedMotion()
    this.mobile = isMobileViewport()
    this.tier = supportsWebGL() ? detectTier() : 'none'
    this.canvas = qs('[data-canvas]')

    // Registered once, here, before any module reaches for it.
    gsap.registerPlugin(ScrollTrigger)
    gsap.defaults({ ease: 'power3.out' })
  }

  async boot() {
    document.body.classList.add('is-locked')

    // 1 · Shell systems that do not depend on WebGL.
    // Take scroll restoration off the browser before anything else runs: a
    // reload would otherwise land halfway down a page hidden behind the
    // intro film. resetScroll() is what makes it stick — see its comment.
    if (!location.hash) resetScroll()

    renderIntroSources({ mobile: this.mobile })

    this.preloader = new Preloader({ reducedMotion: this.reducedMotion })
    this.preloader.label('Fonts')

    this.cursor = new Cursor()
    this.menu = new Menu({ reducedMotion: this.reducedMotion })

    // 2 · The WebGL world, if this device can have one.
    this._initExperience()

    // 3 · Routing. The router owns navigation; the page module owns content.
    this.router = new Router({
      onLeave: () => unmountPage({ experience: this.experience }),
      onEnter: () => {
        mountPage({ experience: this.experience, reducedMotion: this.reducedMotion })
        this.router.markActive()
        ScrollTrigger.refresh()

        // refresh() restores ScrollTrigger's remembered scroll position, so
        // the reset has to happen AFTER it, not only before the swap.
        if (!location.hash) resetScroll()
      }
    })
    this.router.init()

    initNavigation({ router: this.router })

    // Exposed for debugging alongside `window.__fkr`; nothing reads it.
    this.debug = { ScrollTrigger, gsap }

    // 4 · Staged loading, then the first page.
    await this._stage0()
    await this._stage1()

    mountPage({ experience: this.experience, reducedMotion: this.reducedMotion })

    await this.preloader.hide()

    // 5 · The opening. Only ever on the first entry of a session.
    const intro = new Intro({
      experience: this.experience,
      reducedMotion: this.reducedMotion,
      onPrewarm: () => this._prewarm()
    })

    const forceSkip = new URLSearchParams(location.search).get('intro') === 'skip'
    const skipFilm = forceSkip || Intro.seen || this.reducedMotion || this.tier === 'none'

    // The film runs over a full-height document, and anything that moved the
    // page while it played (a restored position, a stray anchor, a keypress)
    // would be revealed as a mid-page landing. Start the site at the top.
    if (!location.hash) resetScroll()

    await intro.play({ skipFilm })

    // A deep link resolves only now. The browser tried and failed while the
    // document was still parsing, because the section it points at is built
    // from data during mount — so the jump belongs here, after the film has
    // handed the page over and the layout is settled.
    if (location.hash) scrollToHash(location.hash, { smooth: false })

    // 6 · Warm the other routes once the visitor is already reading.
    onIdle(() => this._prefetchRoutes())
  }

  _initExperience() {
    if (this.tier === 'none' || !this.canvas) {
      document.documentElement.classList.add('no-webgl')
      console.info('[fkr] WebGL unavailable — running the static visual fallback')
      this._startCursorLoop()
      return
    }

    try {
      this.experience = new Experience({
        canvas: this.canvas,
        tier: this.tier,
        reducedMotion: this.reducedMotion
      })

      // The cursor rides the same loop as everything else.
      this.experience.time.on('tick', (delta) => this.cursor?.update(delta))

      // A lost context must not take the page with it.
      this.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault()
        document.documentElement.classList.add('no-webgl')
        console.warn('[fkr] WebGL context lost — falling back to the static stage')
      })
    } catch (error) {
      console.warn('[fkr] WebGL init failed', error)
      document.documentElement.classList.add('no-webgl')
      this.experience = null
      this._startCursorLoop()
    }
  }

  /**
   * Without an Experience there is no render loop, so the cursor needs its
   * own — the only place in the app with a second requestAnimationFrame.
   */
  _startCursorLoop() {
    if (!this.cursor?.enabled) return

    let last = performance.now()
    const frame = (now) => {
      const delta = Math.min((now - last) / 1000, 1 / 20)
      last = now
      this.cursor.update(delta)
      if (document.visibilityState !== 'hidden') requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        last = performance.now()
        requestAnimationFrame(frame)
      }
    })
  }

  /** Stage 0 — fonts and the critical shell. */
  async _stage0() {
    this.preloader.set(0.12)

    const fonts = document.fonts?.ready ?? Promise.resolve()
    // Never let a slow font server hold the door shut.
    await Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 3500))])

    this.preloader.set(0.4)
    this.preloader.label('Experience')
  }

  /** Stage 1 — the film's first bytes and the hero shaders. */
  async _stage1() {
    if (!this.experience) {
      this.preloader.set(1)
      return
    }

    // Compiling now means the handoff later is free.
    this._prewarm()
    this.preloader.set(0.72)
    this.preloader.label('Signal field')

    const skipFilm =
      new URLSearchParams(location.search).get('intro') === 'skip' ||
      Intro.seen ||
      this.reducedMotion

    const video = qs('[data-intro-video]')
    if (video && !skipFilm) {
      video.preload = 'auto'
      await new Promise((resolve) => {
        const done = () => resolve()
        video.addEventListener('loadedmetadata', done, { once: true })
        video.addEventListener('error', done, { once: true })
        setTimeout(done, 4000)
        video.load()
      })
    }

    this.preloader.set(0.94)
    this.preloader.label('Ready')
  }

  /**
   * Stage 3 — pull the other route documents into the router's cache while
   * the visitor is reading. They are HTML only; each route's own media is
   * still fetched by that route, on approach.
   */
  _prefetchRoutes() {
    // Read the links the document actually carries, so the deploy base is
    // never hardcoded in two places.
    for (const link of qsa('a[data-route-link]')) {
      this.router?.prefetch(link.getAttribute('href'))
    }
  }

  _prewarm() {
    if (this._warmed || !this.experience) return
    this._warmed = true
    this.experience.prewarm()
  }
}
