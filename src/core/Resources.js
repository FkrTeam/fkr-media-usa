import * as THREE from 'three'
import EventEmitter from './EventEmitter.js'
import { asset } from '../utils/dom.js'

/**
 * Staged resource loader.
 *
 * Nothing here is loaded eagerly. Stages are registered up front and pulled
 * in when the experience actually needs them, so the 40-second film can play
 * while the portfolio textures stream in behind it.
 *
 * Every item is wrapped in a timeout and resolves to `null` on failure — a
 * missing texture degrades one plane, it never traps the visitor on the
 * preloader.
 */

const TIMEOUT = 14000

/** Compressed-mesh loaders are heavy; they are only imported if a GLB is registered. */
let gltfLoaderPromise = null

async function getGLTFLoader(renderer) {
  if (!gltfLoaderPromise) {
    gltfLoaderPromise = (async () => {
      const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
        import('three/examples/jsm/loaders/KTX2Loader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js')
      ])

      const draco = new DRACOLoader().setDecoderPath(asset('vendor/draco/'))
      const ktx2 = new KTX2Loader().setTranscoderPath(asset('vendor/basis/')).detectSupport(renderer)

      return new GLTFLoader()
        .setDRACOLoader(draco)
        .setKTX2Loader(ktx2)
        .setMeshoptDecoder(MeshoptDecoder)
    })()
  }
  return gltfLoaderPromise
}

function withTimeout(promise, label, isAbandoned = () => false) {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(() => {
        // A load abandoned by a route change is not a fault worth reporting.
        if (!isAbandoned()) console.warn(`[resources] timed out: ${label}`)
        resolve(null)
      }, TIMEOUT)
    )
  ]).catch((error) => {
    if (!isAbandoned()) console.warn(`[resources] failed: ${label}`, error)
    return null
  })
}

export default class Resources extends EventEmitter {
  constructor(renderer = null) {
    super()
    this.renderer = renderer
    this.items = new Map()
    this.stages = new Map()
    this.loaded = new Set()
    this.abandoned = false
    this.textureLoader = new THREE.TextureLoader()
  }

  /**
   * Marks in-flight loads as abandoned. Called when a route changes: the
   * requests are left to finish or expire on their own, but they stop
   * reporting themselves as failures.
   */
  abandonPending() {
    this.abandoned = true
  }

  /** Registers a named stage. Items: { id, type, src }. */
  registerStage(name, items) {
    this.stages.set(name, items)
    return this
  }

  get(id) {
    return this.items.get(id) ?? null
  }

  /** Loads one stage; repeated calls are no-ops. Never rejects. */
  async loadStage(name) {
    if (this.loaded.has(name)) return this.items
    this.loaded.add(name)

    const items = this.stages.get(name) ?? []
    const total = items.length || 1
    let done = 0

    // A newly requested stage is wanted again, whatever was abandoned before.
    this.abandoned = false
    this.emit('stage', name)
    const bump = () => {
      done += 1
      this.emit('progress', { stage: name, loaded: done, total, ratio: done / total })
    }

    if (!items.length) {
      this.emit('progress', { stage: name, loaded: 1, total: 1, ratio: 1 })
      this.emit('stage:done', name)
      return this.items
    }

    await Promise.all(
      items.map(async (item) => {
        const value = await this._loadItem(item)
        if (value !== null && item.id) this.items.set(item.id, value)
        bump()
      })
    )

    this.emit('stage:done', name)
    return this.items
  }

  _loadItem(item) {
    const abandoned = () => this.abandoned

    switch (item.type) {
      case 'texture':
        return withTimeout(this._texture(item.src), item.src, abandoned)
      case 'image':
        return withTimeout(this._image(item.src), item.src, abandoned)
      case 'font':
        return withTimeout(this._fonts(), 'fonts', abandoned)
      case 'gltf':
        return withTimeout(this._gltf(item.src), item.src, abandoned)
      default:
        return Promise.resolve(null)
    }
  }

  _texture(src) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        asset(src),
        (texture) => {
          // The whole world is authored in display space by hand-written
          // shaders, so textures are sampled raw rather than decoded to
          // linear — otherwise every project image renders a stop too dark.
          texture.colorSpace = THREE.NoColorSpace
          texture.generateMipmaps = true
          texture.minFilter = THREE.LinearMipmapLinearFilter
          texture.magFilter = THREE.LinearFilter
          texture.anisotropy = this.renderer?.capabilities.getMaxAnisotropy?.() ?? 1
          texture.needsUpdate = true
          resolve(texture)
        },
        undefined,
        reject
      )
    })
  }

  _image(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = asset(src)
    })
  }

  async _fonts() {
    if (!document.fonts) return true
    await document.fonts.ready
    return true
  }

  async _gltf(src) {
    const loader = await getGLTFLoader(this.renderer)
    return new Promise((resolve, reject) => {
      loader.load(asset(src), resolve, undefined, reject)
    })
  }

  /** Frees every GPU-backed resource this loader created. */
  dispose() {
    for (const value of this.items.values()) {
      if (value?.isTexture) value.dispose()
      if (value?.scene) {
        value.scene.traverse((child) => {
          if (!child.isMesh) return
          child.geometry?.dispose()
          const materials = [].concat(child.material ?? [])
          for (const material of materials) {
            for (const key of Object.keys(material)) {
              if (material[key]?.isTexture) material[key].dispose()
            }
            material.dispose()
          }
        })
      }
    }
    this.items.clear()
    super.destroy()
  }
}
