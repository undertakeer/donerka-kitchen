import { useState } from 'react'
import { useStore } from '../data/StoreContext.jsx'
import { Sheet, Button, Field, QtyInput, ConfirmSheet } from '../ui/kit.jsx'
import { qtyLabel, parseQty, formatQty } from '../lib/qty.js'
import { shortTime, formatDayShort, formatTime, formatDayLong, workDate, isOverdue } from '../lib/time.js'
import { TaskEditSheet } from './TaskEditSheet.jsx'

/** Подробности задачи: примечание, факт количества, отметка, правка, удаление. */
export function TaskSheet({ task, onClose, onToggle }) {
  // ключ по id задачи — при открытии другой задачи поля сбрасываются
  return <TaskSheetInner key={task?.id || 'none'} task={task} onClose={onClose} onToggle={onToggle} />
}

function TaskSheetInner({ task, onClose, onToggle }) {
  const { state, view, actions } = useStore()
  const [fact, setFact] = useState(task?.qty_done !== null && task?.qty_done !== undefined ? formatQty(task.qty_done) : '')
  const [factError, setFactError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const open = !!task
  const done = !!task?.done_at
  const tpl = task?.template_id ? view.templates[task.template_id] : null
  const section = task?.section_id ? view.sections[task.section_id] : null
  const backdated = done && workDate(new Date(task.done_at)) !== task.date

  const saveFact = () => {
    const n = parseQty(fact)
    if (Number.isNaN(n)) return setFactError('Введите число, например 2,5')
    setFactError('')
    const r = actions.setQtyDone(task, n)
    if (r === 'need-staff') onToggle(task)
    else onClose()
  }

  return (
    <>
      <Sheet
        open={open && !editing}
        onClose={onClose}
        title={task?.title || ''}
        testId="task-sheet"
        footer={
          open && (
            <Button
              big
              variant={done ? 'secondary' : 'done'}
              className="flex-1"
              onClick={() => {
                onToggle(task)
                onClose()
              }}
            >
              {done ? 'Снять отметку' : 'Сделано ✓'}
            </Button>
          )
        }
      >
        {open && (
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap gap-2 text-lg">
              {task.qty !== null && task.qty !== undefined && (
                <span className="rounded-xl bg-surface-2 px-3 py-1 font-bold">{qtyLabel(task.qty, task.unit)}</span>
              )}
              {task.due_time && (
                <span className={`rounded-xl px-3 py-1 font-semibold ${isOverdue(task, state.now) ? 'bg-danger-soft text-danger' : 'bg-surface-2'}`}>
                  к {shortTime(task.due_time)}
                </span>
              )}
              {section && <span className="rounded-xl bg-surface-2 px-3 py-1">{section.name}</span>}
              <span className="rounded-xl bg-surface-2 px-3 py-1">{formatDayLong(task.date)}</span>
            </div>

            {task.note && (
              <div className="mb-4 whitespace-pre-wrap break-words rounded-2xl bg-warn-soft p-4 text-xl leading-relaxed">{task.note}</div>
            )}

            {done && (
              <p className="mb-4 rounded-2xl bg-done-soft p-4 text-lg text-done">
                Сделал(а): <b>{task.done_by_name || 'не указано'}</b> в {formatTime(task.done_at)}
                {backdated && <> — отмечено {formatDayShort(workDate(new Date(task.done_at)))}, задним числом за {formatDayShort(task.date)}</>}
              </p>
            )}

            {task.qty !== null && task.qty !== undefined && (
              <Field label={`Сделано фактически${task.unit ? ', ' + task.unit : ''}`} hint="Если сделали меньше или больше плана. Можно с запятой: 2,5">
                {(id) => (
                  <div className="flex min-w-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <QtyInput id={id} value={fact} onChange={setFact} placeholder={formatQty(task.qty)} />
                    </div>
                    <Button onClick={saveFact} disabled={fact.trim() === ''}>
                      {done ? 'Сохранить' : 'Сделано'}
                    </Button>
                  </div>
                )}
              </Field>
            )}
            {factError && <p className="-mt-2 mb-3 text-base text-danger">{factError}</p>}

            {tpl && <p className="mb-4 text-base text-muted">Повторяющаяся задача. Изменения здесь касаются только этого дня; чтобы поменять навсегда — вкладка «Задачи».</p>}

            <div className="flex min-w-0 gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
                Изменить
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setConfirmDelete(true)}>
                Удалить
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* вложенные шторки — соседи, а не дети */}
      <TaskEditSheet
        open={open && editing}
        task={task}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          onClose()
        }}
      />
      <ConfirmSheet
        open={open && confirmDelete}
        title="Удалить задачу?"
        text={tpl ? 'Задача исчезнет только на этот день. Шаблон останется.' : 'Задача исчезнет из списка.'}
        confirmLabel="Удалить"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          actions.deleteTask(task)
          onClose()
        }}
      />
    </>
  )
}
