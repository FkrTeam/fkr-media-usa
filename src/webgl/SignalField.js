import * as THREE from 'three'
import { signalFieldVertex, signalFieldFragment } from './shaders/signalField.js'
import { PARTICLE_SCALE } from '../utils/device.js'

/**
 * The signal field: a lattice of additive points on a receding plane.
 *
 * Point count scales with the device tier — full on desktop, 60% on tablets,
 * 30% on phones — and the whole system is a single draw call.
 */
export default class SignalField {
  constructor({ tier = 'high', reducedMotion = false, pixelRatio = 1 }) {
    this.tier = tier
    this.reducedMotion = reducedMotion

    const scale = Math.sqrt(PARTICLE_SCALE[tier] ?? 1)
    this.cols = Math.max(48, Math.round(300 * scale))
    this.rows = Math.max(28, Math.round(150 * scale))
    this.count = this.cols * this.rows

    const geometry = this._buildGeometry()

    this.material = new THREE.ShaderMaterial({
      vertexShader: signalFieldVertex,
      fragmentShader: signalFieldFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: reducedMotion ? 0.35 : 1 },
        uSize: { value: tier === 'low' ? 3.6 : 2.8 },
        uPixelRatio: { value: pixelRatio },
        uScroll: { value: 0 },
        uReveal: { value: 0 },
        uAccent: { value: 0 },
        uOpacity: { value: 1 },
        uPointer: { value: new THREE.Vector2() }
      }
    })

    this.points = new THREE.Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.position.y = -1.9
  }

  _buildGeometry() {
    const { cols, rows, count } = this
    const positions = new Float32Array(count * 3)
    const randoms = new Float32Array(count)
    const scales = new Float32Array(count)
    // Colour tier per point. The shader reads this as: below 0.80 neutral,
    // 0.80-0.95 ember, above 0.95 brand — an 80 / 15 / 5 split.
    const tints = new Float32Array(count)

    const spanX = 34
    const spanZ = 30

    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        const i = z * cols + x
        const i3 = i * 3

        // Slight jitter so the lattice never reads as a printed grid.
        const jx = (Math.random() - 0.5) * (spanX / cols) * 1.4
        const jz = (Math.random() - 0.5) * (spanZ / rows) * 1.4

        positions[i3] = (x / (cols - 1) - 0.5) * spanX + jx
        positions[i3 + 1] = 0
        // Rows bunch up toward the horizon, which is what gives the depth cue.
        positions[i3 + 2] = 6 - Math.pow(z / (rows - 1), 1.45) * spanZ + jz

        randoms[i] = Math.random()
        scales[i] = 0.55 + Math.random() * 0.9
        tints[i] = Math.random()
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 1))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40)
    return geometry
  }

  resize(pixelRatio) {
    this.material.uniforms.uPixelRatio.value = pixelRatio
  }

  update(state) {
    const u = this.material.uniforms
    u.uTime.value = state.elapsed
    u.uScroll.value = state.scroll
    u.uPointer.value.copy(state.pointer)
    u.uAccent.value = state.accent
    u.uOpacity.value = state.intensity
  }

  /** 0 → 1 wipe used by the intro handoff. */
  set reveal(value) {
    this.material.uniforms.uReveal.value = value
  }

  get reveal() {
    return this.material.uniforms.uReveal.value
  }

  dispose() {
    this.points.geometry.dispose()
    this.material.dispose()
  }
}
