import { useState } from 'react'
import { useStore } from '../data/StoreContext.jsx'
import { Sheet, Button, Field, TextInput, TextArea, QtyInput, Chips } from '../ui/kit.jsx'
import { addDays } from '../lib/time.js'
import { UNITS, useTaskFields } from './useTaskFields.js'

export function TaskFields({ f, autoFocus }) {
  const { view } = useStore()
  const sections = Object.values(view.sections).sort((a, b) => a.sort - b.sort)
  return (
    <>
      <Field label="Что сделать">
        {(id) => <TextInput id={id} value={f.title} onChange={f.setTitle} placeholder="Например: нарезать лук" autoFocus={autoFocus} />}
      </Field>
      {sections.length > 0 && (
        <Field label="Раздел">
          <Chips
            options={[...sections.map((s) => ({ id: s.id, label: s.name })), { id: null, label: 'Без раздела' }]}
            value={f.sectionId}
            onChange={f.setSectionId}
          />
        </Field>
      )}
      <div className="flex min-w-0 gap-3">
        <div className="w-32 shrink-0">
          <Field label="Сколько">{(id) => <QtyInput id={id} value={f.qty} onChange={f.setQty} placeholder="3" />}</Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Единица">{(id) => <TextInput id={id} value={f.unit} onChange={f.setUnit} placeholder="кг" />}</Field>
        </div>
      </div>
      <div className="-mt-2 mb-4 flex flex-wrap gap-2">
        {UNITS.map((u) => (
          <button key={u} type="button" onClick={() => f.setUnit(u)} className={`min-h-11 rounded-xl px-3 text-lg ${f.unit === u ? 'bg-brand text-brand-ink' : 'bg-surface-2'}`}>
            {u}
          </button>
        ))}
      </div>
      <Field label="К какому часу" hint="Необязательно. После этого времени задача подсветится красным.">
        {(id) => (
          <div className="flex min-w-0 gap-2">
            <input
              id={id}
              type="time"
              value={f.due}
              onChange={(e) => f.setDue(e.target.value)}
              className="block min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-lg"
            />
            {f.due && (
              <Button variant="secondary" onClick={() => f.setDue('')}>
                Убрать
              </Button>
            )}
          </div>
        )}
      </Field>
      <Field label="Примечание" hint="Как делать, температура, на сколько порций">
        {(id) => <TextArea id={id} value={f.note} onChange={f.setNote} />}
      </Field>
      {f.error && <p className="mb-3 rounded-2xl bg-danger-soft p-3 text-lg text-danger" role="alert">{f.error}</p>}
    </>
  )
}

/** Создание разовой задачи или правка задачи на конкретный день. */
export function TaskEditSheet(props) {
  if (!props.open) return null
  return <TaskEditInner {...props} />
}

function TaskEditInner({ open, onClose, task, defaultDate, onSaved }) {
  const { actions, store } = useStore()
  const today = store.today()
  const f = useTaskFields(task)
  const [date, setDate] = useState(task?.date || defaultDate || today)
  const isNew = !task

  const save = () => {
    const fields = f.validate()
    if (!fields) return
    if (isNew) actions.createTask({ ...fields, date })
    else actions.updateTask(task, task.template_id ? fields : { ...fields, date })
    ;(onSaved || onClose)()
  }

  const dateChips = [
    { id: today, label: 'Сегодня' },
    { id: addDays(today, 1), label: 'Завтра' },
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? 'Новая задача' : 'Изменить задачу'}
      testId="task-edit-sheet"
      footer={
        <Button big className="flex-1" onClick={save}>
          {isNew ? 'Добавить' : 'Сохранить'}
        </Button>
      }
    >
      <TaskFields f={f} autoFocus={isNew} />
      {!task?.template_id && (
      <Field label="На какой день">
        {(id) => (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Chips options={dateChips} value={date} onChange={setDate} />
            <input
              id={id}
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="block min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-3 text-lg"
            />
          </div>
        )}
      </Field>
      )}
    </Sheet>
  )
}
