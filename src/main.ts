import modelUrl from '../models/monogatari-clock.glb?url'
import previewUrl from '../renders/clock-preview.png?url'
import { ClockScene, type ViewMode } from './scene'
import { ClockEngine, handAngles, systemTimeZone, validTimeZone, zonedTime, type Hand } from './time'
import './styles.css'

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (!found) throw new Error(`Missing interface element: ${selector}`)
  return found
}

const stage = element<HTMLElement>('#scene-stage')
const preview = element<HTMLImageElement>('#model-preview')
const loadStatus = element<HTMLElement>('#load-status')
const digitalTime = element<HTMLTimeElement>('#digital-time')
const dateLine = element<HTMLElement>('#date-line')
const clockStatus = element<HTMLElement>('#clock-status')
const headerStatus = element<HTMLElement>('#header-status')
const statusMarker = element<HTMLElement>('#status-marker')
const playToggle = element<HTMLButtonElement>('#play-toggle')
const playLabel = element<HTMLElement>('#play-label')
const playSymbol = element<HTMLElement>('#play-symbol')
const resetLive = element<HTMLButtonElement>('#reset-live')
const zoneInput = element<HTMLInputElement>('#timezone-input')
const zoneOptions = element<HTMLDataListElement>('#timezone-options')
const zoneNote = element<HTMLElement>('#zone-note')
const zoneError = element<HTMLElement>('#zone-error')
const systemZoneButton = element<HTMLButtonElement>('#system-zone')
const knob = element<HTMLElement>('#time-knob')
const knobValue = element<HTMLElement>('#knob-value')
const lightEnabled = element<HTMLInputElement>('#light-enabled')
const lightIntensity = element<HTMLInputElement>('#light-intensity')
const lightValue = element<HTMLOutputElement>('#light-value')
const cameraReset = element<HTMLButtonElement>('#camera-reset')
const viewCaption = element<HTMLElement>('#view-caption')
const viewHint = element<HTMLElement>('#view-hint')

preview.src = previewUrl

const clock = new ClockEngine(Date.now(), performance.now(), systemTimeZone())
const storedZone = (() => {
  try { return localStorage.getItem('monogatari-clock-zone') } catch { return null }
})()
if (storedZone && validTimeZone(storedZone)) clock.setTimeZone(storedZone)

const zones = (() => {
  try { return Intl.supportedValuesOf('timeZone') } catch { return ['UTC', 'Asia/Shanghai', 'Europe/London', 'America/New_York'] }
})()
for (const zone of [...new Set(['UTC', clock.systemZone, ...zones])]) {
  const option = document.createElement('option')
  option.value = zone
  zoneOptions.append(option)
}

const handNames: Record<Hand, string> = { hour: '时针', minute: '分针', second: '秒针' }
const handUnits: Record<Hand, string> = { hour: '时', minute: '分', second: '秒' }
const handCounts: Record<Hand, number> = { hour: 24, minute: 60, second: 60 }
let selectedHand: Hand = 'minute'
let viewMode: ViewMode = 'wall'
let scene: ClockScene | null = null
let lastReadout = ''
let lastKnobReadout = ''
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

function displayDate(epochMilliseconds: number, zone: string): string {
  let formatter = dateFormatters.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: zone, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    })
    dateFormatters.set(zone, formatter)
  }
  return formatter.format(epochMilliseconds)
}

function updateZoneText(): void {
  zoneNote.textContent = clock.isAutomaticZone
    ? `自动检测：${clock.timeZone}`
    : `当前：${clock.timeZone} · 本机：${clock.systemZone}`
}

function refreshClock(): void {
  const epochMilliseconds = clock.read(Date.now(), performance.now())
  const parts = zonedTime(epochMilliseconds, clock.timeZone)
  scene?.setHands(handAngles(parts))

  const timeText = [parts.hour, parts.minute, parts.second].map((value) => String(value).padStart(2, '0')).join(':')
  const readout = `${timeText}|${clock.timeZone}|${clock.status}`
  if (readout !== lastReadout) {
    digitalTime.textContent = timeText
    digitalTime.dateTime = new Date(epochMilliseconds).toISOString()
    dateLine.textContent = displayDate(epochMilliseconds, clock.timeZone)
    const labels = { live: '实时同步', paused: '已暂停', simulation: '模拟运行' }
    clockStatus.textContent = labels[clock.status]
    headerStatus.textContent = `${labels[clock.status]} / ${clock.timeZone}`
    statusMarker.classList.toggle('is-paused', clock.status === 'paused')
    playLabel.textContent = clock.status === 'paused' ? '运行' : '暂停'
    playSymbol.textContent = clock.status === 'paused' ? '▶' : 'Ⅱ'
    resetLive.disabled = clock.status === 'live'
    lastReadout = readout
  }

  const value = parts[selectedHand]
  const count = handCounts[selectedHand]
  const knobReadout = `${selectedHand}:${value}`
  if (knobReadout !== lastKnobReadout) {
    knob.style.setProperty('--knob-angle', `${value / count * 360}deg`)
    knob.setAttribute('aria-valuenow', String(value))
    knob.setAttribute('aria-valuetext', `${String(value).padStart(2, '0')} ${handUnits[selectedHand]}`)
    knobValue.innerHTML = `${String(value).padStart(2, '0')} <small>${handUnits[selectedHand]}</small>`
    lastKnobReadout = knobReadout
  }
}

function resolveZone(input: string): string | null {
  const query = input.trim().replaceAll('_', ' ').toLowerCase()
  if (!query) return null
  const exact = [clock.systemZone, 'UTC', ...zones].find((zone) => zone.toLowerCase() === input.trim().toLowerCase())
  if (exact) return exact
  const cityMatches = zones.filter((zone) => zone.split('/').at(-1)?.replaceAll('_', ' ').toLowerCase() === query)
  return cityMatches.length === 1 ? cityMatches[0] : null
}

function saveZone(zone: string | null): void {
  try {
    if (zone) localStorage.setItem('monogatari-clock-zone', zone)
    else localStorage.removeItem('monogatari-clock-zone')
  } catch { /* Private browsing can block storage; the current selection still works. */ }
}

function commitZone(): void {
  const zone = resolveZone(zoneInput.value)
  if (!zone || !validTimeZone(zone)) {
    zoneError.hidden = false
    zoneInput.setAttribute('aria-invalid', 'true')
    return
  }
  clock.setTimeZone(zone)
  zoneInput.value = zone
  zoneError.hidden = true
  zoneInput.removeAttribute('aria-invalid')
  saveZone(zone)
  updateZoneText()
  refreshClock()
}

zoneInput.value = clock.timeZone
updateZoneText()
zoneInput.addEventListener('change', commitZone)
zoneInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); commitZone(); zoneInput.blur() }
})
systemZoneButton.addEventListener('click', () => {
  clock.refreshSystemTimeZone()
  clock.useSystemTimeZone()
  zoneInput.value = clock.timeZone
  zoneError.hidden = true
  zoneInput.removeAttribute('aria-invalid')
  saveZone(null)
  updateZoneText()
  refreshClock()
})

playToggle.addEventListener('click', () => {
  if (clock.status === 'paused') clock.resume(performance.now())
  else clock.pause(Date.now(), performance.now())
  refreshClock()
})
resetLive.addEventListener('click', () => { clock.resetToLive(); refreshClock() })

function chooseHand(hand: Hand): void {
  selectedHand = hand
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-hand]')) {
    button.setAttribute('aria-pressed', String(button.dataset.hand === hand))
  }
  knob.setAttribute('aria-label', `调整${handNames[hand]}`)
  knob.setAttribute('aria-valuemax', String(handCounts[hand] - 1))
  refreshClock()
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-hand]')) {
  button.addEventListener('click', () => chooseHand(button.dataset.hand as Hand))
}

function adjustTo(target: number): void {
  clock.adjustTo(selectedHand, target, Date.now(), performance.now())
  refreshClock()
}

function stepHand(direction: number): void {
  const parts = zonedTime(clock.read(Date.now(), performance.now()), clock.timeZone)
  adjustTo(parts[selectedHand] + direction)
}

element<HTMLButtonElement>('#step-back').addEventListener('click', () => stepHand(-1))
element<HTMLButtonElement>('#step-forward').addEventListener('click', () => stepHand(1))

function turnKnob(event: PointerEvent): void {
  const bounds = knob.getBoundingClientRect()
  const x = event.clientX - bounds.left - bounds.width / 2
  const y = event.clientY - bounds.top - bounds.height / 2
  const angle = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2)
  adjustTo(Math.round(angle / (Math.PI * 2) * handCounts[selectedHand]) % handCounts[selectedHand])
}

knob.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  knob.setPointerCapture(event.pointerId)
  knob.classList.add('is-turning')
  turnKnob(event)
})
knob.addEventListener('pointermove', (event) => {
  if (knob.hasPointerCapture(event.pointerId)) turnKnob(event)
})
for (const type of ['pointerup', 'pointercancel']) {
  knob.addEventListener(type, (event) => {
    if (knob.hasPointerCapture((event as PointerEvent).pointerId)) knob.releasePointerCapture((event as PointerEvent).pointerId)
    knob.classList.remove('is-turning')
  })
}
knob.addEventListener('keydown', (event) => {
  const parts = zonedTime(clock.read(Date.now(), performance.now()), clock.timeZone)
  let target: number | null = null
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') target = parts[selectedHand] + 1
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') target = parts[selectedHand] - 1
  if (event.key === 'PageUp') target = parts[selectedHand] + 5
  if (event.key === 'PageDown') target = parts[selectedHand] - 5
  if (event.key === 'Home') target = 0
  if (event.key === 'End') target = handCounts[selectedHand] - 1
  if (target !== null) { event.preventDefault(); adjustTo(target) }
})

function setView(mode: ViewMode): void {
  viewMode = mode
  scene?.setView(mode)
  stage.dataset.view = mode
  viewCaption.textContent = mode === 'wall' ? '墙面视图 / FRONT VIEW' : '空间视图 / SPACE VIEW'
  viewHint.textContent = mode === 'wall'
    ? '正面视图 · 时钟挂在墙面'
    : '移动鼠标看视差 · 左键旋转 · 中键平移 · 滚轮缩放'
  cameraReset.disabled = mode !== 'space'
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    const active = button.dataset.view === mode
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  }
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
  button.addEventListener('click', () => setView(button.dataset.view as ViewMode))
}
cameraReset.addEventListener('click', () => scene?.resetCamera())

function updateLighting(): void {
  const percent = Number(lightIntensity.value)
  lightValue.value = `${percent}%`
  lightIntensity.style.setProperty('--range-progress', `${percent / 2}%`)
  lightIntensity.disabled = !lightEnabled.checked
  scene?.setLighting(lightEnabled.checked, percent / 100)
}
lightEnabled.addEventListener('change', updateLighting)
lightIntensity.addEventListener('input', updateLighting)
updateLighting()

window.addEventListener('visibilitychange', () => {
  if (document.hidden) return
  clock.refreshSystemTimeZone()
  if (clock.isAutomaticZone) zoneInput.value = clock.timeZone
  updateZoneText()
  refreshClock()
})

refreshClock()
try {
  scene = new ClockScene(stage)
  scene.onFrame = refreshClock
  scene.setView(viewMode)
  updateLighting()
  scene.load(modelUrl).then(() => {
    refreshClock()
    preview.classList.add('is-hidden')
    loadStatus.hidden = true
  }).catch((error: unknown) => {
    console.error('Clock model loading failed', error)
    loadStatus.textContent = '模型载入失败，正在显示静态预览。请检查网络或刷新页面。'
    stage.classList.add('has-fallback')
  })
} catch (error) {
  console.error('3D renderer unavailable', error)
  loadStatus.textContent = '浏览器无法启动三维视图，正在显示静态预览。'
  stage.classList.add('has-fallback')
  window.setInterval(refreshClock, 125)
}

window.addEventListener('beforeunload', () => scene?.dispose())
