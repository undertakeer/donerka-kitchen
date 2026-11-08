import { useMemo, useState } from 'react'
import { useStore } from '../data/StoreContext.jsx'
import { Button, Empty, ScreenHeader } from '../ui/kit.jsx'
import { IconPlus, IconClock } from '../ui/icons.jsx'
import { describeRepeat } from '../lib/schedule.js'
import { qtyLabel } from '../lib/qty.js'
import { shortTime, relativeDayLabel, addDays } from '../lib/time.js'
import { NO_SECTION } from '../lib/day.js'
import { TemplateEditSheet } from '../sheets/TemplateEditSheet.jsx'
import { TaskEditSheet } from '../sheets/TaskEditSheet.jsx'
import { TaskSheet } from '../sheets/TaskSheet.jsx'
import { useShell } from '../App.jsx'

export function TemplatesScreen() {
  const { state, view, store, actions } = useStore()
  const shell = useShell()
  const today = store.today()
  const isAdmin = state.profile?.role === 'admin'
  const [editTpl, setEditTpl] = useState(null) // null | 'new' | template
  const [newTask, setNewTask] = useState(false)
  const [openId, setOpenId] = useState(null)

  const groups = useMemo(() => {
    const secs = [...Object.values(view.sections).sort((a, b) => a.sort - b.sort), NO_SECTION]
    const tpls = Object.values(view.templates).filter((t) => !t.archived_at)
    return secs
      .map((s) => ({
        section: s,
        items: tpls
          .filter((t) => (t.section_id && view.sections[t.section_id] ? t.section_id : NO_SECTION.id) === s.id)
          .sort((a, b) => (a.due_time || '99').localeCompare(b.due_time || '99') || a.title.localeCompare(b.title, 'ru')),
      }))
      .filter((g) => g.items.length)
  }, [view.templates, view.sections])

  const future = useMemo(
    () =>
      Object.values(view.tasks)
        .filter((t) => !t.template_id && !t.deleted_at && t.date > today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.due_time || '99').localeCompare(b.due_time || '99')),
    [view.tasks, today],
  )

  return (
    <div data-testid="screen-templates">
      <ScreenHeader title="Задачи" />

      <h2 className="mb-2 px-1 text-xl font-bold">Повторяющиеся</h2>
      {isAdmin && (
        <Button className="mb-4 w-full" onClick={() => setEditTpl('new')} data-testid="add-template">
          <IconPlus /> Новая повторяющаяся
        </Button>
      )}
      {groups.length === 0 && <Empty>Пока нет повторяющихся задач. Например: «Сварить бульон — каждый день».</Empty>}
      {groups.map(({ section, items }) => (
        <section key={section.id} className="mb-5">
          <h3 className="mb-2 px-1 text-lg font-bold uppercase tracking-wide text-muted">{section.name}</h3>
          <div className="flex flex-col gap-2">
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid="template-row"
                onClick={() => setEditTpl(t)}
                className="min-w-0 rounded-3xl bg-surface px-5 py-4 text-left"
              >
                <div className="break-words text-xl font-semibold">{t.title}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-base text-muted">
                  <span className="font-semibold text-brand">{describeRepeat(t)}</span>
                  {t.qty !== null && t.qty !== undefined && <span className="font-bold text-ink">{qtyLabel(t.qty, t.unit)}</span>}
                  {t.due_time && (
                    <span className="flex items-center gap-1">
                      <IconClock /> к {shortTime(t.due_time)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      <h2 className="mt-8 mb-2 px-1 text-xl font-bold">Разовые на будущие дни</h2>
      <Button variant="secondary" className="mb-4 w-full" onClick={() => setNewTask(true)}>
        <IconPlus /> Разовая задача
      </Button>
      {future.length === 0 && <Empty>Нет. Например: «На завтра — подготовить банкет на 40 человек».</Empty>}
      <div className="flex flex-col gap-2">
        {future.map((t) => (
          <button key={t.id} type="button" onClick={() => setOpenId(t.id)} className="min-w-0 rounded-3xl bg-surface px-5 py-4 text-left">
            <div className="break-words text-xl font-semibold">{t.title}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-base text-muted">
              <span className="font-semibold text-brand">{relativeDayLabel(t.date, today)}</span>
              {t.qty !== null && t.qty !== undefined && <span className="font-bold text-ink">{qtyLabel(t.qty, t.unit)}</span>}
              {t.due_time && <span>к {shortTime(t.due_time)}</span>}
            </div>
          </button>
        ))}
      </div>

      <TemplateEditSheet
        key={editTpl === 'new' ? 'new' : editTpl?.id}
        open={!!editTpl}
        template={editTpl === 'new' ? null : editTpl}
        onClose={() => setEditTpl(null)}
      />
      <TaskEditSheet open={newTask} defaultDate={addDays(today, 1)} onClose={() => setNewTask(false)} />
      <TaskSheet
        task={openId ? future.find((t) => t.id === openId) : null}
        onClose={() => setOpenId(null)}
        onToggle={(t) => {
          if (actions.toggleDone(t) === 'need-staff') shell.requireStaff(() => actions.toggleDone(t))
        }}
      />
    </div>
  )
}
