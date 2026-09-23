/** Timekeeping and time-zone conversion for the three independently driven hands. */

export type Hand = 'hour' | 'minute' | 'second'
export type ClockStatus = 'live' | 'paused' | 'simulation'

export interface ZonedTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()
const unitMilliseconds: Record<Hand, number> = {
  hour: 3_600_000,
  minute: 60_000,
  second: 1_000,
}
const unitCount: Record<Hand, number> = { hour: 24, minute: 60, second: 60 }

export function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function validTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export function zonedTime(epochMilliseconds: number, zone: string): ZonedTime {
  let formatter = formatterCache.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatterCache.set(zone, formatter)
  }

  const values = Object.fromEntries(
    formatter.formatToParts(epochMilliseconds).map((part) => [part.type, Number(part.value)]),
  )
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    millisecond: ((epochMilliseconds % 1_000) + 1_000) % 1_000,
  }
}

export function handAngles(time: ZonedTime): Record<Hand, number> {
  const seconds = time.second + time.millisecond / 1_000
  const minutes = time.minute + seconds / 60
  return {
    hour: -2 * Math.PI * ((time.hour % 12) + minutes / 60) / 12,
    minute: -2 * Math.PI * minutes / 60,
    second: -2 * Math.PI * seconds / 60,
  }
}

/** The shortest modular step lets the knob cross 59→00 without moving back 59 units. */
function shortestStep(current: number, target: number, count: number): number {
  let delta = ((target - current) % count + count) % count
  if (delta > count / 2) delta -= count
  return delta
}

export class ClockEngine {
  private anchorEpochMilliseconds: number
  private anchorMonotonicMilliseconds: number
  private mode: 'live' | 'simulation' = 'live'
  private moving = true
  private automaticZone = true
  private detectedZone: string
  timeZone: string

  constructor(epochMilliseconds: number, monotonicMilliseconds: number, detectedZone = systemTimeZone()) {
    this.anchorEpochMilliseconds = epochMilliseconds
    this.anchorMonotonicMilliseconds = monotonicMilliseconds
    this.detectedZone = validTimeZone(detectedZone) ? detectedZone : 'UTC'
    this.timeZone = this.detectedZone
  }

  get status(): ClockStatus {
    if (!this.moving) return 'paused'
    return this.mode === 'live' ? 'live' : 'simulation'
  }

  get isAutomaticZone(): boolean {
    return this.automaticZone
  }

  get systemZone(): string {
    return this.detectedZone
  }

  read(epochMilliseconds: number, monotonicMilliseconds: number): number {
    if (this.mode === 'live') return epochMilliseconds
    return this.anchorEpochMilliseconds + (this.moving ? monotonicMilliseconds - this.anchorMonotonicMilliseconds : 0)
  }

  pause(epochMilliseconds: number, monotonicMilliseconds: number): void {
    if (!this.moving) return
    this.anchorEpochMilliseconds = this.read(epochMilliseconds, monotonicMilliseconds)
    this.anchorMonotonicMilliseconds = monotonicMilliseconds
    this.mode = 'simulation'
    this.moving = false
  }

  resume(monotonicMilliseconds: number): void {
    if (this.moving) return
    this.anchorMonotonicMilliseconds = monotonicMilliseconds
    this.moving = true
  }

  resetToLive(): void {
    this.mode = 'live'
    this.moving = true
  }

  setTimeZone(zone: string): void {
    if (!validTimeZone(zone)) throw new RangeError(`Unknown time zone: ${zone}`)
    this.timeZone = zone
    this.automaticZone = false
  }

  useSystemTimeZone(): void {
    this.timeZone = this.detectedZone
    this.automaticZone = true
  }

  refreshSystemTimeZone(zone = systemTimeZone()): void {
    if (!validTimeZone(zone)) return
    this.detectedZone = zone
    if (this.automaticZone) this.timeZone = zone
  }

  adjustTo(hand: Hand, target: number, epochMilliseconds: number, monotonicMilliseconds: number): void {
    this.pause(epochMilliseconds, monotonicMilliseconds)
    const current = zonedTime(this.anchorEpochMilliseconds, this.timeZone)[hand]
    const count = unitCount[hand]
    const normalizedTarget = ((Math.round(target) % count) + count) % count
    this.anchorEpochMilliseconds += shortestStep(current, normalizedTarget, count) * unitMilliseconds[hand]
  }
}
