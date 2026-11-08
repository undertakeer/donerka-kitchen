import { EMPTY_BASE, applyQueue, applyOp, enqueue, dropWithDependents, pendingCount } from '../lib/ops.js'
import { classifyError, EXPECTED_SCHEMA, migrationHint } from '../lib/errors.js'
import { newId } from '../lib/ids.js'
import { workDate, addDays } from '../lib/time.js'
import { isDue } from '../lib/schedule.js'
import { taskFromTemplate, CARRY_WINDOW_DAYS } from '../lib/day.js'

const DEVICE_KEY = 'kitchen-device-v1'
const cacheKey = (uid) => `kitchen-cache-v1:${uid}`

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* переполнение или приватный режим — работаем без кэша */
  }
}
function removeKey(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

const toMap = (rows) => Object.fromEntries((rows || []).map((r) => [r.id, r]))

export function createStore(backend, { storage = true } = {}) {
  const device = readJSON(DEVICE_KEY, {})
  let state = {
    status: 'init', // init | signedOut | ready
    session: null,
    profile: null,
    base: EMPTY_BASE,
    queue: [],
    loaded: false,
    connection: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unknown',
    lastSyncAt: null,
    schemaProblem: null,
    accessProblem: null,
    toasts: [],
    staffId: device.staffId || null,
    navAdjust: Number(device.navAdjust) || 0,
    theme: device.theme || 'light',
    now: new Date(),
  }
  const listeners = new Set()
  let inFlightOpId = null
  let unsubRealtime = null
  let retryTimer = null
  let viewCache = { base: null, queue: null, view: null }

  function set(patch) {
    state = { ...state, ...patch }
    if (storage && state.session && ('base' in patch || 'queue' in patch || 'profile' in patch)) {
      writeJSON(cacheKey(state.session.user.id), {
        base: state.base,
        queue: state.queue,
        profile: state.profile,
        lastSyncAt: state.lastSyncAt,
      })
    }
    if ('staffId' in patch || 'navAdjust' in patch || 'theme' in patch) {
      writeJSON(DEVICE_KEY, { staffId: state.staffId, navAdjust: state.navAdjust, theme: state.theme })
    }
    for (const l of listeners) l()
  }

  function getView() {
    if (viewCache.base !== state.base || viewCache.queue !== state.queue) {
      viewCache = { base: state.base, queue: state.queue, view: applyQueue(state.base, state.queue) }
    }
    return viewCache.view
  }

  const today = () => workDate(state.now)

  // ---------- тосты ----------
  function toast(message, kind = 'error') {
    if (state.toasts.some((t) => t.message === message)) return
    const id = newId()
    set({ toasts: [...state.toasts, { id, message, kind }] })
    if (kind !== 'error') setTimeout(() => dismissToast(id), 3500)
  }
  function dismissToast(id) {
    set({ toasts: state.toasts.filter((t) => t.id !== id) })
  }

  // ---------- слияние ответов базы ----------
  function mergeResult(base, res) {
    if (!res) return base
    let b = base
    if (res.tasks?.length) b = { ...b, tasks: { ...b.tasks, ...toMap(res.tasks.filter(Boolean)) } }
    if (res.templates?.length) {
      const templates = { ...b.templates }
      for (const t of res.templates) {
        if (t.archived_at) delete templates[t.id]
        else templates[t.id] = t
      }
      b = { ...b, templates }
    }
    if (res.removeTemplates?.length) {
      const templates = { ...b.templates }
      for (const id of res.removeTemplates) delete templates[id]
      b = { ...b, templates }
    }
    if (res.sections?.length) b = { ...b, sections: { ...b.sections, ...toMap(res.sections) } }
    if (res.removeSections?.length) {
      const sections = { ...b.sections }
      for (const id of res.removeSections) delete sections[id]
      b = { ...b, sections }
    }
    if (res.staff?.length) b = { ...b, staff: { ...b.staff, ...toMap(res.staff) } }
    return b
  }

  function onRealtime(table, type, row) {
    if (!row?.id) return
    if (type === 'DELETE') {
      if (table === 'sections') set({ base: mergeResult(state.base, { removeSections: [row.id] }) })
      return
    }
    set({ base: mergeResult(state.base, { [table]: [row] }) })
  }

  // ---------- очередь ----------
  function push(op) {
    op = { opId: newId(), ts: new Date().toISOString(), ...op }
    const q = enqueue(state.queue, op, state.base, inFlightOpId)
    if (q !== state.queue) set({ queue: q })
  }

  function scheduleRetry(ms = 15000) {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => flush(), ms)
  }

  let flushPromise = null
  function flush() {
    if (flushPromise) return flushPromise
    if (state.status !== 'ready') return Promise.resolve()
    flushPromise = doFlush().finally(() => {
      flushPromise = null
    })
    return flushPromise
  }

  async function doFlush() {
    let rejected = false
    try {
      while (state.queue.length) {
        const op = state.queue[0]
        inFlightOpId = op.opId
        try {
          const res = await backend.exec(op)
          set({
            base: mergeResult(state.base, res),
            queue: state.queue.filter((o) => o.opId !== op.opId),
            connection: 'ok',
            lastSyncAt: new Date().toISOString(),
          })
        } catch (err) {
          const c = classifyError(err)
          if (c.kind === 'network') {
            set({ connection: 'offline' })
            scheduleRetry()
            break
          }
          // База отказала: убираем действие — экран вернётся к тому, что в базе.
          set({ queue: dropWithDependents(state.queue, op) })
          rejected = true
          if (c.kind === 'schema') set({ schemaProblem: c.message })
          toast(c.message)
        }
      }
    } finally {
      inFlightOpId = null
    }
    // после отказа перечитываем базу, чтобы экран точно совпадал с ней
    if (rejected) setTimeout(() => refresh(), 0)
  }

  // ---------- загрузка ----------
  async function refresh() {
    if (state.status !== 'ready') return
    try {
      const profile = await backend.getProfile(state.session.user.id)
      if (!profile?.role) {
        set({
          profile,
          accessProblem:
            'У этого аккаунта нет доступа. Логин должен быть в таблице allowed_logins (см. инструкцию), затем прогоните supabase/schema.sql ещё раз.',
        })
        return
      }
      let version = 0
      try {
        version = await backend.getSchemaVersion()
      } catch (e) {
        const c = classifyError(e)
        if (c.kind !== 'schema') throw e
      }
      if (version < EXPECTED_SCHEMA) {
        set({
          profile,
          schemaProblem: `База отстала от приложения (версия базы ${version}, нужна ${EXPECTED_SCHEMA}). Откройте Supabase → SQL Editor и прогоните: ${migrationHint(version).join(', ')}.`,
        })
        return
      }
      const from = addDays(today(), -CARRY_WINDOW_DAYS - 1)
      const data = await backend.fetchAll({ from })
      const templates = {}
      for (const t of data.templates) if (!t.archived_at) templates[t.id] = t
      set({
        profile,
        accessProblem: null,
        schemaProblem: null,
        base: {
          sections: toMap(data.sections),
          staff: toMap(data.staff),
          templates,
          tasks: toMap(data.tasks),
        },
        loaded: true,
        connection: 'ok',
        lastSyncAt: new Date().toISOString(),
      })
      await ensureToday()
      flush()
    } catch (err) {
      const c = classifyError(err)
      if (c.kind === 'network') {
        set({ connection: 'offline' })
        scheduleRetry(20000)
      } else if (c.kind === 'schema') {
        set({ schemaProblem: c.message })
      } else {
        set({ connection: 'error' })
        toast(c.message)
      }
    }
  }

  /** Создаёт в базе сегодняшние задачи из шаблонов (одинаковые id на всех устройствах — дублей нет). */
  async function ensureToday() {
    const d = today()
    const view = getView()
    const have = new Set(Object.values(view.tasks).filter((t) => t.template_id).map((t) => `${t.template_id}|${t.date}`))
    const rows = Object.values(view.templates)
      .filter((t) => isDue(t, d) && !have.has(`${t.id}|${d}`))
      .map((t) => taskFromTemplate(t, d))
    if (!rows.length) return
    try {
      const created = await backend.ensureTasks(rows)
      set({ base: mergeResult(state.base, { tasks: created }) })
    } catch (err) {
      const c = classifyError(err)
      if (c.kind === 'network') set({ connection: 'offline' })
      // иначе молча: задачи и так видны из шаблонов, создадутся при отметке
    }
  }

  function startSession(session) {
    const cached = storage ? readJSON(cacheKey(session.user.id), null) : null
    set({
      status: 'ready',
      session,
      profile: cached?.profile || null,
      base: cached?.base || EMPTY_BASE,
      queue: cached?.queue || [],
      loaded: !!cached?.base,
      lastSyncAt: cached?.lastSyncAt || null,
    })
    unsubRealtime?.()
    let wasSubscribed = false
    unsubRealtime = backend.subscribe(onRealtime, (status) => {
      if (status === 'SUBSCRIBED') {
        if (wasSubscribed) refresh() // переподключились — догоняем пропущенное
        wasSubscribed = true
      }
    })
    refresh()
  }

  function endSession() {
    unsubRealtime?.()
    unsubRealtime = null
    set({ status: 'signedOut', session: null, profile: null, base: EMPTY_BASE, queue: [], loaded: false })
  }

  async function init() {
    let session = null
    try {
      session = await backend.getSession()
    } catch {
      session = null
    }
    if (session) startSession(session)
    else set({ status: 'signedOut' })
    backend.onAuthChange?.((s) => {
      if (!s && state.status === 'ready') endSession()
    })
  }

  // ---------- действия ----------
  const nowIso = () => new Date().toISOString()

  function staffInfo() {
    const s = state.staffId ? getView().staff[state.staffId] : null
    return s && s.active !== false ? { staff_id: s.id, staff_name: s.name } : null
  }

  function ensureReal(task) {
    const known = state.base.tasks[task.id] || state.queue.some((o) => o.row?.id === task.id)
    if (task.virtual || !known) {
      const { virtual: _v, carried: _c, ...row } = task
      push({ type: 'task.ensure', row })
    }
  }

  const actions = {
    init,
    refresh,
    flush,
    toast,
    dismissToast,

    async signIn(login, password) {
      const session = await backend.signIn(login, password)
      startSession(session)
    },
    async signOut() {
      if (storage && state.session) removeKey(cacheKey(state.session.user.id))
      await backend.signOut()
      endSession()
    },

    /** Отметить/снять. Возвращает 'need-staff', если не выбран сотрудник. */
    toggleDone(task, { qtyDone = null } = {}) {
      const who = staffInfo()
      const done = !task.done_at
      if (done && !who) return 'need-staff'
      ensureReal(task)
      push({ type: 'task.done', id: task.id, done, at: nowIso(), qty_done: done ? qtyDone : null, ...(who || {}) })
      flush()
      return 'ok'
    },
    setQtyDone(task, qtyDone) {
      if (!task.done_at) return actions.toggleDone(task, { qtyDone })
      push({ type: 'task.update', id: task.id, patch: { qty_done: qtyDone } })
      flush()
      return 'ok'
    },
    createTask(fields) {
      const row = {
        id: newId(), template_id: null, sort: 0, qty: null, unit: null, due_time: null, note: null, section_id: null,
        done_at: null, deleted_at: null, ...fields,
      }
      push({ type: 'task.create', row })
      flush()
      return row
    },
    updateTask(task, patch) {
      ensureReal(task)
      push({ type: 'task.update', id: task.id, patch })
      flush()
    },
    deleteTask(task) {
      ensureReal(task)
      push({ type: 'task.delete', id: task.id, at: nowIso() })
      flush()
    },
    saveTemplate(row, { applyToday = false } = {}) {
      const id = row.id || newId()
      push({ type: 'template.save', row: { ...row, id } })
      if (applyToday) {
        const d = today()
        const t = Object.values(getView().tasks).find((x) => x.template_id === id && x.date === d && !x.deleted_at)
        if (t && !t.done_at) {
          const { title, section_id, qty, unit, due_time, note } = row
          push({ type: 'task.update', id: t.id, patch: { title, section_id, qty, unit, due_time, note } })
        }
      }
      flush()
      return id
    },
    archiveTemplate(id) {
      push({ type: 'template.archive', id, at: nowIso(), from: addDays(today(), -CARRY_WINDOW_DAYS - 1) })
      flush()
    },
    saveSection(row) {
      const id = row.id || newId()
      const sort = row.sort ?? Math.max(0, ...Object.values(getView().sections).map((s) => s.sort)) + 10
      push({ type: 'section.save', row: { ...row, id, sort } })
      flush()
      return id
    },
    deleteSection(id) {
      push({ type: 'section.delete', id })
      flush()
    },
    moveSection(id, dir) {
      const list = Object.values(getView().sections).sort((a, b) => a.sort - b.sort)
      const i = list.findIndex((s) => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return
      // перенумеровываем все, чтобы не было одинаковых sort
      const order = [...list]
      ;[order[i], order[j]] = [order[j], order[i]]
      order.forEach((s, k) => {
        if (s.sort !== (k + 1) * 10) push({ type: 'section.save', row: { id: s.id, name: s.name, sort: (k + 1) * 10 } })
      })
      flush()
    },
    saveStaff(row) {
      const id = row.id || newId()
      const sort = row.sort ?? Object.keys(getView().staff).length
      push({ type: 'staff.save', row: { active: true, ...row, id, sort } })
      flush()
      return id
    },
    setStaff(staffId) {
      set({ staffId })
    },
    setNavAdjust(px) {
      set({ navAdjust: Math.max(-40, Math.min(60, Math.round(px))) })
    },
    setTheme(theme) {
      set({ theme })
    },
    tick(now = new Date()) {
      const before = today()
      set({ now })
      if (today() !== before && state.status === 'ready') ensureToday()
    },
    setConnection(connection) {
      set({ connection })
    },
  }

  return {
    getState: () => state,
    getView,
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    pending: () => pendingCount(state.queue),
    today,
    actions,
    _applyOp: applyOp,
  }
}
