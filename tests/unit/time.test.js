import { describe, it, expect } from 'vitest'
import { workDate, addDays, daysBetween, weekday, dueMoment, isOverdue, formatTime, formatDayLong, relativeDayLabel } from '../../src/lib/time.js'

describe('рабочий день (Ташкент, UTC+5, начало в 04:00)', () => {
  it('03:59 по Ташкенту — ещё вчерашний день', () => {
    expect(workDate(new Date('2026-11-07T22:59:00Z'))).toBe('2026-11-07')
  })
  it('04:00 по Ташкенту — уже новый день', () => {
    expect(workDate(new Date('2026-11-07T23:00:00Z'))).toBe('2026-11-08')
  })
  it('00:30 после закрытия смены — относится к вчера', () => {
    expect(workDate(new Date('2026-11-08T19:30:00Z'))).toBe('2026-11-08') // 00:30 9 ноября по Ташкенту
  })
  it('полдень', () => {
    expect(workDate(new Date('2026-11-08T07:00:00Z'))).toBe('2026-11-08')
  })
})

describe('арифметика дат', () => {
  it('через месяц и год', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
  it('разница в днях', () => {
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7)
    expect(daysBetween('2026-11-08', '2026-11-01')).toBe(-7)
  })
  it('день недели: пн=1, вс=7', () => {
    expect(weekday('2026-11-09')).toBe(1)
    expect(weekday('2026-11-08')).toBe(7)
  })
})

describe('срок «к какому часу»', () => {
  it('11:00 по Ташкенту = 06:00 UTC', () => {
    expect(dueMoment('2026-11-08', '11:00').toISOString()).toBe('2026-11-08T06:00:00.000Z')
  })
  it('01:00 — это ночь после рабочего дня', () => {
    expect(dueMoment('2026-11-08', '01:00').toISOString()).toBe('2026-11-08T20:00:00.000Z')
  })
  it('время из базы с секундами', () => {
    expect(dueMoment('2026-11-08', '11:00:00').toISOString()).toBe('2026-11-08T06:00:00.000Z')
  })
  it('опоздание', () => {
    const t = { date: '2026-11-08', due_time: '11:00', done_at: null }
    expect(isOverdue(t, new Date('2026-11-08T05:59:00Z'))).toBe(false)
    expect(isOverdue(t, new Date('2026-11-08T06:01:00Z'))).toBe(true)
    expect(isOverdue({ ...t, done_at: 'x' }, new Date('2026-11-08T07:00:00Z'))).toBe(false)
    expect(isOverdue({ ...t, due_time: null }, new Date('2026-11-09T07:00:00Z'))).toBe(false)
  })
})

describe('форматирование', () => {
  it('время по Ташкенту', () => expect(formatTime('2026-11-08T04:12:00Z')).toBe('09:12'))
  it('длинная дата', () => expect(formatDayLong('2026-11-08')).toBe('Вс, 8 ноября'))
  it('относительная', () => {
    expect(relativeDayLabel('2026-11-08', '2026-11-08')).toBe('Сегодня')
    expect(relativeDayLabel('2026-11-09', '2026-11-08')).toBe('Завтра')
    expect(relativeDayLabel('2026-11-07', '2026-11-08')).toBe('Вчера')
  })
})
