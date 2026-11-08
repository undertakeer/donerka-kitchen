import { useState } from 'react'
import { useStore } from '../data/StoreContext.jsx'
import { Sheet, Button, TextInput } from '../ui/kit.jsx'

export function StaffPickerSheet({ open, onClose, onPicked }) {
  const { state, view, actions } = useStore()
  const [name, setName] = useState('')
  const isAdmin = state.profile?.role === 'admin'
  const list = Object.values(view.staff)
    .filter((s) => s.active !== false)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'ru'))

  const add = () => {
    const n = name.trim()
    if (!n) return
    const id = actions.saveStaff({ name: n })
    actions.setStaff(id)
    setName('')
    onPicked()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Кто на смене?" testId="staff-sheet">
      <p className="mb-4 text-lg text-muted">Все отметки с этого устройства будут записаны на выбранное имя.</p>
      <div className="grid grid-cols-2 gap-3">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              actions.setStaff(s.id)
              onPicked()
            }}
            className={`min-h-20 min-w-0 truncate rounded-2xl border-2 px-3 text-2xl font-bold ${
              state.staffId === s.id ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface-2'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="mb-2 text-lg">Пока нет ни одного имени.</p>}
      {isAdmin && (
        <div className="mt-5 flex min-w-0 gap-2">
          <div className="min-w-0 flex-1">
            <TextInput value={name} onChange={setName} placeholder="Новое имя" aria-label="Новое имя" onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
          <Button onClick={add} disabled={!name.trim()}>Добавить</Button>
        </div>
      )}
    </Sheet>
  )
}
