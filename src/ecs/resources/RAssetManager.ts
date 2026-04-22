import {
  LoadingManager,
  Object3D,
  TextureLoader,
  type Texture
} from "three"

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { SkeletonUtils } from "three/examples/jsm/Addons.js"

type ModelEntry = {
  key: string
  url: string
}

type TextureEntry = {
  key: string
  url: string
}

export class RAssetManager {
  private manager: LoadingManager

  private gltfLoader: GLTFLoader
  private textureLoader: TextureLoader

  private models = new Map<string, Object3D>()
  private textures = new Map<string, Texture>()

  constructor() {
    this.manager = new LoadingManager()

    // 🔥 Global hooks
    this.manager.onStart = (url, _loaded, _total) => {
      console.log(`Started loading: ${url}`)
    }

    this.manager.onLoad = () => {
      console.log("All assets loaded")
    }

    this.manager.onError = (url) => {
      console.error(`Error loading: ${url}`)
    }

    // 🔥 All loaders share same manager
    this.gltfLoader = new GLTFLoader(this.manager)
    this.textureLoader = new TextureLoader(this.manager)
  }

  // =====================
  // LOAD ALL
  // =====================

  async loadAll({
    models = [],
    textures = [],
    onProgress
  }: {
    models?: ModelEntry[]
    textures?: TextureEntry[]
    onProgress?: (loaded: number, total: number) => void
  }) {
    let loaded = 0
    const total = models.length + textures.length

    const updateProgress = () => {
      loaded++
      onProgress?.(loaded, total)
    }

    await Promise.all([
      ...models.map(async (m) => {
        await this.loadModel(m.key, m.url)
        updateProgress()
      }),
      ...textures.map(async (t) => {
        await this.loadTexture(t.key, t.url)
        updateProgress()
      })
    ])
  }

  // =====================
  // LOADERS
  // =====================

  private async loadModel(key: string, url: string) {
    if (this.models.has(key)) return

    const gltf = await new Promise<any>((resolve, reject) => {
      this.gltfLoader.load(url, resolve, undefined, reject)
    })

    this.models.set(key, gltf.scene)
  }

  private async loadTexture(key: string, url: string) {
    if (this.textures.has(key)) return

    const texture = await new Promise<Texture>((resolve, reject) => {
      this.textureLoader.load(url, resolve, undefined, reject)
    })

    this.textures.set(key, texture)
  }

  // =====================
  // GETTERS
  // =====================

  getModel(key: string): Object3D {
    const original = this.models.get(key)
    if (!original) throw new Error(`Model not loaded: ${key}`)

    return SkeletonUtils.clone(original)
  }

  getTexture(key: string): Texture {
    const texture = this.textures.get(key)
    if (!texture) throw new Error(`Texture not loaded: ${key}`)

    return texture
  }

  // =====================
  // UTIL
  // =====================

  hasModel(key: string) {
    return this.models.has(key)
  }

  hasTexture(key: string) {
    return this.textures.has(key)
  }

  clear() {
    this.models.clear()
    this.textures.clear()
  }
}