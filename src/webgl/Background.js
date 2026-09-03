import * as THREE from 'three'
import { backgroundVertex, backgroundFragment } from './shaders/background.js'

/**
 * Fullscreen atmospheric plate, drawn before the scene in its own
 * orthographic pass so it never interacts with the perspective camera.
 */
export default class Background {
  constructor({ sizes }) {
    this.sizes = sizes

    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.material = new THREE.ShaderMaterial({
      vertexShader: backgroundVertex,
      fragmentShader: backgroundFragment,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uIntensity: { value: 1 },
        uPointer: { value: new THREE.Vector2() },
        uResolution: { value: new THREE.Vector2(sizes.width, sizes.height) }
      }
    })

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
  }

  resize() {
    this.material.uniforms.uResolution.value.set(this.sizes.width, this.sizes.height)
  }

  update(state) {
    const u = this.material.uniforms
    u.uTime.value = state.elapsed
    u.uScroll.value = state.scroll
    u.uPointer.value.copy(state.pointer)
    u.uIntensity.value = state.intensity
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
