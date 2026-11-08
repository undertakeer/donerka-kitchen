// Очередь изменений.
//
// Экран всегда показывает: «что подтвердила база» + «что ещё ждёт отправки».
// Если база отказала — действие просто убирается из очереди, и экран
// сам возвращается к тому, что лежит в базе. Поэтому интерфейс не может
// показывать одно, когда в базе другое (кроме честно ожидающих отправки отметок).

export const EMPTY_BASE = { sections: {}, staff: {}, templates: {}, tasks: {} }

const put = (map, row) => ({ ...map, [row.id]: row })

export function applyOp(s, op) {
  switch (op.type) {
    case 'task.ensure':
      return s.tasks[op.row.id] ? s : { ...s, tasks: put(s.tasks, op.row) }
    case 'task.create':
      return { ...s, tasks: put(s.tasks, { ...(s.tasks[op.row.id] || {}), ...op.row }) }
    case 'task.update': {
      const t = s.tasks[op.id]
      return t ? { ...s, tasks: put(s.tasks, { ...t, ...op.patch }) } : s
    }
    case 'task.done': {
      const t = s.tasks[op.id]
      if (!t) return s
      if (op.done) {
        if (t.done_at) return s // первая отметка выигрывает
        return {
          ...s,
          tasks: put(s.tasks, {
            ...t,
            done_at: op.at,
            done_by_staff: op.staff_id ?? null,
            done_by_name: op.staff_name ?? null,
            qty_done: op.qty_done ?? null,
          }),
        }
      }
      return {
        ...s,
        tasks: put(s.tasks, { ...t, done_at: null, done_by_staff: null, done_by_name: null, qty_done: null }),
      }
    }
    case 'task.delete': {
      const t = s.tasks[op.id]
      return t ? { ...s, tasks: put(s.tasks, { ...t, deleted_at: op.at }) } : s
    }
    case 'template.save':
      return { ...s, templates: put(s.templates, { ...(s.templates[op.row.id] || {}), ...op.row }) }
    case 'template.archive': {
      const tpl = s.templates[op.id]
      const tasks = { ...s.tasks }
      for (const t of Object.values(s.tasks)) {
        if (t.template_id === op.id && !t.done_at && !t.deleted_at) tasks[t.id] = { ...t, deleted_at: op.at }
      }
      return {
        ...s,
        tasks,
        templates: tpl ? put(s.templates, { ...tpl, archived_at: op.at }) : s.templates,
      }
    }
    case 'section.save':
      return { ...s, sections: put(s.sections, { ...(s.sections[op.row.id] || {}), ...op.row }) }
    case 'section.delete': {
      const sections = { ...s.sections }
      delete sections[op.id]
      return { ...s, sections }
    }
    case 'staff.save':
      return { ...s, staff: put(s.staff, { ...(s.staff[op.row.id] || {}), ...op.row }) }
    default:
      return s
  }
}

export function applyQueue(base, queue) {
  let s = base
  for (const op of queue) s = applyOp(s, op)
  return s
}

/**
 * Добавляет действие в очередь, схлопывая лишнее:
 * - несколько «отметил/снял» по одной задаче → остаётся последнее;
 * - если итог совпадает с тем, что уже в базе, — действие не нужно вовсе.
 * lockedOpId — действие, которое прямо сейчас летит в базу: его не трогаем,
 * а новые действия по той же задаче просто ставим следом.
 */
export function enqueue(queue, op, base, lockedOpId = null) {
  if (op.type === 'task.done') {
    const locked = lockedOpId && queue.some((o) => o.opId === lockedOpId && (o.id === op.id || o.row?.id === op.id))
    if (locked) return [...queue, op]
    const rest = queue.filter((o) => !(o.type === 'task.done' && o.id === op.id))
    const inBase = base.tasks[op.id]
    const pendingCreate = rest.some((o) => (o.type === 'task.ensure' || o.type === 'task.create') && o.row.id === op.id)
    if (inBase && !pendingCreate && !!inBase.done_at === !!op.done) return rest
    return [...rest, op]
  }
  if (op.type === 'task.ensure' && queue.some((o) => o.type === 'task.ensure' && o.row.id === op.row.id)) {
    return queue
  }
  return [...queue, op]
}

/** После отказа базы убираем и зависимые действия (например, отметку по несозданной задаче). */
export function dropWithDependents(queue, failed) {
  const id = failed.row?.id ?? failed.id
  const isCreate = failed.type === 'task.ensure' || failed.type === 'task.create'
  return queue.filter((o) => {
    if (o.opId === failed.opId) return false
    if (isCreate && (o.id === id || o.row?.id === id)) return false
    return true
  })
}

/** Сколько отметок/правок ждут отправки — для индикатора. */
export function pendingCount(queue) {
  return queue.filter((o) => o.type !== 'task.ensure').length
}
