import { useState } from 'react'
import { useStore } from '../data/StoreContext.jsx'
import { Sheet, Button, Field, Chips, ConfirmSheet, QtyInput } from '../ui/kit.jsx'
import { TaskFields } from './TaskEditSheet.jsx'
import { useTaskFields } from './useTaskFields.js'
import { REPEAT_KINDS, describeRepeat, isDue } from '../lib/schedule.js'
import { WEEKDAY_NAMES, addDays, formatDayLong } from '../lib/time.js'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ id: d, label: WEEKDAY_NAMES[d] }))

export function TemplateEditSheet(props) {
  if (!props.open) return null
  return <Inner {...props} />
}

function Inner({ open, onClose, template }) {
  const { actions, store, state } = useStore()
  const today = store.today()
  const isAdmin = state.profile?.role === 'admin'
  const f = useTaskFields(template)
  const [kind, setKind] = useState(template?.repeat_kind || 'daily')
  const [weekdays, setWeekdays] = useState(template?.weekdays || [])
  const [everyN, setEveryN] = useState(String(template?.every_n || 2))
  const [monthDay, setMonthDay] = useState(String(template?.month_day || 1))
  const [startDate, setStartDate] = useState(template?.start_date || today)
  const [applyToday, setApplyToday] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isNew = !template

  const build = () => {
    const fields = f.validate()
    if (!fields) return null
    const row = {
      ...(template ? { id: template.id } : {}),
      ...fields,
      sort: template?.sort ?? 0,
      repeat_kind: kind,
      weekdays: kind === 'weekdays' ? [...weekdays].sort() : null,
      every_n: null,
      month_day: null,
      start_date: startDate,
      end_date: template?.end_date ?? null,
    }
    if (kind === 'weekdays' && weekdays.length === 0) return setErr('Выберите хотя бы один день недели'), null
    if (kind === 'every_n') {
      const n = parseInt(everyN, 10)
      if (!(n >= 1 && n <= 365)) return setErr('«Раз в N дней»: N от 1 до 365'), null
      row.every_n = n
    }
    if (kind === 'monthly') {
      const d = parseInt(monthDay, 10)
      if (!(d >= 1 && d <= 31)) return setErr('День месяца от 1 до 31'), null
      row.month_day = d
    }
    setErr('')
    return row
  }

  const preview = (() => {
    const row = { repeat_kind: kind, weekdays, every_n: parseInt(everyN, 10) || 1, month_day: parseInt(monthDay, 10) || 1, start_date: startDate }
    const days = []
    for (let i = 0; i < 400 && days.length < 3; i++) {
      const d = addDays(today, i)
      if (isDue(row, d)) days.push(d)
    }
    return days
  })()

  const save = () => {
    const row = build()
    if (!row) return
    actions.saveTemplate(row, { applyToday })
    onClose()
  }

  if (!isAdmin) {
    return (
      <Sheet open={open} onClose={onClose} title="Нет прав">
        <p className="text-lg">Шаблоны меняет только управляющий.</p>
      </Sheet>
    )
  }

  return (
    <>
      <Sheet
        open={open && !confirmDelete}
        onClose={onClose}
        title={isNew ? 'Новая повторяющаяся' : 'Повторяющаяся задача'}
        testId="template-sheet"
        footer={
          <Button big className="flex-1" onClick={save}>
            Сохранить
          </Button>
        }
      >
        <TaskFields f={f} autoFocus={isNew} />

        <Field label="Как часто">
          <Chips options={REPEAT_KINDS} value={kind} onChange={setKind} />
        </Field>
        {kind === 'weekdays' && (
          <Field label="По каким дням">
            <Chips options={WEEKDAYS} value={weekdays} onChange={setWeekdays} multi />
          </Field>
        )}
        {kind === 'every_n' && (
          <Field label="Раз в сколько дней" hint="Отсчёт от даты начала">
            {(id) => <QtyInput id={id} value={everyN} onChange={(v) => setEveryN(v.replace(/\D/g, ''))} inputMode="numeric" />}
          </Field>
        )}
        {kind === 'monthly' && (
          <Field label="Какого числа" hint="Если в месяце нет такого числа (например 31-го) — в последний день месяца">
            {(id) => <QtyInput id={id} value={monthDay} onChange={(v) => setMonthDay(v.replace(/\D/g, ''))} inputMode="numeric" />}
          </Field>
        )}
        <Field label="Начиная с">
          {(id) => (
            <input
              id={id}
              type="date"
              value={startDate}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
              className="block min-h-12 w-full min-w-0 rounded-2xl border-2 border-line bg-surface px-3 text-lg"
            />
          )}
        </Field>
        <p className="mb-4 rounded-2xl bg-surface-2 p-3 text-base" data-testid="repeat-preview">
          <b>{describeRepeat({ repeat_kind: kind, weekdays, every_n: everyN, month_day: monthDay })}</b>
          <br />
          Ближайшие: {preview.length ? preview.map((d) => formatDayLong(d)).join(' · ') : 'нет'}
        </p>
        {!isNew && (
          <label className="mb-4 flex min-h-12 items-center gap-3 text-lg">
            <input type="checkbox" className="size-6 accent-[var(--color-brand)]" checked={applyToday} onChange={(e) => setApplyToday(e.target.checked)} />
            Применить и к сегодняшней задаче
          </label>
        )}
        {err && <p className="mb-3 rounded-2xl bg-danger-soft p-3 text-lg text-danger" role="alert">{err}</p>}
        {!isNew && (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            Удалить шаблон
          </Button>
        )}
      </Sheet>
      <ConfirmSheet
        open={open && confirmDelete}
        title="Удалить шаблон?"
        text="Задача перестанет появляться. Несделанные сегодня — исчезнут, сделанные останутся в журнале."
        confirmLabel="Удалить"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          actions.archiveTemplate(template.id)
          onClose()
        }}
      />
    </>
  )
}
