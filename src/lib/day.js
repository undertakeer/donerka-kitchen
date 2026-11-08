import { isDue } from './schedule.js'
import { instanceId } from './ids.js'
import { addDays, workDate } from './time.js'

/** Насколько далеко назад ищем несделанное для переноса. */
export const CARRY_WINDOW_DAYS = 60

export function taskFromTemplate(tpl, date) {
  return {
    id: instanceId(tpl.id, date),
    template_id: tpl.id,
    date,
    title: tpl.title,
    section_id: tpl.section_id ?? null,
    qty: tpl.qty ?? null,
    unit: tpl.unit ?? null,
    due_time: tpl.due_time ?? null,
    note: tpl.note ?? null,
    sort: tpl.sort ?? 0,
    done_at: null,
    done_by_staff: null,
    done_by_name: null,
    qty_done: null,
    deleted_at: null,
  }
}

/**
 * Собирает список задач на день `date`.
 *
 * - Реальные записи на этот день (кроме удалённых).
 * - Для сегодня и будущего — «виртуальные» задачи из шаблонов, у которых ещё нет записи.
 *   Если запись есть (даже удалённая) — шаблон не добавляется повторно:
 *   удалённая сегодня повторяющаяся задача не воскресает.
 * - Для сегодня — хвосты: несделанное с прошлых дней с пометкой carried.
 *   У повторяющейся задачи переносится только самый свежий хвост.
 * - Для сегодня — хвосты, закрытые сегодня, попадают в «Сделано».
 */
export function buildDay(view, date, today) {
  const tasks = Object.values(view.tasks || {})
  const templates = Object.values(view.templates || {})
  const items = []
  const existing = new Set()
  for (const t of tasks) {
    if (t.template_id) existing.add(`${t.template_id}|${t.date}`)
    if (t.date === date && !t.deleted_at) items.push(t)
  }

  if (date >= today) {
    for (const tpl of templates) {
      if (isDue(tpl, date) && !existing.has(`${tpl.id}|${date}`)) {
        items.push({ ...taskFromTemplate(tpl, date), virtual: true })
      }
    }
  }

  if (date === today) {
    const from = addDays(today, -CARRY_WINDOW_DAYS)
    const latestTail = new Map()
    for (const t of tasks) {
      if (t.deleted_at || t.date >= today || t.date < from) continue
      if (t.done_at) {
        if (workDate(new Date(t.done_at)) === today) items.push({ ...t, carried: true })
        continue
      }
      if (t.template_id) {
        const prev = latestTail.get(t.template_id)
        if (!prev || prev.date < t.date) latestTail.set(t.template_id, t)
      } else {
        items.push({ ...t, carried: true })
      }
    }
    for (const t of latestTail.values()) items.push({ ...t, carried: true })
  }
  return items
}

/** Хвосты повторяющихся задач, которые «потерялись», потому что есть более свежий хвост. */
export function missedTemplateTasks(view, today) {
  const tasks = Object.values(view.tasks || {})
  const latest = new Map()
  for (const t of tasks) {
    if (!t.template_id || t.deleted_at || t.done_at || t.date >= today) continue
    const p = latest.get(t.template_id)
    if (!p || p.date < t.date) latest.set(t.template_id, t)
  }
  return tasks.filter(
    (t) => t.template_id && !t.deleted_at && !t.done_at && t.date < today && latest.get(t.template_id)?.id !== t.id,
  )
}

function cmpTasks(a, b) {
  if (!!a.carried !== !!b.carried) return a.carried ? -1 : 1
  const at = a.due_time || '99', bt = b.due_time || '99'
  if (at !== bt) return at < bt ? -1 : 1
  if ((a.sort ?? 0) !== (b.sort ?? 0)) return (a.sort ?? 0) - (b.sort ?? 0)
  return (a.title || '').localeCompare(b.title || '', 'ru')
}

export const NO_SECTION = { id: '__none', name: 'Без раздела', sort: 1e9 }

/** Открытые задачи по разделам (в порядке разделов) + список сделанного + прогресс. */
export function groupDay(items, sectionsMap) {
  const sections = Object.values(sectionsMap || {}).sort((a, b) => a.sort - b.sort)
  const open = items.filter((t) => !t.done_at)
  const done = items
    .filter((t) => t.done_at)
    .sort((a, b) => (a.done_at < b.done_at ? 1 : a.done_at > b.done_at ? -1 : 0))
  const bySection = new Map()
  for (const t of open) {
    const key = t.section_id && sectionsMap?.[t.section_id] ? t.section_id : NO_SECTION.id
    if (!bySection.has(key)) bySection.set(key, [])
    bySection.get(key).push(t)
  }
  const groups = []
  for (const s of [...sections, NO_SECTION]) {
    const list = bySection.get(s.id)
    if (list?.length) groups.push({ section: s, items: list.sort(cmpTasks) })
  }
  return { groups, done, total: items.length, doneCount: done.length }
}
