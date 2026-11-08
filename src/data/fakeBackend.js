// База в памяти для автопроверок и демо-режима. Повторяет правила настоящей:
// первая отметка выигрывает, удалённую задачу отметить нельзя, (template_id, date) уникальны.
import { newId } from '../lib/ids.js'
import { workDate, addDays } from '../lib/time.js'

const clone = (x) => JSON.parse(JSON.stringify(x))

export function demoSeed(today = workDate()) {
  const s = (name, sort) => ({ id: newId(), name, sort })
  const sec = [s('Утренние заготовки', 10), s('К открытию', 20), s('В течение дня', 30), s('Закрытие смены', 40)]
  const tpl = (title, si, extra = {}) => ({
    id: newId(), title, section_id: sec[si].id, qty: null, unit: null, due_time: null, note: null, sort: 0,
    repeat_kind: 'daily', weekdays: null, every_n: null, month_day: null, start_date: addDays(today, -10),
    end_date: null, archived_at: null, ...extra,
  })
  const templates = [
    tpl('Сварить бульон', 0, { qty: 10, unit: 'л', due_time: '09:00', note: 'Курица + кости, слабый огонь 3 часа' }),
    tpl('Нарезать лук', 0, { qty: 3, unit: 'кг', due_time: '10:00' }),
    tpl('Разморозить мясо', 0, { repeat_kind: 'weekdays', weekdays: [1, 2, 3, 4, 5, 6, 7], qty: 5, unit: 'кг' }),
    tpl('Замесить тесто для лаваша', 1, { qty: 4, unit: 'кг', due_time: '10:30' }),
    tpl('Проверить соусы', 1, { due_time: '11:00' }),
    tpl('Протереть столы', 2),
    tpl('Генеральная уборка', 3, { repeat_kind: 'every_n', every_n: 7, start_date: today }),
    tpl('Вынести мусор', 3, { due_time: '23:00' }),
  ]
  return {
    sections: sec,
    staff: [
      { id: newId(), name: 'Азиз', sort: 0, active: true },
      { id: newId(), name: 'Оля', sort: 1, active: true },
    ],
    templates,
    tasks: [
      {
        id: newId(), template_id: null, date: addDays(today, -1), title: 'Заказать овощи на неделю', section_id: sec[2].id,
        qty: null, unit: null, due_time: null, note: null, sort: 0, done_at: null, deleted_at: null,
      },
    ],
  }
}

export function createFakeBackend({ seed = demoSeed(), latency = 0, users = { admin: 'admin', kuhnya: 'admin' } } = {}) {
  const db = {
    sections: new Map(seed.sections.map((r) => [r.id, clone(r)])),
    staff: new Map(seed.staff.map((r) => [r.id, clone(r)])),
    templates: new Map(seed.templates.map((r) => [r.id, clone(r)])),
    tasks: new Map(seed.tasks.map((r) => [r.id, clone(r)])),
  }
  let session = null
  const authListeners = new Set()
  const listeners = new Set()
  const state = { offline: false, failNext: null }

  const wait = () => new Promise((r) => setTimeout(r, latency))
  async function gate() {
    if (latency) await wait()
    if (state.offline) throw new TypeError('Failed to fetch')
    if (state.failNext) {
      const e = state.failNext
      state.failNext = null
      throw e
    }
  }
  const emit = (table, type, row) => {
    for (const l of listeners) setTimeout(() => l(table, type, clone(row)), 0)
  }
  const now = () => new Date().toISOString()
  const upsert = (table, row) => {
    const prev = db[table].get(row.id)
    const next = { ...(prev || {}), ...clone(row), updated_at: now() }
    if (!prev) next.created_at = now()
    db[table].set(row.id, next)
    emit(table, prev ? 'UPDATE' : 'INSERT', next)
    return clone(next)
  }
  const taskDefaults = {
    done_at: null, done_by_staff: null, done_by_name: null, qty_done: null, deleted_at: null,
  }

  return {
    kind: 'fake',
    db,
    state,

    async getSession() {
      return session
    },
    onAuthChange(cb) {
      authListeners.add(cb)
      return () => authListeners.delete(cb)
    },
    async signIn(login, password) {
      await gate()
      const l = String(login).trim().toLowerCase()
      if (!users[l] || !password) throw { message: 'Invalid login credentials', status: 400 }
      session = { user: { id: 'user-' + l, email: l + '@donerka.local' } }
      for (const cb of authListeners) cb(session)
      return session
    },
    async signOut() {
      session = null
      for (const cb of authListeners) cb(null)
    },
    async getProfile(userId) {
      await gate()
      const login = userId.replace('user-', '')
      return { id: userId, login, role: users[login] || null }
    },
    async getSchemaVersion() {
      await gate()
      return 1
    },
    async fetchAll({ from }) {
      await gate()
      return {
        sections: [...db.sections.values()].map(clone),
        staff: [...db.staff.values()].map(clone),
        templates: [...db.templates.values()].filter((t) => !t.archived_at).map(clone),
        tasks: [...db.tasks.values()].filter((t) => t.date >= from).map(clone),
      }
    },
    async ensureTasks(rows) {
      await gate()
      const out = []
      for (const r of rows) {
        if (db.tasks.has(r.id)) continue
        const dup = [...db.tasks.values()].some((t) => r.template_id && t.template_id === r.template_id && t.date === r.date)
        if (dup) continue
        const { virtual: _v, carried: _c, ...clean } = r
        out.push(upsert('tasks', { ...taskDefaults, ...clean }))
      }
      return out
    },
    async exec(op) {
      await gate()
      switch (op.type) {
        case 'task.ensure': {
          await this.ensureTasks([op.row])
          const row = db.tasks.get(op.row.id)
          return { tasks: row ? [clone(row)] : [] }
        }
        case 'task.create': {
          const { virtual: _v, carried: _c, ...clean } = op.row
          return { tasks: [upsert('tasks', { ...taskDefaults, ...(db.tasks.get(op.row.id) || {}), ...clean })] }
        }
        case 'task.update': {
          const t = db.tasks.get(op.id)
          if (!t || t.deleted_at) throw { code: 'KT404', message: 'task_deleted' }
          return { tasks: [upsert('tasks', { ...t, ...op.patch })] }
        }
        case 'task.done': {
          const t = db.tasks.get(op.id)
          if (!t || t.deleted_at) throw { code: 'KT404', message: 'task_deleted' }
          if (op.done) {
            if (t.done_at) return { tasks: [clone(t)] }
            return {
              tasks: [upsert('tasks', {
                ...t, done_at: op.at, done_by_staff: op.staff_id ?? null, done_by_name: op.staff_name ?? null,
                qty_done: op.qty_done ?? null,
              })],
            }
          }
          return { tasks: [upsert('tasks', { ...t, done_at: null, done_by_staff: null, done_by_name: null, qty_done: null })] }
        }
        case 'task.delete': {
          const t = db.tasks.get(op.id)
          if (!t) return { tasks: [] }
          return { tasks: [upsert('tasks', { ...t, deleted_at: now() })] }
        }
        case 'template.save': {
          const r = op.row
          if (!r.title?.trim()) throw { code: '23514', message: 'violates check constraint "templates_title_check"' }
          return { templates: [upsert('templates', { archived_at: null, ...(db.templates.get(r.id) || {}), ...r })] }
        }
        case 'template.archive': {
          const tpl = db.templates.get(op.id)
          if (tpl) upsert('templates', { ...tpl, archived_at: now() })
          const tasks = []
          for (const t of db.tasks.values()) {
            if (t.template_id === op.id && !t.done_at && !t.deleted_at) tasks.push(upsert('tasks', { ...t, deleted_at: now() }))
          }
          return { tasks, removeTemplates: [op.id] }
        }
        case 'section.save':
          return { sections: [upsert('sections', op.row)] }
        case 'section.delete':
          db.sections.delete(op.id)
          emit('sections', 'DELETE', { id: op.id })
          return { removeSections: [op.id] }
        case 'staff.save':
          return { staff: [upsert('staff', { active: true, sort: 0, ...(db.staff.get(op.row.id) || {}), ...op.row })] }
        default:
          throw new Error('unknown op ' + op.type)
      }
    },
    subscribe(onChange, onStatus) {
      listeners.add(onChange)
      setTimeout(() => onStatus?.('SUBSCRIBED'), 0)
      return () => listeners.delete(onChange)
    },
    /** Имитация изменения с «другого устройства». */
    remote(table, row) {
      return upsert(table, row)
    },
  }
}
