// Всё время в приложении — ташкентское. «Рабочий день» начинается в 04:00,
// поэтому отметка в 00:30 при закрытии смены попадает во вчерашний день.
// Даты храним строками 'YYYY-MM-DD' — так не бывает сдвигов из-за часовых поясов.

export const TZ = 'Asia/Tashkent'
export const DAY_START_HOUR = 4

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Части даты в ташкентском времени. */
export function tzParts(date) {
  const p = {}
  for (const { type, value } of fmt.formatToParts(date)) p[type] = value
  return {
    y: +p.year,
    m: +p.month,
    d: +p.day,
    h: +p.hour === 24 ? 0 : +p.hour,
    min: +p.minute,
  }
}

const pad = (n) => String(n).padStart(2, '0')
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

/** Рабочая дата для момента времени. */
export function workDate(now = new Date()) {
  const p = tzParts(new Date(now.getTime() - DAY_START_HOUR * 3600_000))
  return ymd(p.y, p.m, p.d)
}

function toUTC(s) {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function fromUTC(t) {
  const x = new Date(t)
  return ymd(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate())
}

export function addDays(s, n) {
  return fromUTC(toUTC(s) + n * 86400_000)
}
export function daysBetween(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400_000)
}
/** 1 = понедельник … 7 = воскресенье */
export function weekday(s) {
  const w = new Date(toUTC(s)).getUTCDay()
  return w === 0 ? 7 : w
}
export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Смещение ташкентского времени от UTC в минутах для данного момента. */
function tzOffsetMin(date) {
  const p = tzParts(date)
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min)
  return Math.round((asUTC - Math.floor(date.getTime() / 60000) * 60000) / 60000)
}

/** Момент «к HH:MM» для рабочей даты. Время раньше 04:00 — это уже ночь после этой даты. */
export function dueMoment(dateStr, hhmm) {
  if (!dateStr || !hhmm) return null
  const [h, mi] = hhmm.split(':').map(Number)
  let day = dateStr
  if (h < DAY_START_HOUR) day = addDays(dateStr, 1)
  const [y, m, d] = day.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const off = tzOffsetMin(new Date(guess))
  return new Date(guess - off * 60000)
}

export function isOverdue(task, now = new Date()) {
  if (task.done_at || !task.due_time) return false
  const m = dueMoment(task.date, task.due_time)
  return m ? now > m : false
}

const WD_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
export const WEEKDAY_NAMES = WD_SHORT
const MONTHS_GEN = [
  '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

/** «Вс, 8 ноября» */
export function formatDayLong(s) {
  const [, m, d] = s.split('-').map(Number)
  return `${WD_SHORT[weekday(s)]}, ${d} ${MONTHS_GEN[m]}`
}
/** «08.11» */
export function formatDayShort(s) {
  const [, m, d] = s.split('-')
  return `${d}.${m}`
}
/** «09:12» по Ташкенту */
export function formatTime(iso) {
  if (!iso) return ''
  const p = tzParts(new Date(iso))
  return `${pad(p.h)}:${pad(p.min)}`
}
/** «HH:MM» из значения базы 'HH:MM:SS' */
export function shortTime(t) {
  return t ? t.slice(0, 5) : ''
}

/** Подпись дня относительно сегодняшнего. */
export function relativeDayLabel(s, today) {
  const diff = daysBetween(today, s)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Завтра'
  if (diff === -1) return 'Вчера'
  return formatDayLong(s)
}
