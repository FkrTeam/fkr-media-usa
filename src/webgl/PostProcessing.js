import * as THREE from 'three'
import { compositeVertex, compositeFragment } from './shaders/composite.js'

/**
 * Single-pass composite.
 *
 * The scene is drawn into one render target and resolved through a grade
 * pass: radial chromatic aberration, film grain and a vignette. Disabled
 * outright on low-tier devices, where the target allocation costs more than
 * the effect is worth.
 */
export default class PostProcessing {
  constructor({ renderer, sizes, enabled = true }) {
    this.renderer = renderer
    this.sizes = sizes
    this.enabled = enabled
    if (!enabled) return

    const { width, height, pixelRatio } = sizes

    this.target = new THREE.WebGLRenderTarget(
      Math.round(width * pixelRatio),
      Math.round(height * pixelRatio),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        colorSpace: THREE.SRGBColorSpace,
        depthBuffer: true,
        stencilBuffer: false,
        samples: 0
      }
    )

    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.material = new THREE.ShaderMaterial({
      vertexShader: compositeVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: this.target.texture },
        uResolution: { value: new THREE.Vector2(width, height) },
        uTime: { value: 0 },
        uAberration: { value: 0.0042 },
        uGrain: { value: 0.026 },
        uVignette: { value: 0.55 }
      }
    })

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
  }

  resize() {
    if (!this.enabled) return
    const { width, height, pixelRatio } = this.sizes
    this.target.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio))
    this.material.uniforms.uResolution.value.set(width, height)
  }

  /** Binds the draw destination and clears it — the render loop's single clear. */
  beginScene() {
    this.renderer.setRenderTarget(this.enabled ? this.target : null)
    this.renderer.clear()
  }

  /** Resolves the target to the default framebuffer. */
  resolve(elapsed) {
    if (!this.enabled) return
    this.material.uniforms.uTime.value = elapsed
    this.renderer.setRenderTarget(null)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
  }

  /** Transition energy briefly pushes the aberration for a filmic snap. */
  set energy(value) {
    if (!this.enabled) return
    this.material.uniforms.uAberration.value = 0.0042 + value * 0.014
  }

  dispose() {
    if (!this.enabled) return
    this.target.dispose()
    this.quad.geometry.dispose()
    this.material.dispose()
  }
}
