import EventEmitter from './EventEmitter.js'
import { cappedDPR } from '../utils/device.js'

/**
 * Single source of truth for viewport dimensions and pixel ratio.
 *
 * Resize is debounced to one frame so a drag-resize never triggers dozens
 * of renderer reallocations, and mobile URL-bar height changes (which fire
 * resize constantly while scrolling) are ignored unless the width moved or
 * the height changed meaningfully.
 */
export default class Sizes extends EventEmitter {
  constructor(tier = 'high') {
    super()
    this.tier = tier
    this._frame = 0

    this.measure()
    this._onResize = this._onResize.bind(this)
    window.addEventListener('resize', this._onResize, { passive: true })
    window.addEventListener('orientationchange', this._onResize, { passive: true })
  }

  measure() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.aspect = this.width / this.height
    this.pixelRatio = cappedDPR(this.tier)
    // Real viewport unit for mobile browsers whose 100vh lies.
    document.documentElement.style.setProperty('--vh', `${this.height * 0.01}px`)
  }

  _onResize() {
    cancelAnimationFrame(this._frame)
    this._frame = requestAnimationFrame(() => {
      const prevWidth = this.width
      const prevHeight = this.height
      this.measure()

      const widthChanged = prevWidth !== this.width
      const heightJump = Math.abs(prevHeight - this.height) > 120
      if (!widthChanged && !heightJump) return

      this.emit('resize', this)
    })
  }

  destroy() {
    cancelAnimationFrame(this._frame)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('orientationchange', this._onResize)
    super.destroy()
  }
}
