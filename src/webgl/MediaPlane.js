import * as THREE from 'three'
import { mediaPlaneVertex, mediaPlaneFragment } from './shaders/mediaPlane.js'
import { damp } from '../utils/math.js'

/**
 * The DOM-synced media plane.
 *
 * It lives in its own scene with a camera configured so one world unit
 * equals one CSS pixel — the plane is matched to whichever element carries
 * `data-media-stage` on the current route and tracks it exactly, while
 * still getting real perspective for the hover and transition bend.
 *
 * Originally built for the portfolio; it now carries the abstract brand
 * object in the homepage About block. The DOM decides what it tracks, so
 * any route can adopt it without touching this file.
 */

const PERSPECTIVE = 900

export default class MediaPlane {
  constructor({ sizes, tier = 'high' }) {
    this.sizes = sizes
    this.tier = tier

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(50, sizes.aspect, 1, 3000)
    this.camera.position.z = PERSPECTIVE

    this.textures = []
    this.index = 0
    this.visible = false
    this._hover = 0
    this._targetHover = 0

    this.fallbackTexture = this._makeFallbackTexture()

    this.material = new THREE.ShaderMaterial({
      vertexShader: mediaPlaneVertex,
      fragmentShader: mediaPlaneFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCurrent: { value: this.fallbackTexture },
        uNext: { value: this.fallbackTexture },
        uCurrentSize: { value: new THREE.Vector2(1, 1) },
        uNextSize: { value: new THREE.Vector2(1, 1) },
        uPlaneSize: { value: new THREE.Vector2(1, 1) },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uHover: { value: 0 },
        uOpacity: { value: 0 },
        uPointer: { value: new THREE.Vector2() }
      }
    })

    const segments = tier === 'low' ? 12 : 32
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, segments, segments), this.material)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)

    this.resize()
  }

  _makeFallbackTexture() {
    // 2×2 charcoal so a missing image degrades to a neutral surface rather
    // than a black hole — and never to a flat red panel.
    const data = new Uint8Array([12, 12, 12, 255, 24, 24, 24, 255, 32, 32, 32, 255, 12, 12, 12, 255])
    const texture = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat)
    texture.colorSpace = THREE.NoColorSpace
    texture.needsUpdate = true
    return texture
  }

  /** Registers the loaded textures, in display order. */
  setTextures(textures) {
    this.textures = textures.map((texture) => texture ?? this.fallbackTexture)
    if (!this.textures.length) return
    this._assign('uCurrent', 'uCurrentSize', this.textures[0])
    this._assign('uNext', 'uNextSize', this.textures[0])
  }

  _assign(textureKey, sizeKey, texture) {
    const image = texture?.image
    this.material.uniforms[textureKey].value = texture ?? this.fallbackTexture
    this.material.uniforms[sizeKey].value.set(
      image?.naturalWidth || image?.width || 1,
      image?.naturalHeight || image?.height || 1
    )
  }

  /**
   * Moves to another texture. The shader transitions from whatever is
   * currently shown; `progress` is animated by the caller.
   */
  prepare(index) {
    if (!this.textures.length) return false
    const next = (index + this.textures.length) % this.textures.length
    if (next === this.index) return false

    // Whatever the last transition ended on becomes the new "current".
    const shown = this.material.uniforms.uProgress.value >= 0.5
      ? this.material.uniforms.uNext.value
      : this.material.uniforms.uCurrent.value

    this._assign('uCurrent', 'uCurrentSize', shown)
    this._assign('uNext', 'uNextSize', this.textures[next])
    this.material.uniforms.uProgress.value = 0
    this.index = next
    return true
  }

  get progress() {
    return this.material.uniforms.uProgress.value
  }

  set progress(value) {
    this.material.uniforms.uProgress.value = value
  }

  get opacity() {
    return this.material.uniforms.uOpacity.value
  }

  set opacity(value) {
    this.material.uniforms.uOpacity.value = value
    this.visible = value > 0.001
  }

  set hover(value) {
    this._targetHover = value
  }

  resize() {
    const { width, height, aspect } = this.sizes
    this.camera.aspect = aspect
    this.camera.fov = (2 * Math.atan(height / 2 / PERSPECTIVE) * 180) / Math.PI
    this.camera.updateProjectionMatrix()
    this._width = width
    this._height = height
  }

  /**
   * Matches the mesh to a DOM rect. One layout read per frame, no writes —
   * the render loop never touches the DOM otherwise.
   */
  syncTo(element) {
    if (!element) return
    const rect = element.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return

    this.mesh.scale.set(rect.width, rect.height, 1)
    this.mesh.position.x = rect.left + rect.width / 2 - this._width / 2
    this.mesh.position.y = -(rect.top + rect.height / 2) + this._height / 2
    this.material.uniforms.uPlaneSize.value.set(rect.width, rect.height)
  }

  update(state, delta) {
    this._hover = damp(this._hover, this._targetHover, 0.002, delta)
    this.material.uniforms.uTime.value = state.elapsed
    this.material.uniforms.uHover.value = this._hover
    this.material.uniforms.uPointer.value.copy(state.pointer)
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.fallbackTexture.dispose()
    for (const texture of this.textures) texture?.dispose?.()
    this.textures = []
  }
}
