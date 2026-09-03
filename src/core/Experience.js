import * as THREE from 'three'
import Sizes from './Sizes.js'
import Time from './Time.js'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import Resources from './Resources.js'
import World from '../webgl/World.js'
import PostProcessing from '../webgl/PostProcessing.js'
import { damp, clamp } from '../utils/math.js'

/**
 * The persistent WebGL experience.
 *
 * One context, one render loop, one camera — created once and kept alive for
 * the whole session. UI code never touches Three.js directly; it moves the
 * values on `state` and this class does the rest.
 */
export default class Experience {
  constructor({ canvas, tier = 'high', reducedMotion = false }) {
    this.canvas = canvas
    this.tier = tier
    this.reducedMotion = reducedMotion

    this.sizes = new Sizes(tier)
    this.time = new Time()
    this.renderer = new Renderer({ canvas, sizes: this.sizes, tier })
    this.resources = new Resources(this.renderer.instance)
    this.camera = new Camera({ sizes: this.sizes, reducedMotion })
    this.world = new World({ sizes: this.sizes, tier, reducedMotion })

    this.post = new PostProcessing({
      renderer: this.renderer.instance,
      sizes: this.sizes,
      enabled: tier === 'high' && !reducedMotion
    })

    /** Everything the UI is allowed to influence. */
    this.state = {
      elapsed: 0,
      scroll: 0,
      pointer: new THREE.Vector2(),
      intensity: 0,
      accent: 0
    }

    this._scrollTarget = 0
    this._pointerTarget = new THREE.Vector2()
    this._accentTarget = 0
    this._ambient = 0
    this._mediaStage = null

    this._bind()
    this.time.play()
  }

  _bind() {
    this.sizes.on('resize', () => {
      this.renderer.resize()
      this.camera.resize()
      this.world.resize()
      this.post.resize()
    })

    this.time.on('tick', (delta, elapsed) => this._render(delta, elapsed))

    this._onPointerMove = (event) => {
      this._pointerTarget.set(
        (event.clientX / this.sizes.width) * 2 - 1,
        (event.clientY / this.sizes.height) * 2 - 1
      )
    }
    window.addEventListener('pointermove', this._onPointerMove, { passive: true })

    this._onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      this._scrollTarget = max > 0 ? clamp(window.scrollY / max) : 0
    }
    window.addEventListener('scroll', this._onScroll, { passive: true })
    this._onScroll()
  }

  /** The DOM element the media plane should track on this route. */
  setMediaStage(element) {
    this._mediaStage = element
    if (!element) this.world.mediaPlane.opacity = 0
  }

  /** 0 → 1 master visibility of the whole WebGL layer. */
  set intensity(value) {
    this.state.intensity = value
    this.canvas.style.opacity = String(clamp(value))
  }

  get intensity() {
    return this.state.intensity
  }

  /**
   * Momentary accent lift — hover, transitions. Decays back to the ambient
   * floor rather than to zero.
   */
  set accent(value) {
    this._accentTarget = value
  }

  /**
   * The section's resting energy. Scroll sets this as the page moves from
   * one section to the next; the momentary accent rides on top of it.
   */
  set ambient(value) {
    this._ambient = value
  }

  get ambient() {
    return this._ambient
  }

  _render(delta, elapsed) {
    const { state } = this

    state.elapsed = elapsed
    state.scroll = damp(state.scroll, this._scrollTarget, 0.0001, delta)
    state.pointer.x = damp(state.pointer.x, this._pointerTarget.x, 0.002, delta)
    state.pointer.y = damp(state.pointer.y, this._pointerTarget.y, 0.002, delta)
    state.accent = damp(state.accent, Math.max(this._ambient, this._accentTarget), 0.003, delta)

    this.camera.update(delta, state.scroll, state.pointer)
    this.world.update(state, delta)

    if (this.world.mediaPlane.visible) this.world.mediaPlane.syncTo(this._mediaStage)

    const gl = this.renderer.instance

    this.post.beginScene()
    gl.render(this.world.background.scene, this.world.background.camera)
    gl.clearDepth()
    gl.render(this.world.scene, this.camera.instance)

    if (this.world.mediaPlane.visible) {
      gl.clearDepth()
      gl.render(this.world.mediaPlane.scene, this.world.mediaPlane.camera)
    }

    this.post.resolve(elapsed)
    this.renderer.monitor(delta, elapsed)
  }

  /** Compiles every material before the first visible frame. */
  prewarm() {
    this.renderer.prewarm(this.world.background.scene, this.world.background.camera)
    this.renderer.prewarm(this.world.scene, this.camera.instance)
    this.renderer.prewarm(this.world.mediaPlane.scene, this.world.mediaPlane.camera)
  }

  destroy() {
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('scroll', this._onScroll)
    this.time.destroy()
    this.sizes.destroy()
    this.world.dispose()
    this.post.dispose()
    this.resources.dispose()
    this.renderer.dispose()
  }
}
