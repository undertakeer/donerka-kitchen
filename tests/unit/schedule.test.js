import { describe, it, expect } from 'vitest'
import { isDue, describeRepeat } from '../../src/lib/schedule.js'

const base = { start_date: '2026-11-01', end_date: null, archived_at: null }

describe('расписания', () => {
  it('каждый день', () => {
    const t = { ...base, repeat_kind: 'daily' }
    expect(isDue(t, '2026-11-08')).toBe(true)
    expect(isDue(t, '2026-10-31')).toBe(false) // до старта
  })
  it('по дням недели (пн, чт)', () => {
    const t = { ...base, repeat_kind: 'weekdays', weekdays: [1, 4] }
    expect(isDue(t, '2026-11-09')).toBe(true) // пн
    expect(isDue(t, '2026-11-12')).toBe(true) // чт
    expect(isDue(t, '2026-11-10')).toBe(false)
    expect(isDue({ ...t, weekdays: [] }, '2026-11-09')).toBe(false)
  })
  it('раз в 3 дня от даты начала', () => {
    const t = { ...base, repeat_kind: 'every_n', every_n: 3 }
    expect(['2026-11-01', '2026-11-04', '2026-11-07'].every((d) => isDue(t, d))).toBe(true)
    expect(isDue(t, '2026-11-02')).toBe(false)
    expect(isDue(t, '2026-10-29')).toBe(false)
  })
  it('раз в неделю = every_n 7', () => {
    const t = { ...base, repeat_kind: 'every_n', every_n: 7 }
    expect(isDue(t, '2026-11-08')).toBe(true)
    expect(isDue(t, '2026-11-15')).toBe(true)
    expect(isDue(t, '2026-11-14')).toBe(false)
  })
  it('раз в месяц 31-го: в феврале и апреле — последний день', () => {
    const t = { ...base, start_date: '2026-01-01', repeat_kind: 'monthly', month_day: 31 }
    expect(isDue(t, '2027-01-31')).toBe(true)
    expect(isDue(t, '2027-02-28')).toBe(true)
    expect(isDue(t, '2028-02-28')).toBe(false) // високосный: будет 29-го
    expect(isDue(t, '2028-02-29')).toBe(true)
    expect(isDue(t, '2027-04-30')).toBe(true)
    expect(isDue(t, '2027-04-29')).toBe(false)
  })
  it('раз в месяц 15-го', () => {
    const t = { ...base, repeat_kind: 'monthly', month_day: 15 }
    expect(isDue(t, '2026-11-15')).toBe(true)
    expect(isDue(t, '2026-11-14')).toBe(false)
  })
  it('удалённый шаблон и дата окончания', () => {
    expect(isDue({ ...base, repeat_kind: 'daily', archived_at: 'x' }, '2026-11-08')).toBe(false)
    expect(isDue({ ...base, repeat_kind: 'daily', end_date: '2026-11-05' }, '2026-11-08')).toBe(false)
  })
  it('описание', () => {
    expect(describeRepeat({ repeat_kind: 'weekdays', weekdays: [4, 1] })).toBe('пн, чт')
    expect(describeRepeat({ repeat_kind: 'every_n', every_n: 2 })).toBe('раз в 2 дня')
    expect(describeRepeat({ repeat_kind: 'every_n', every_n: 5 })).toBe('раз в 5 дней')
    expect(describeRepeat({ repeat_kind: 'every_n', every_n: 21 })).toBe('раз в 21 день')
  })
})
