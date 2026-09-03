import * as THREE from 'three'
import { damp } from '../utils/math.js'

/**
 * Perspective camera with a slow parallax drift.
 *
 * The camera never cuts. Scroll dollies it through the signal field and the
 * pointer nudges it a few hundredths of a unit — enough to feel alive,
 * never enough to make the type swim.
 */
export default class Camera {
  constructor({ sizes, reducedMotion = false }) {
    this.sizes = sizes
    this.reducedMotion = reducedMotion

    this.instance = new THREE.PerspectiveCamera(42, sizes.aspect, 0.1, 120)
    this.instance.position.set(0, 0, 7)

    this.base = new THREE.Vector3(0, 0, 7)
    this.offset = new THREE.Vector3()
    this.target = new THREE.Vector3()
  }

  resize() {
    this.instance.aspect = this.sizes.aspect
    this.instance.updateProjectionMatrix()
  }

  /**
   * @param {number} delta      seconds since last frame
   * @param {number} progress   0–1 scroll progress through the document
   * @param {{x:number,y:number}} pointer  normalised −1…1 pointer position
   */
  update(delta, progress, pointer) {
    const strength = this.reducedMotion ? 0.15 : 1

    // Scroll pushes the camera forward and slightly down through the field.
    this.target.set(
      pointer.x * 0.42 * strength,
      -pointer.y * 0.26 * strength - progress * 1.1,
      this.base.z - progress * 3.4
    )

    this.offset.x = damp(this.offset.x, this.target.x, 0.0008, delta)
    this.offset.y = damp(this.offset.y, this.target.y, 0.0008, delta)
    this.offset.z = damp(this.offset.z, this.target.z, 0.0015, delta)

    this.instance.position.set(this.offset.x, this.offset.y, this.offset.z)
    this.instance.rotation.z = this.offset.x * 0.012 * strength
    this.instance.lookAt(this.offset.x * 0.4, this.offset.y * 0.4, this.offset.z - 6)
  }
}
