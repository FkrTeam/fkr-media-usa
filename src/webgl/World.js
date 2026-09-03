import * as THREE from 'three'
import Background from './Background.js'
import SignalField from './SignalField.js'
import MediaPlane from './MediaPlane.js'

/**
 * Everything that is drawn.
 *
 * Three layers, one coherent idea: the atmospheric plate behind, the signal
 * field in the middle, the DOM-synced media plane in front. No lights, no PBR — the
 * whole world is authored in shaders, which is what keeps it cheap.
 */
export default class World {
  constructor({ sizes, tier, reducedMotion }) {
    this.sizes = sizes

    this.scene = new THREE.Scene()
    this.scene.fog = null

    this.background = new Background({ sizes })

    this.field = new SignalField({
      tier,
      reducedMotion,
      pixelRatio: sizes.pixelRatio
    })
    this.scene.add(this.field.points)

    this.mediaPlane = new MediaPlane({ sizes, tier })
  }

  resize() {
    this.background.resize()
    this.field.resize(this.sizes.pixelRatio)
    this.mediaPlane.resize()
  }

  update(state, delta) {
    this.background.update(state)
    this.field.update(state)
    this.mediaPlane.update(state, delta)
  }

  dispose() {
    this.background.dispose()
    this.field.dispose()
    this.mediaPlane.dispose()
    this.scene.clear()
  }
}
