import EventEmitter from './EventEmitter.js'

/**
 * The one and only requestAnimationFrame loop.
 *
 * Everything that needs per-frame work subscribes to `tick`. The loop stops
 * entirely when the tab is hidden or when the renderer is parked, so a
 * background tab costs nothing.
 */
export default class Time extends EventEmitter {
  constructor() {
    super()
    this.start = performance.now()
    this.current = this.start
    this.elapsed = 0
    this.delta = 1 / 60
    this.running = false
    this._raf = 0

    this._tick = this._tick.bind(this)
    this._onVisibility = this._onVisibility.bind(this)
    document.addEventListener('visibilitychange', this._onVisibility)
  }

  play() {
    if (this.running || document.visibilityState === 'hidden') return
    this.running = true
    this.current = performance.now()
    this._raf = requestAnimationFrame(this._tick)
  }

  pause() {
    this.running = false
    cancelAnimationFrame(this._raf)
  }

  _tick(now) {
    if (!this.running) return
    // Clamp so a stalled frame cannot teleport the animation state.
    this.delta = Math.min((now - this.current) / 1000, 1 / 20)
    this.current = now
    this.elapsed = (now - this.start) / 1000

    this.emit('tick', this.delta, this.elapsed)
    this._raf = requestAnimationFrame(this._tick)
  }

  _onVisibility() {
    if (document.visibilityState === 'hidden') this.pause()
    else this.play()
  }

  destroy() {
    this.pause()
    document.removeEventListener('visibilitychange', this._onVisibility)
    super.destroy()
  }
}
