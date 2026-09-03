import * as THREE from 'three'
import { HEX } from '../data/brand.js'

/**
 * WebGL renderer wrapper.
 *
 * Owns the context, the tone mapping and the adaptive quality governor: if
 * the frame budget is consistently blown the pixel ratio steps down rather
 * than letting the whole experience stutter.
 */
export default class Renderer {
  constructor({ canvas, sizes, tier }) {
    this.sizes = sizes
    this.tier = tier
    this.qualityScale = 1
    this._frameTimes = []
    this._lastCheck = 0

    this.instance = new THREE.WebGLRenderer({
      canvas,
      antialias: tier === 'high',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      failIfMajorPerformanceCaveat: false
    })

    this.instance.setClearColor(HEX.void, 1)
    // Every surface in this scene is a custom ShaderMaterial that writes
    // final display-space colour, so neither tone mapping nor an automatic
    // output transform applies. They are left at their neutral settings on
    // purpose — turning ACES on here would silently do nothing.
    this.instance.toneMapping = THREE.NoToneMapping
    this.instance.outputColorSpace = THREE.SRGBColorSpace
    // The render loop clears once per frame and then layers passes by hand.
    this.instance.autoClear = false

    this.resize()
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height, false)
    this.instance.setPixelRatio(this.sizes.pixelRatio * this.qualityScale)
  }

  /**
   * Adaptive quality. Samples frame time over a two-second window and drops
   * resolution one step (never below 60%) when the average is above ~22ms.
   */
  monitor(delta, elapsed) {
    this._frameTimes.push(delta)
    if (elapsed - this._lastCheck < 2) return
    this._lastCheck = elapsed

    const samples = this._frameTimes
    this._frameTimes = []
    if (samples.length < 20) return

    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
    if (average > 0.022 && this.qualityScale > 0.6) {
      this.qualityScale = Math.max(0.6, this.qualityScale - 0.15)
      this.resize()
    } else if (average < 0.014 && this.qualityScale < 1) {
      this.qualityScale = Math.min(1, this.qualityScale + 0.1)
      this.resize()
    }
  }

  /** Pre-compiles materials so the first visible frame never hitches. */
  prewarm(scene, camera) {
    try {
      this.instance.compile(scene, camera)
    } catch (error) {
      console.warn('[renderer] prewarm skipped', error)
    }
  }

  dispose() {
    this.instance.dispose()
    this.instance.forceContextLoss?.()
  }
}
