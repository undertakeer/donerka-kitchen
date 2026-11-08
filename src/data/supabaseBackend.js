import { createClient } from '@supabase/supabase-js'

export const LOGIN_DOMAIN = 'donerka.local'
export const loginToEmail = (login) => `${String(login).trim().toLowerCase()}@${LOGIN_DOMAIN}`

const TASK_COLS = [
  'id', 'template_id', 'date', 'title', 'section_id', 'qty', 'unit', 'due_time', 'note', 'sort',
]
const TEMPLATE_COLS = [
  'id', 'title', 'section_id', 'qty', 'unit', 'due_time', 'note', 'sort', 'repeat_kind',
  'weekdays', 'every_n', 'month_day', 'start_date', 'end_date',
]
const pick = (row, cols) => Object.fromEntries(cols.filter((c) => c in row).map((c) => [c, row[c]]))

function check({ data, error }) {
  if (error) throw error
  return data
}

export function createSupabaseBackend(url, key) {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kitchen-auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  })

  return {
    kind: 'supabase',

    async getSession() {
      const { data } = await sb.auth.getSession()
      return data.session ? { user: { id: data.session.user.id, email: data.session.user.email } } : null
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => {
        cb(session ? { user: { id: session.user.id, email: session.user.email } } : null)
      })
      return () => data.subscription.unsubscribe()
    },
    async signIn(login, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: loginToEmail(login), password })
      if (error) throw error
      return { user: { id: data.user.id, email: data.user.email } }
    },
    async signOut() {
      await sb.auth.signOut({ scope: 'local' })
    },

    async getProfile(userId) {
      return check(await sb.from('profiles').select('id, login, role').eq('id', userId).maybeSingle())
    },
    async getSchemaVersion() {
      const row = check(await sb.from('app_meta').select('value').eq('key', 'schema_version').maybeSingle())
      return row ? Number(row.value) : 0
    },

    async fetchAll({ from }) {
      const [sections, staff, templates, tasks] = await Promise.all([
        sb.from('sections').select('*').order('sort'),
        sb.from('staff').select('*').order('sort'),
        sb.from('templates').select('*').is('archived_at', null),
        sb.from('tasks').select('*').gte('date', from).limit(10000),
      ])
      return {
        sections: check(sections),
        staff: check(staff),
        templates: check(templates),
        tasks: check(tasks),
      }
    },

    async ensureTasks(rows) {
      if (!rows.length) return []
      return check(
        await sb.from('tasks').upsert(rows.map((r) => pick(r, TASK_COLS)), { onConflict: 'id', ignoreDuplicates: true }).select(),
      )
    },

    /** Выполняет одно действие из очереди. Возвращает строки для обновления локальной копии. */
    async exec(op) {
      switch (op.type) {
        case 'task.ensure': {
          await this.ensureTasks([op.row])
          const row = check(await sb.from('tasks').select('*').eq('id', op.row.id).maybeSingle())
          return { tasks: row ? [row] : [] }
        }
        case 'task.create':
          return { tasks: check(await sb.from('tasks').upsert(pick(op.row, TASK_COLS), { onConflict: 'id' }).select()) }
        case 'task.update': {
          const row = check(
            await sb.from('tasks').update(op.patch).eq('id', op.id).is('deleted_at', null).select().maybeSingle(),
          )
          if (!row) throw { code: 'KT404', message: 'task_deleted' }
          return { tasks: [row] }
        }
        case 'task.done': {
          const row = check(
            await sb.rpc('set_task_done', {
              p_id: op.id,
              p_done: op.done,
              p_at: op.at,
              p_staff_id: op.staff_id ?? null,
              p_staff_name: op.staff_name ?? null,
              p_qty_done: op.qty_done ?? null,
            }),
          )
          return { tasks: [row] }
        }
        case 'task.delete':
          return {
            tasks: check(await sb.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', op.id).select()),
          }
        case 'template.save':
          return {
            templates: check(await sb.from('templates').upsert(pick(op.row, TEMPLATE_COLS), { onConflict: 'id' }).select()),
          }
        case 'template.archive': {
          check(await sb.rpc('archive_template', { p_id: op.id }))
          const tasks = check(await sb.from('tasks').select('*').eq('template_id', op.id).gte('date', op.from))
          return { tasks, removeTemplates: [op.id] }
        }
        case 'section.save':
          return {
            sections: check(
              await sb.from('sections').upsert({ id: op.row.id, name: op.row.name, sort: op.row.sort }, { onConflict: 'id' }).select(),
            ),
          }
        case 'section.delete':
          check(await sb.from('sections').delete().eq('id', op.id))
          return { removeSections: [op.id] }
        case 'staff.save':
          return {
            staff: check(
              await sb.from('staff').upsert(
                { id: op.row.id, name: op.row.name, sort: op.row.sort ?? 0, active: op.row.active ?? true },
                { onConflict: 'id' },
              ).select(),
            ),
          }
        default:
          throw new Error('Неизвестное действие ' + op.type)
      }
    },

    subscribe(onChange, onStatus) {
      const ch = sb.channel('kitchen-db')
      for (const table of ['tasks', 'templates', 'sections', 'staff']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => {
          onChange(table, p.eventType, p.eventType === 'DELETE' ? p.old : p.new)
        })
      }
      ch.subscribe((status) => onStatus?.(status))
      return () => sb.removeChannel(ch)
    },
  }
}
