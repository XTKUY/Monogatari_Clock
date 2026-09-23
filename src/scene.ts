/** Three.js presentation scene. The editable Blender file is never needed in the browser. */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  MOUSE,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type WebGLRenderTarget,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { Hand } from './time'

export type ViewMode = 'wall' | 'space'

function wallTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const image = context.createImageData(256, 256)
  let seed = 312119
  for (let index = 0; index < image.data.length; index += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const grain = (seed >>> 25) - 64
    image.data[index] = 204 + grain * 0.17
    image.data[index + 1] = 213 + grain * 0.17
    image.data[index + 2] = 203 + grain * 0.17
    image.data[index + 3] = 255
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(4, 4)
  return texture
}

export class ClockScene {
  private readonly stage: HTMLElement
  private readonly scene = new Scene()
  private readonly renderer: WebGLRenderer
  private readonly frontCamera = new OrthographicCamera(-0.2, 0.2, 0.2, -0.2, 0.01, 10)
  private readonly studioCamera = new PerspectiveCamera(36, 1, 0.01, 10)
  private readonly controls: OrbitControls
  private readonly rig = new Group()
  private readonly wall: Mesh<PlaneGeometry, MeshStandardMaterial>
  private readonly wallMap: CanvasTexture
  private readonly handShadowMaterial = new MeshBasicMaterial({
    color: '#445248', transparent: true, opacity: 0.32, depthWrite: false, side: DoubleSide,
  })
  private readonly ambient = new AmbientLight('#ffffff', 1)
  private readonly key = new DirectionalLight('#fff3e6', 1)
  private readonly fill = new DirectionalLight('#d7e7ec', 1)
  private readonly rim = new DirectionalLight('#e9f0ed', 1)
  private readonly environment: WebGLRenderTarget
  private readonly resizeObserver: ResizeObserver
  private pivots: Partial<Record<Hand, Object3D>> = {}
  private mode: ViewMode = 'wall'
  private hoverX = 0
  private hoverY = 0
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private previousFrame = -Infinity
  onFrame: (() => void) | null = null

  constructor(stage: HTMLElement) {
    this.stage = stage
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.92
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
    this.renderer.domElement.className = 'clock-canvas'
    this.renderer.domElement.setAttribute('aria-label', '可交互的三维物语时钟')
    this.stage.prepend(this.renderer.domElement)

    const room = new RoomEnvironment()
    const pmrem = new PMREMGenerator(this.renderer)
    this.environment = pmrem.fromScene(room)
    this.scene.environment = this.environment.texture
    room.dispose()
    pmrem.dispose()

    this.wallMap = wallTexture()
    this.wall = new Mesh(
      new PlaneGeometry(3, 3),
      new MeshStandardMaterial({ map: this.wallMap, color: '#b9c7ba', roughness: 1, metalness: 0 }),
    )
    this.wall.position.z = -0.04
    this.wall.receiveShadow = true
    this.scene.add(this.wall, this.rig)

    this.key.position.set(-0.5, 0.58, 0.36)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    this.key.shadow.camera.left = -0.38
    this.key.shadow.camera.right = 0.38
    this.key.shadow.camera.top = 0.38
    this.key.shadow.camera.bottom = -0.38
    this.key.shadow.camera.near = 0.05
    this.key.shadow.camera.far = 2
    this.key.shadow.bias = -0.00002
    this.key.shadow.normalBias = 0.0002
    this.key.shadow.radius = 3
    this.fill.position.set(0.46, -0.22, 0.52)
    this.rim.position.set(0.2, 0.28, -0.4)
    this.scene.add(this.ambient, this.key, this.fill, this.rim)

    this.frontCamera.position.set(0, 0, 0.7)
    this.frontCamera.lookAt(0, 0, 0)
    this.studioCamera.position.set(0.24, 0.13, 0.52)
    this.studioCamera.lookAt(0, 0, 0)
    this.controls = new OrbitControls(this.studioCamera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.07
    this.controls.minDistance = 0.22
    this.controls.maxDistance = 1.6
    this.controls.maxTargetRadius = 0.22
    this.controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }
    this.controls.enabled = false
    this.controls.saveState()

    this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault())
    this.renderer.domElement.addEventListener('pointermove', (event) => {
      if (this.mode !== 'space' || this.reducedMotion || event.buttons !== 0 || event.pointerType !== 'mouse') return
      const bounds = this.renderer.domElement.getBoundingClientRect()
      this.hoverX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      this.hoverY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    })
    this.renderer.domElement.addEventListener('pointerleave', () => {
      this.hoverX = 0
      this.hoverY = 0
    })

    this.setView('wall')
    this.setLighting(true, 1)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(stage)
    this.resize()
    this.renderer.setAnimationLoop(this.animate)
  }

  async load(modelUrl: string): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(modelUrl)
    const hands = Object.fromEntries(
      (['hour', 'minute', 'second'] as const).map((hand) => [hand, gltf.scene.getObjectByName(`${hand}_hand_pivot`)]),
    ) as Partial<Record<Hand, Object3D>>
    if (!hands.hour || !hands.minute || !hands.second) {
      throw new Error('模型缺少独立的时针、分针或秒针节点。')
    }
    this.pivots = hands
    const adjustedMaterials = new Set<MeshStandardMaterial>()
    const handBlades: Mesh[] = []
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true
        object.receiveShadow = true
        if (object.name.includes('tapered white blade') || object.name.includes('long white blade')) {
          handBlades.push(object)
        }
        // The original white lacquer nearly disappears against the ivory lower dial
        // under real-time lighting. A cooler silver tint keeps both hands legible.
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof MeshStandardMaterial && !adjustedMaterials.has(material) &&
            (material.name.startsWith('Hour | satin ivory lacquer') || material.name.startsWith('Minute | polished white lacquer'))) {
            material.color.set('#4d5d51')
            material.metalness = 0.12
            material.roughness = 0.55
            material.envMapIntensity = 0.25
            adjustedMaterials.add(material)
          }
        }
      }
    })
    // A fine offset silhouette gives the ivory hands a readable edge on the ivory dial.
    for (const blade of handBlades) {
      const shadow = new Mesh(blade.geometry, this.handShadowMaterial)
      shadow.position.copy(blade.position)
      shadow.position.x += 0.01
      shadow.position.y -= 0.012
      shadow.position.z -= 0.008
      shadow.rotation.copy(blade.rotation)
      shadow.scale.copy(blade.scale)
      blade.parent?.add(shadow)
    }
    this.rig.add(gltf.scene)
    const bounds = new Box3().setFromObject(gltf.scene)
    this.wall.position.z = bounds.min.z - 0.008
  }

  setHands(angles: Record<Hand, number>): void {
    for (const hand of ['hour', 'minute', 'second'] as const) {
      const pivot = this.pivots[hand]
      if (pivot) pivot.rotation.z = angles[hand]
    }
  }

  setView(mode: ViewMode): void {
    this.mode = mode
    this.wall.visible = mode === 'wall'
    this.controls.enabled = mode === 'space'
    this.scene.background = new Color(mode === 'wall' ? '#ccd5cb' : '#14201f')
    if (mode === 'wall') {
      this.hoverX = 0
      this.hoverY = 0
    }
  }

  resetCamera(): void {
    this.controls.reset()
    this.hoverX = 0
    this.hoverY = 0
  }

  setLighting(enabled: boolean, intensity: number): void {
    const strength = Math.max(0, Math.min(2, intensity))
    this.ambient.intensity = enabled ? 0.38 * strength : 0.12
    this.key.intensity = enabled ? 2.2 * strength : 0
    this.fill.intensity = enabled ? 0.65 * strength : 0
    this.rim.intensity = enabled ? 0.8 * strength : 0
    this.scene.environmentIntensity = enabled ? 0.58 * strength : 0.08
  }

  private resize(): void {
    const width = Math.max(1, this.stage.clientWidth)
    const height = Math.max(1, this.stage.clientHeight)
    const aspect = width / height
    const halfHeight = 0.205
    this.frontCamera.left = -halfHeight * aspect
    this.frontCamera.right = halfHeight * aspect
    this.frontCamera.top = halfHeight
    this.frontCamera.bottom = -halfHeight
    this.frontCamera.updateProjectionMatrix()
    this.studioCamera.aspect = aspect
    this.studioCamera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private readonly animate = (time: number): void => {
    if (document.hidden || time - this.previousFrame < (this.reducedMotion ? 125 : 33)) return
    this.previousFrame = time
    this.onFrame?.()
    if (this.mode === 'space') this.controls.update()
    const targetX = this.mode === 'space' ? -this.hoverY * 0.018 : 0
    const targetY = this.mode === 'space' ? this.hoverX * 0.028 : 0
    this.rig.rotation.x += (targetX - this.rig.rotation.x) * 0.1
    this.rig.rotation.y += (targetY - this.rig.rotation.y) * 0.1
    this.renderer.render(this.scene, this.mode === 'wall' ? this.frontCamera : this.studioCamera)
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.environment.dispose()
    this.wallMap.dispose()
    this.wall.geometry.dispose()
    this.wall.material.dispose()
    this.handShadowMaterial.dispose()
    this.renderer.dispose()
  }
}
