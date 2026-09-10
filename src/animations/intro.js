import gsap from 'gsap'
import { qs } from '../utils/dom.js'
import { timecode, clamp } from '../utils/math.js'
import { revealLines, EASE } from './transitions.js'
import { siteData } from '../data/site.js'

const SESSION_KEY = 'fkr:introViewed'

/** The visitor's sound choice, kept across visits — see Intro.soundOff. */
const SOUND_KEY = 'fkr:introSound'
const SKIP_DELAY = 2.5      // seconds before the skip control appears
const PREWARM_LEAD = 5      // seconds before the end that the hero warms up
const VIDEO_TIMEOUT = 9000  // give up waiting for the film after this
const ARM_TIMEOUT = 15000   // how long the film waits for that tap before moving on

/**
 * The opening.
 *
 * Preloader → film → hero, as one continuous move. The film is never
 * treated as required: if it fails, is blocked by autoplay policy, or the
 * visitor has already seen it this session, the same handoff runs from a
 * generated title sequence or straight from the preloader.
 */
export default class Intro {
  constructor({ experience, reducedMotion = false, onPrewarm = () => {} }) {
    this.experience = experience
    this.film = siteData.intro
    this.reducedMotion = reducedMotion
    this.onPrewarm = onPrewarm

    this.root = qs('[data-intro]')
    this.video = qs('[data-intro-video]')
    this.skipBtn = qs('[data-intro-skip]')
    this.soundBtn = qs('[data-intro-sound]')
    this.startBtn = qs('[data-intro-start]')
    this.soundLabel = qs('[data-intro-sound-label]')
    this.timer = qs('[data-intro-timer]')
    this.progress = qs('[data-intro-progress]')
    this.fallbackLine = qs('[data-intro-fallback-line]')

    this.finished = false
    this._prewarmed = false
    this._resolve = null
  }

  static get seen() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === 'true'
    } catch {
      return false
    }
  }

  /**
   * The visitor's own choice, remembered across visits.
   *
   * Stored rather than assumed because muting a brand film is a deliberate
   * act — someone who turned it off last time did not mean "just this once".
   * Absent any stored choice we try sound ON, which is what FKR asked for.
   */
  static get soundOff() {
    try {
      return localStorage.getItem(SOUND_KEY) === 'off'
    } catch {
      return false
    }
  }

  static rememberSound(muted) {
    try {
      localStorage.setItem(SOUND_KEY, muted ? 'off' : 'on')
    } catch {
      /* private mode — the preference simply does not persist */
    }
  }

  static markSeen() {
    try {
      sessionStorage.setItem(SESSION_KEY, 'true')
    } catch {
      /* private mode — the film simply plays again */
    }
  }

  /** Runs the opening. Resolves once the site is interactive. */
  play({ skipFilm = false } = {}) {
    return new Promise((resolve) => {
      this._resolve = resolve

      if (skipFilm || this.reducedMotion || !this.video) {
        this.onPrewarm()
        this._handoff({ immediate: true })
        return
      }

      this.root?.removeAttribute('hidden')
      gsap.to(this.root, { opacity: 1, duration: 0.6, ease: 'power2.out' })

      this._bind()
      this._startFilm()
    })
  }

  _bind() {
    this.skipBtn?.addEventListener('click', () => this._skip())
    this.soundBtn?.addEventListener('click', () => this._toggleSound())

    this._onKey = (event) => {
      if (event.key === 'Escape' && !this.finished) this._skip()
    }
    document.addEventListener('keydown', this._onKey)

    gsap.delayedCall(SKIP_DELAY, () => {
      if (!this.finished) this.skipBtn?.classList.add('is-visible')
    })
  }

  async _startFilm() {
    const video = this.video

    // Nothing about the film may block the experience: if it has not
    // reported itself playable in time, drop to the H.264 cut, and failing
    // that to the title sequence.
    const failsafe = setTimeout(() => {
      if (!this._playing) this._recover('timeout')
    }, VIDEO_TIMEOUT)
    this._failsafe = failsafe

    // Bound once: _recover() calls straight back into here with the MP4.
    if (!this._bound) {
      this._bound = true
      video.addEventListener('timeupdate', () => this._onTime(), { passive: true })
      video.addEventListener('ended', () => this._skip(), { once: true })
      video.addEventListener('error', () => this._recover('error'))
    }

    video.load()

    // Sound on by default, but every current browser refuses to autoplay
    // audible media until the visitor has interacted with the page. So the
    // film asks for sound first and accepts muted as the price of playing at
    // all — a silent film is a far smaller loss than no film. When that
    // happens the control is flagged so the visitor can see there is sound
    // to turn on, which is the interaction the browser was waiting for.
    video.muted = Intro.soundOff
    video.volume = 1

    let blocked = false

    try {
      await video.play()
    } catch (first) {
      this._playError = first
      if (!video.muted) {
        blocked = true
        video.muted = true
        try {
          await video.play()
        } catch (error) {
          console.warn('[intro] autoplay blocked or source unplayable', error)
          this._playError = error
          clearTimeout(failsafe)
          this._recover('play')
          return
        }
      } else {
        clearTimeout(failsafe)
        this._recover('play')
        return
      }
    }

    this._playing = true
    clearTimeout(failsafe)
    video.classList.add('is-playing')

    this._syncSound()
    if (blocked) this.soundBtn?.classList.add('is-blocked')
  }

  /**
   * Flips the film's audio and remembers the choice.
   *
   * The click itself is the user gesture browsers require, so unmuting from
   * here always succeeds even when the initial autoplay attempt was refused.
   */
  _toggleSound() {
    const video = this.video
    if (!video) return

    video.muted = !video.muted
    if (!video.muted) video.volume = 1

    Intro.rememberSound(video.muted)
    this.soundBtn?.classList.remove('is-blocked')
    this._syncSound()
  }

  /** Keeps the control's icon, label and assistive state on the same truth. */
  _syncSound() {
    const muted = !!this.video?.muted
    if (!this.soundBtn) return

    this.soundBtn.classList.toggle('is-muted', muted)
    this.soundBtn.setAttribute('aria-pressed', muted ? 'true' : 'false')
    this.soundBtn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off')
    if (this.soundLabel) this.soundLabel.textContent = muted ? 'Sound off' : 'Sound on'
  }

  _onTime() {
    const video = this.video
    const duration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : this.film.duration

    const t = video.currentTime
    const ratio = clamp(t / duration)

    if (this.progress) this.progress.style.width = `${ratio * 100}%`
    if (this.timer) this.timer.textContent = `${timecode(t)} / ${timecode(duration)}`

    // Warm the hero while the last seconds of film are still on screen, so
    // the handoff never pays a shader-compile cost.
    if (!this._prewarmed && duration - t <= PREWARM_LEAD) {
      this._prewarmed = true
      this.onPrewarm()
    }
  }

  /**
   * One retry on H.264 before the film is given up on.
   *
   * Source selection is a one-way door: once a browser has committed to a
   * <source> it will not walk back to the next one, and a decode that fails
   * or a stream that stalls AFTER that point ends the element for good. That
   * is exactly what Safari does with the VP9/Opus WebM listed first — it
   * answers canPlayType for WebM, takes it, and then fails, so the visitor
   * gets the title sequence on a Mac while every other browser gets the film.
   *
   * So when the film dies for any reason, the MP4 that was sitting unused in
   * the source list is tried once, on its own, as a plain src. Only if that
   * also fails does the title sequence run.
   */
  _recover(reason) {
    const video = this.video
    if (this.finished || this._fallbackRunning || this._playing) return
    if (!video) return this._runFallback()

    // A refusal is not a broken file. Safari in Low Power Mode declines every
    // autoplay, muted included, and asking again on the other source only
    // gets declined again — so hand the decision to the visitor instead of
    // spending the H.264 retry on a question that was never about codecs.
    if (this._playError?.name === 'NotAllowedError') return this._arm()

    if (this._recovering) return this._runFallback()

    const mp4 = Array.from(video.querySelectorAll('source'))
      .find((source) => (source.type || '').startsWith('video/mp4'))

    if (!mp4?.src) return this._runFallback()

    console.warn(`[intro] film ${reason}; retrying on H.264`)
    this._recovering = true
    clearTimeout(this._failsafe)

    video.querySelectorAll('source').forEach((source) => source.remove())
    video.src = mp4.src
    this._startFilm()
  }

  /**
   * Waits, behind the poster frame, for the tap the browser is holding out for.
   *
   * A MacBook in Low Power Mode is the case this exists for: Safari there
   * refuses to start ANY film on its own — muted, `playsinline`, however
   * small — and there is no attribute, encoding or API that opens that gate.
   * Only a real user gesture does. Until this existed the refusal was read as
   * "no film", and every Low Power visitor got the title sequence instead of
   * the thing FKR paid to have made.
   *
   * So the film is shown stopped on its own first frame with one control over
   * it, and play() is called from inside the click — where the gesture is
   * still live and the browser allows it. Twelve seconds without an answer
   * and the title sequence runs after all: a visitor who is not going to tap
   * must not be left holding a still frame.
   */
  _arm() {
    const video = this.video
    if (this.finished || this._fallbackRunning || this._armed) return this._runFallback()
    if (!this.startBtn || !video) return this._runFallback()

    this._armed = true
    clearTimeout(this._failsafe)
    console.info('[intro] autoplay refused — waiting for the visitor to start the film')

    // The poster is already on the element; showing it is the whole point.
    video.classList.add('is-armed')
    this.startBtn.hidden = false

    // Reading offsetWidth flushes the display change, so the browser has a
    // `display: grid` at opacity 0 to transition FROM. Without it the class
    // lands in the same frame as the unhide and the fade never runs — and a
    // timer would be worse: this control has to appear whether or not the
    // page is being painted.
    void this.startBtn.offsetWidth
    this.startBtn.classList.add('is-visible')

    this._giveUp = setTimeout(() => {
      this._disarm()
      this._runFallback()
    }, ARM_TIMEOUT)

    const start = async () => {
      if (this.finished || this._fallbackRunning) return
      this._disarm()

      // Called from inside the gesture, which is the only reason it works.
      video.muted = Intro.soundOff
      video.volume = 1

      let blocked = false
      try {
        await video.play()
      } catch {
        blocked = true
        video.muted = true
        try {
          await video.play()
        } catch (error) {
          console.warn('[intro] the film was refused even on a gesture', error)
          this._runFallback()
          return
        }
      }

      this._playing = true
      video.classList.add('is-playing')
      this._syncSound()
      if (blocked) this.soundBtn?.classList.add('is-blocked')
    }

    this._startHandler = start
    this.startBtn.addEventListener('click', start)
  }

  /** Takes the start control away again, whichever way the wait ended. */
  _disarm() {
    clearTimeout(this._giveUp)
    this.video?.classList.remove('is-armed')
    if (!this.startBtn) return

    // Removed, not just hidden: after the wait has ended one way or another
    // this control must be inert, or a late click restarts a film the
    // visitor has already been moved past.
    if (this._startHandler) {
      this.startBtn.removeEventListener('click', this._startHandler)
      this._startHandler = null
    }
    this.startBtn.classList.remove('is-visible')
    this.startBtn.hidden = true
  }

  /** Generated title sequence — the film's stand-in, not a dead end. */
  _runFallback() {
    if (this.finished || this._fallbackRunning) return
    this._fallbackRunning = true
    this._playing = true

    this._disarm()
    this.root?.classList.add('is-fallback')
    this.video?.classList.remove('is-playing')
    this.onPrewarm()

    const lines = this.film.fallbackLines
    const tl = gsap.timeline({ onComplete: () => this._skip() })

    lines.forEach((line, i) => {
      tl.call(() => {
        if (this.fallbackLine) this.fallbackLine.textContent = line
      })
        .fromTo(
          this.fallbackLine,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 1.1, ease: EASE.cinematic }
        )
        .to(this.fallbackLine, { opacity: 0, y: -18, duration: 0.7, ease: 'power2.in' }, '+=1.5')

      if (this.timer) {
        tl.call(() => {
          const step = (i + 1) / lines.length
          if (this.progress) this.progress.style.width = `${step * 100}%`
          this.timer.textContent = 'Title sequence'
        }, null, '<')
      }
    })
  }

  _skip() {
    if (this.finished) return
    this._handoff({ immediate: false })
  }

  /**
   * The handoff. Film out, WebGL in, hero up — overlapping, never a cut.
   */
  _handoff({ immediate }) {
    if (this.finished) return
    this.finished = true

    Intro.markSeen()
    document.removeEventListener('keydown', this._onKey ?? (() => {}))
    this.skipBtn?.classList.remove('is-visible')
    this._disarm()

    const { experience } = this
    const d = this.reducedMotion ? 0.01 : 1
    const field = experience?.world.field

    try {
      this.video?.pause()
    } catch {
      /* ignore */
    }

    const tl = gsap.timeline({
      defaults: { ease: EASE.cinematic },
      onComplete: () => {
        this.root?.setAttribute('hidden', '')
        document.body.classList.remove('is-locked')
        this._resolve?.()
      }
    })

    // 1 · The WebGL world rises behind the film before the film leaves.
    if (experience) {
      // `intensity` is an accessor on Experience — tweening it fades the
      // canvas and lifts every shader's master opacity in one move.
      tl.to(experience, {
        intensity: 1,
        duration: d * (immediate ? 1.2 : 2.0),
        ease: 'power2.inOut'
      }, 0)
    }

    if (field) {
      tl.fromTo(field, { reveal: 0 }, { reveal: 1, duration: d * 2.6, ease: 'power2.out' }, 0)
    }

    // 2 · Film fades and lifts away.
    if (!immediate) {
      tl.to(this.root, { opacity: 0, duration: d * 1.4, ease: 'power2.inOut' }, 0.25)
        .to(this.video, { scale: 1.06, duration: d * 1.8, ease: 'power2.inOut' }, 0.25)
    } else {
      tl.set(this.root, { opacity: 0 }, 0)
    }

    // 3 · Site, navigation and hero typography arrive.
    tl.to('[data-site]', { opacity: 1, duration: d * 0.9, ease: 'power2.out' }, immediate ? 0.1 : 0.9)
      .to('[data-nav]', { y: 0, duration: d * 1.1 }, immediate ? 0.35 : 1.2)

    const heroLines = document.querySelectorAll('.hero__title .line-inner')
    if (heroLines.length && !this.reducedMotion) {
      gsap.set(heroLines, { yPercent: 108 })
      tl.add(revealLines(heroLines, { duration: d * 1.35, stagger: 0.1 }), immediate ? 0.3 : 1.1)
    }

    // Not every route's hero carries a standfirst or a scroll cue.
    const heroFoot = document.querySelectorAll('.hero__intro, .hero__scroll')
    if (heroFoot.length) tl.to(heroFoot, {
      opacity: 1,
      y: 0,
      duration: d * 1,
      stagger: 0.1
    }, immediate ? 0.7 : 1.7)

    const scrollLine = document.querySelector('[data-hero-scroll-line]')
    if (scrollLine) tl.fromTo(scrollLine, { scaleX: 0 }, { scaleX: 1, duration: d * 1.2 }, '<')
  }
}
