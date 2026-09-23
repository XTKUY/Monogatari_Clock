import { describe, expect, it } from 'vitest'
import { ClockEngine, handAngles, zonedTime } from './time'

describe('ClockEngine', () => {
  it('uses the detected zone and the real clock until paused', () => {
    const clock = new ClockEngine(0, 0, 'Asia/Shanghai')
    expect(clock.timeZone).toBe('Asia/Shanghai')
    expect(clock.read(5_000, 700)).toBe(5_000)
    clock.pause(5_000, 700)
    expect(clock.status).toBe('paused')
    expect(clock.read(50_000, 5_000)).toBe(5_000)
    clock.resume(5_000)
    expect(clock.read(60_000, 6_500)).toBe(6_500)
    clock.resetToLive()
    expect(clock.read(60_000, 6_500)).toBe(60_000)
  })

  it('keeps the same instant when changing time zone', () => {
    const clock = new ClockEngine(Date.UTC(2026, 0, 1, 0), 0, 'UTC')
    clock.setTimeZone('Asia/Shanghai')
    expect(zonedTime(clock.read(Date.UTC(2026, 0, 1, 0), 0), clock.timeZone).hour).toBe(8)
    clock.useSystemTimeZone()
    expect(clock.timeZone).toBe('UTC')
  })

  it('follows a changed system zone only while automatic selection is active', () => {
    const clock = new ClockEngine(0, 0, 'UTC')
    clock.refreshSystemTimeZone('Asia/Tokyo')
    expect(clock.timeZone).toBe('Asia/Tokyo')
    clock.setTimeZone('Europe/London')
    clock.refreshSystemTimeZone('Asia/Shanghai')
    expect(clock.timeZone).toBe('Europe/London')
    clock.useSystemTimeZone()
    expect(clock.timeZone).toBe('Asia/Shanghai')
  })

  it('moves forward across a minute wrap and pauses before adjustment', () => {
    const start = Date.UTC(2026, 0, 1, 10, 59, 30)
    const clock = new ClockEngine(start, 0, 'UTC')
    clock.adjustTo('minute', 0, start, 0)
    expect(clock.status).toBe('paused')
    expect(zonedTime(clock.read(start, 0), 'UTC')).toMatchObject({ hour: 11, minute: 0, second: 30 })
  })

  it('rolls an hour from 23 to 00 into the next day', () => {
    const start = Date.UTC(2026, 0, 1, 23, 15)
    const clock = new ClockEngine(start, 0, 'UTC')
    clock.adjustTo('hour', 0, start, 0)
    expect(zonedTime(clock.read(start, 0), 'UTC')).toMatchObject({ day: 2, hour: 0, minute: 15 })
  })

  it('keeps the hands continuous with fractional seconds', () => {
    const time = zonedTime(Date.UTC(2026, 0, 1, 3, 30, 15, 500), 'UTC')
    const angles = handAngles(time)
    expect(angles.hour).toBeCloseTo(-2 * Math.PI * (3.5 + 15.5 / 3600) / 12)
    expect(angles.second).toBeCloseTo(-2 * Math.PI * 15.5 / 60)
  })
})
