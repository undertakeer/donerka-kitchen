import { weekday, daysBetween, daysInMonth } from './time.js'

export const REPEAT_KINDS = [
  { id: 'daily', label: 'Каждый день' },
  { id: 'weekdays', label: 'По дням недели' },
  { id: 'every_n', label: 'Раз в N дней' },
  { id: 'monthly', label: 'Раз в месяц' },
]

/** Должен ли шаблон попасть в день `date` ('YYYY-MM-DD'). */
export function isDue(t, date) {
  if (!t || t.archived_at) return false
  if (t.start_date && date < t.start_date) return false
  if (t.end_date && date > t.end_date) return false
  switch (t.repeat_kind) {
    case 'daily':
      return true
    case 'weekdays':
      return Array.isArray(t.weekdays) && t.weekdays.includes(weekday(date))
    case 'every_n': {
      const n = Math.max(1, Math.floor(Number(t.every_n) || 1))
      if (!t.start_date) return false
      const diff = daysBetween(t.start_date, date)
      return diff >= 0 && diff % n === 0
    }
    case 'monthly': {
      const [y, m, d] = date.split('-').map(Number)
      const want = Math.max(1, Math.min(31, Math.floor(Number(t.month_day) || 1)))
      // 31-е в коротком месяце = последний день месяца
      return d === Math.min(want, daysInMonth(y, m))
    }
    default:
      return false
  }
}

const WD = ['', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

/** Человеческое описание расписания. */
export function describeRepeat(t) {
  switch (t.repeat_kind) {
    case 'daily':
      return 'каждый день'
    case 'weekdays': {
      const w = [...(t.weekdays || [])].sort((a, b) => a - b)
      if (w.length === 7) return 'каждый день'
      if (w.length === 0) return 'дни не выбраны'
      return w.map((x) => WD[x]).join(', ')
    }
    case 'every_n': {
      const n = Number(t.every_n) || 1
      return n === 1 ? 'каждый день' : `раз в ${n} ${plural(n, 'день', 'дня', 'дней')}`
    }
    case 'monthly':
      return `каждый месяц, ${t.month_day}-го`
    default:
      return ''
  }
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}
