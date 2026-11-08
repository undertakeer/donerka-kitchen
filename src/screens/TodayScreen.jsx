import { useMemo, useState } from 'react'
import { useStore } from '../data/StoreContext.jsx'
import { useShell } from '../App.jsx'
import { buildDay, groupDay } from '../lib/day.js'
import { addDays, formatDayLong, relativeDayLabel, isOverdue, shortTime, formatDayShort, formatTime, workDate } from '../lib/time.js'
import { qtyLabel, formatQty } from '../lib/qty.js'
import { Empty } from '../ui/kit.jsx'
import { IconCheck, IconChevronL, IconChevronR, IconPlus, IconNote, IconClock, IconChevronDown } from '../ui/icons.jsx'
import { TaskSheet } from '../sheets/TaskSheet.jsx'
import { TaskEditSheet } from '../sheets/TaskEditSheet.jsx'

export function TodayScreen() {
  const { state, view, actions, store } = useStore()
  const shell = useShell()
  const today = store.today()
  const [offset, setOffset] = useState(0) // 0 = сегодня; хранится смещение, чтобы в 04:00 экран сам перешёл на новый день
  const date = addDays(today, offset)
  const [showDone, setShowDone] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)

  const items = useMemo(() => buildDay(view, date, today), [view, date, today])
  const { groups, done, total, doneCount } = useMemo(() => groupDay(items, view.sections), [items, view.sections])
  const openTask = openId ? items.find((t) => t.id === openId) : null

  const toggle = (task) => {
    if (actions.toggleDone(task) === 'need-staff') shell.requireStaff(() => actions.toggleDone(task))
  }

  const pct = total ? Math.round((doneCount / total) * 100) : 0

  return (
    <div data-testid="screen-today">
      <div className="flex items-center gap-1 pb-2">
        <button type="button" aria-label="Предыдущий день" onClick={() => setOffset(offset - 1)} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl">
          <IconChevronL />
        </button>
        <button type="button" onClick={() => setOffset(0)} className="min-w-0 flex-1 px-1 text-center">
          <div className="truncate text-3xl font-bold leading-tight">{relativeDayLabel(date, today)}</div>
          <div className="truncate text-base text-muted">{offset === 0 ? formatDayLong(date) : 'нажмите, чтобы вернуться к сегодня'}</div>
        </button>
        <button type="button" aria-label="Следующий день" onClick={() => setOffset(offset + 1)} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl">
          <IconChevronR />
        </button>
      </div>

      {offset < 0 && (
        <p className="mb-3 rounded-2xl bg-warn-soft p-3 text-base text-warn">Это прошедший день. Отметки здесь запишутся задним числом — в журнале будет видно, когда их сделали на самом деле.</p>
      )}
      {offset > 0 && <p className="mb-3 rounded-2xl bg-surface-2 p-3 text-base text-muted">Это будущий день: так будет выглядеть список. Можно добавить разовую задачу заранее.</p>}

      <div className="mb-4 rounded-3xl bg-surface p-4" data-testid="progress">
        <div className="flex items-baseline justify-between">
          <div className="text-4xl font-extrabold tabular-nums">
            {doneCount} <span className="text-2xl font-bold text-muted">из {total}</span>
          </div>
          <div className="text-xl font-bold text-muted tabular-nums">{pct}%</div>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-done transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {!state.loaded && total === 0 && <Empty>Загружаем задачи…</Empty>}
      {state.loaded && total === 0 && (
        <Empty>
          На этот день задач нет.
          <br />
          Добавьте разовую кнопкой «+» или повторяющуюся во вкладке «Задачи».
        </Empty>
      )}
      {total > 0 && groups.length === 0 && (
        <div className="rounded-3xl bg-done-soft p-6 text-center text-2xl font-bold text-done">Всё сделано! 🎉</div>
      )}

      {groups.map(({ section, items: list }) => (
        <section key={section.id} className="mb-5">
          <h2 className="mb-2 px-1 text-lg font-bold uppercase tracking-wide text-muted">
            {section.name} <span className="font-semibold">· {list.length}</span>
          </h2>
          <div className="flex flex-col gap-2.5">
            {list.map((t) => (
              <TaskCard key={t.id} task={t} now={state.now} onToggle={() => toggle(t)} onOpen={() => setOpenId(t.id)} />
            ))}
          </div>
        </section>
      ))}

      {done.length > 0 && (
        <section className="mb-5">
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            className="flex min-h-14 w-full items-center gap-2 rounded-2xl bg-surface-2 px-4 text-lg font-bold"
            aria-expanded={showDone}
            data-testid="done-toggle"
          >
            <span className="flex-1 text-left">Сделано · {done.length}</span>
            <IconChevronDown className={`transition-transform ${showDone ? 'rotate-180' : ''}`} />
          </button>
          {showDone && (
            <div className="mt-2.5 flex flex-col gap-2.5">
              {done.map((t) => (
                <TaskCard key={t.id} task={t} now={state.now} onToggle={() => toggle(t)} onOpen={() => setOpenId(t.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        aria-label="Добавить задачу"
        data-testid="fab-add"
        onClick={() => setCreating(true)}
        className="fixed right-5 z-20 grid size-16 place-items-center rounded-full bg-brand text-4xl text-brand-ink shadow-lg active:scale-95"
        style={{ bottom: 'calc(max(0px, env(safe-area-inset-bottom) + var(--nav-adjust)) + 84px)' }}
      >
        <IconPlus />
      </button>

      <TaskSheet task={openTask} onClose={() => setOpenId(null)} onToggle={toggle} />
      <TaskEditSheet open={creating} onClose={() => setCreating(false)} defaultDate={date} />
    </div>
  )
}

export function TaskCard({ task, now, onToggle, onOpen }) {
  const done = !!task.done_at
  const overdue = isOverdue(task, now)
  const backdated = done && workDate(new Date(task.done_at)) !== task.date
  const qtyShort = done && task.qty_done !== null && task.qty_done !== undefined && task.qty !== null && Number(task.qty_done) < Number(task.qty)
  return (
    <div
      data-testid="task-card"
      data-done={done ? '1' : '0'}
      className={`flex min-w-0 items-stretch rounded-3xl border-2 ${
        done ? 'border-transparent bg-surface/60' : overdue ? 'border-danger bg-surface' : 'border-transparent bg-surface'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? `Снять отметку: ${task.title}` : `Отметить: ${task.title}`}
        aria-pressed={done}
        className="grid w-20 shrink-0 place-items-center"
      >
        <span
          className={`grid size-14 place-items-center rounded-full border-[3px] text-3xl ${
            done ? 'anim-pop border-done bg-done text-white' : overdue ? 'border-danger text-transparent' : 'border-line text-transparent'
          }`}
        >
          <IconCheck />
        </span>
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-3.5 pr-4 text-left">
        <div className={`break-words text-xl font-semibold leading-snug ${done ? 'text-muted line-through' : ''}`}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
          {task.qty !== null && task.qty !== undefined && (
            <span className={`font-bold ${done ? 'text-muted' : 'text-ink'}`}>
              {qtyShort ? `${formatQty(task.qty_done)} из ${qtyLabel(task.qty, task.unit)}` : qtyLabel(task.qty, task.unit)}
            </span>
          )}
          {task.due_time && !done && (
            <span className={`flex items-center gap-1 font-semibold ${overdue ? 'text-danger' : 'text-muted'}`}>
              <IconClock /> {overdue ? 'опоздание, ' : ''}к {shortTime(task.due_time)}
            </span>
          )}
          {task.carried && !done && <span className="rounded-lg bg-warn-soft px-2 font-semibold text-warn">с {formatDayShort(task.date)}</span>}
          {task.note && <IconNote className="text-muted" aria-label="Есть примечание" />}
          {done && (
            <span className="text-muted">
              {task.done_by_name || 'кто-то'} · {formatTime(task.done_at)}
              {backdated && ` (за ${formatDayShort(task.date)})`}
            </span>
          )}
        </div>
      </button>
    </div>
  )
}
