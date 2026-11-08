import { useMemo, useState } from 'react'
import { useStore } from '../data/StoreContext.jsx'
import { Button, ScreenHeader, ConfirmSheet, Sheet, TextInput, Chips, Empty } from '../ui/kit.jsx'
import { IconChevronR, IconUp, IconDown, IconPlus } from '../ui/icons.jsx'
import { addDays, relativeDayLabel, formatTime, workDate, formatDayShort, formatDayLong } from '../lib/time.js'
import { formatQty } from '../lib/qty.js'

const ITEMS = [
  { id: 'journal', label: 'Журнал', hint: 'Кто, что и когда сделал' },
  { id: 'sections', label: 'Разделы', hint: 'Заготовки, выпечка, уборка… и их порядок' },
  { id: 'staff', label: 'Сотрудники', hint: 'Имена для «Кто на смене»' },
  { id: 'settings', label: 'Настройки экрана', hint: 'Отступ нижнего меню, тема' },
  { id: 'install', label: 'Установить на телефон', hint: 'Как добавить на экран «Домой»' },
]

export function MoreScreen({ sub, setSub }) {
  const back = () => setSub(null)
  if (sub === 'journal') return <JournalScreen onBack={back} />
  if (sub === 'sections') return <SectionsScreen onBack={back} />
  if (sub === 'staff') return <StaffScreen onBack={back} />
  if (sub === 'settings') return <SettingsScreen onBack={back} />
  if (sub === 'install') return <InstallScreen onBack={back} />
  return <MoreMenu setSub={setSub} />
}

function MoreMenu({ setSub }) {
  const { state, actions, store } = useStore()
  const [confirmOut, setConfirmOut] = useState(false)
  const pending = store.pending()
  return (
    <div data-testid="screen-more">
      <ScreenHeader title="Ещё" />
      <div className="flex flex-col gap-2">
        {ITEMS.map((it) => (
          <button key={it.id} type="button" data-testid={`more-${it.id}`} onClick={() => setSub(it.id)} className="flex min-h-18 min-w-0 items-center gap-3 rounded-3xl bg-surface px-5 py-3 text-left">
            <div className="min-w-0 flex-1">
              <div className="text-xl font-semibold">{it.label}</div>
              <div className="truncate text-base text-muted">{it.hint}</div>
            </div>
            <IconChevronR className="shrink-0 text-2xl text-muted" />
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-3xl bg-surface p-5 text-base text-muted">
        <div>
          Вход: <b className="text-ink">{state.profile?.login || '…'}</b>
          {state.profile?.role === 'admin' ? ' (управляющий)' : state.profile?.role === 'cook' ? ' (повар)' : ''}
        </div>
        <div>
          Связь: {state.connection === 'ok' ? 'есть' : state.connection === 'offline' ? 'нет' : 'проверяем'}
          {state.lastSyncAt && ` · обновлено в ${formatTime(state.lastSyncAt)}`}
        </div>
        {pending > 0 && <div>Ждут отправки: {pending}</div>}
        <Button variant="secondary" className="mt-3 w-full" onClick={() => actions.refresh()}>
          Обновить сейчас
        </Button>
        <p className="mt-3">
          Если приложение долго пишет «Нет сети», а интернет есть: зайдите на supabase.com → ваш проект → нажмите <b>Restore</b> (бесплатный проект засыпает после недели простоя).
        </p>
      </div>

      <Button variant="danger" className="mt-6 w-full" onClick={() => setConfirmOut(true)}>
        Выйти
      </Button>
      <ConfirmSheet
        open={confirmOut}
        title="Выйти из аккаунта?"
        text={pending > 0 ? `Внимание: ${pending} отметок ещё не отправлены в базу и пропадут. Лучше дождаться интернета.` : 'Чтобы снова войти, понадобятся логин и пароль.'}
        confirmLabel="Выйти"
        danger
        onClose={() => setConfirmOut(false)}
        onConfirm={() => actions.signOut()}
      />
    </div>
  )
}

function JournalScreen({ onBack }) {
  const { view, store } = useStore()
  const today = store.today()
  const days = useMemo(() => {
    const tasks = Object.values(view.tasks).filter((t) => !t.deleted_at)
    const out = []
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, -i)
      const dayTasks = tasks.filter((t) => t.date === d)
      const done = dayTasks.filter((t) => t.done_at).sort((a, b) => (a.done_at < b.done_at ? -1 : 1))
      const notDone = i > 0 ? dayTasks.filter((t) => !t.done_at) : []
      if (done.length || notDone.length) out.push({ d, done, notDone })
    }
    return out
  }, [view.tasks, today])

  return (
    <div data-testid="screen-journal">
      <ScreenHeader title="Журнал" onBack={onBack} />
      {days.length === 0 && <Empty>Пока ничего не отмечено.</Empty>}
      {days.map(({ d, done, notDone }) => (
        <section key={d} className="mb-6">
          <h2 className="mb-2 px-1 text-xl font-bold">
            {relativeDayLabel(d, today)} <span className="text-base font-semibold text-muted">· {formatDayLong(d)}</span>
          </h2>
          <div className="overflow-hidden rounded-3xl bg-surface">
            {done.map((t) => {
              const late = workDate(new Date(t.done_at)) !== t.date
              return (
                <div key={t.id} className="flex min-w-0 gap-3 border-b border-line px-4 py-3 last:border-0">
                  <div className="w-14 shrink-0 text-lg font-bold tabular-nums">{formatTime(t.done_at)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-lg">{t.title}</div>
                    <div className="text-base text-muted">
                      {t.done_by_name || 'не указано'}
                      {t.qty_done !== null && t.qty_done !== undefined && ` · факт ${formatQty(t.qty_done)} ${t.unit || ''}`}
                      {late && <span className="font-semibold text-warn"> · задним числом, отмечено {formatDayShort(workDate(new Date(t.done_at)))}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            {notDone.length > 0 && (
              <div className="bg-danger-soft px-4 py-3 text-base text-danger">
                Не сделано ({notDone.length}): {notDone.map((t) => t.title).join(', ')}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

function NameSheet({ open, title, initial, onSave, onClose }) {
  return open ? <NameSheetInner title={title} initial={initial} onSave={onSave} onClose={onClose} /> : null
}
function NameSheetInner({ title, initial, onSave, onClose }) {
  const [name, setName] = useState(initial || '')
  const save = () => {
    if (!name.trim()) return
    onSave(name.trim())
    onClose()
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      testId="name-sheet"
      footer={<Button big className="flex-1" onClick={save} disabled={!name.trim()}>Сохранить</Button>}
    >
      <TextInput value={name} onChange={setName} autoFocus aria-label="Название" onKeyDown={(e) => e.key === 'Enter' && save()} />
    </Sheet>
  )
}

function SectionsScreen({ onBack }) {
  const { state, view, actions } = useStore()
  const isAdmin = state.profile?.role === 'admin'
  const list = Object.values(view.sections).sort((a, b) => a.sort - b.sort)
  const [edit, setEdit] = useState(null) // null | 'new' | section
  const [del, setDel] = useState(null)
  return (
    <div data-testid="screen-sections">
      <ScreenHeader title="Разделы" onBack={onBack} />
      {isAdmin && (
        <Button className="mb-4 w-full" onClick={() => setEdit('new')}>
          <IconPlus /> Новый раздел
        </Button>
      )}
      {list.length === 0 && <Empty>Разделов нет — все задачи будут в «Без раздела».</Empty>}
      <div className="flex flex-col gap-2">
        {list.map((s, i) => (
          <div key={s.id} className="flex min-w-0 items-center gap-1 rounded-3xl bg-surface p-2">
            <button type="button" className="min-h-14 min-w-0 flex-1 truncate px-3 text-left text-xl font-semibold" onClick={() => isAdmin && setEdit(s)}>
              {s.name}
            </button>
            {isAdmin && (
              <>
                <button type="button" aria-label={`Выше: ${s.name}`} disabled={i === 0} onClick={() => actions.moveSection(s.id, -1)} className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-2xl disabled:opacity-30">
                  <IconUp />
                </button>
                <button type="button" aria-label={`Ниже: ${s.name}`} disabled={i === list.length - 1} onClick={() => actions.moveSection(s.id, 1)} className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-2xl disabled:opacity-30">
                  <IconDown />
                </button>
                <button type="button" aria-label={`Удалить: ${s.name}`} onClick={() => setDel(s)} className="grid size-12 place-items-center rounded-2xl bg-danger-soft text-xl text-danger">
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <NameSheet
        open={!!edit}
        title={edit === 'new' ? 'Новый раздел' : 'Переименовать'}
        initial={edit === 'new' ? '' : edit?.name}
        onClose={() => setEdit(null)}
        onSave={(name) => actions.saveSection(edit === 'new' ? { name } : { id: edit.id, name, sort: edit.sort })}
      />
      <ConfirmSheet
        open={!!del}
        title={`Удалить «${del?.name}»?`}
        text="Задачи из этого раздела не удалятся — они переедут в «Без раздела»."
        confirmLabel="Удалить"
        danger
        onClose={() => setDel(null)}
        onConfirm={() => actions.deleteSection(del.id)}
      />
    </div>
  )
}

function StaffScreen({ onBack }) {
  const { state, view, actions } = useStore()
  const isAdmin = state.profile?.role === 'admin'
  const list = Object.values(view.staff).sort((a, b) => (a.active === b.active ? a.sort - b.sort : a.active ? -1 : 1))
  const [edit, setEdit] = useState(null)
  return (
    <div data-testid="screen-staff">
      <ScreenHeader title="Сотрудники" onBack={onBack} />
      <p className="mb-4 text-lg text-muted">Эти имена выбираются вверху экрана «Кто на смене». Уволенного можно скрыть — его отметки останутся в журнале.</p>
      {isAdmin && (
        <Button className="mb-4 w-full" onClick={() => setEdit('new')}>
          <IconPlus /> Добавить
        </Button>
      )}
      <div className="flex flex-col gap-2">
        {list.map((s) => (
          <div key={s.id} className={`flex min-w-0 items-center gap-2 rounded-3xl bg-surface p-2 ${s.active ? '' : 'opacity-50'}`}>
            <button type="button" className="min-h-14 min-w-0 flex-1 truncate px-3 text-left text-xl font-semibold" onClick={() => isAdmin && setEdit(s)}>
              {s.name}
              {state.staffId === s.id && <span className="ml-2 text-base text-brand">на смене</span>}
            </button>
            {isAdmin && (
              <Button variant="secondary" onClick={() => actions.saveStaff({ ...s, active: !s.active })}>
                {s.active ? 'Скрыть' : 'Вернуть'}
              </Button>
            )}
          </div>
        ))}
      </div>
      <NameSheet
        open={!!edit}
        title={edit === 'new' ? 'Новый сотрудник' : 'Переименовать'}
        initial={edit === 'new' ? '' : edit?.name}
        onClose={() => setEdit(null)}
        onSave={(name) => actions.saveStaff(edit === 'new' ? { name } : { ...edit, name })}
      />
    </div>
  )
}

function SettingsScreen({ onBack }) {
  const { state, actions } = useStore()
  return (
    <div data-testid="screen-settings">
      <ScreenHeader title="Настройки экрана" onBack={onBack} />
      <section className="mb-6 rounded-3xl bg-surface p-5">
        <h2 className="mb-1 text-xl font-bold">Отступ под нижним меню</h2>
        <p className="mb-4 text-base text-muted">
          Если нижнее меню на вашем телефоне наезжает на полоску внизу экрана или висит слишком высоко — подвиньте. Меню меняется сразу.
        </p>
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="secondary" aria-label="Меньше" onClick={() => actions.setNavAdjust(state.navAdjust - 2)}>
            −
          </Button>
          <div className="min-w-0 flex-1 text-center text-2xl font-bold tabular-nums" data-testid="nav-adjust-value">
            {state.navAdjust > 0 ? '+' : ''}
            {state.navAdjust} px
          </div>
          <Button variant="secondary" aria-label="Больше" onClick={() => actions.setNavAdjust(state.navAdjust + 2)}>
            +
          </Button>
        </div>
        <input
          type="range"
          min={-40}
          max={60}
          step={1}
          value={state.navAdjust}
          onChange={(e) => actions.setNavAdjust(Number(e.target.value))}
          className="mt-4 w-full accent-[var(--color-brand)]"
          aria-label="Отступ нижнего меню"
        />
        <Button variant="ghost" className="mt-2 w-full" onClick={() => actions.setNavAdjust(0)}>
          Сбросить
        </Button>
      </section>
      <section className="rounded-3xl bg-surface p-5">
        <h2 className="mb-3 text-xl font-bold">Тема</h2>
        <Chips
          options={[
            { id: 'light', label: 'Светлая' },
            { id: 'dark', label: 'Тёмная' },
          ]}
          value={state.theme}
          onChange={actions.setTheme}
        />
        <p className="mt-3 text-base text-muted">Настройки сохраняются только на этом устройстве.</p>
      </section>
    </div>
  )
}

function InstallScreen({ onBack }) {
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  return (
    <div data-testid="screen-install">
      <ScreenHeader title="На экран «Домой»" onBack={onBack} />
      {standalone ? (
        <p className="mb-4 rounded-2xl bg-done-soft p-4 text-lg text-done">Приложение уже установлено и открыто как приложение. ✓</p>
      ) : null}
      <section className="mb-4 rounded-3xl bg-surface p-5 text-lg leading-relaxed">
        <h2 className="mb-2 text-xl font-bold">Айфон / айпад</h2>
        <ol className="list-decimal pl-6">
          <li>Откройте сайт именно в <b>Safari</b>.</li>
          <li>Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх).</li>
          <li>Прокрутите вниз → <b>«На экран „Домой“»</b> → «Добавить».</li>
          <li>Дальше открывайте приложение с иконки «Кухня».</li>
        </ol>
      </section>
      <section className="mb-4 rounded-3xl bg-surface p-5 text-lg leading-relaxed">
        <h2 className="mb-2 text-xl font-bold">Андроид</h2>
        <p>Chrome → меню «⋮» → «Установить приложение» или «Добавить на главный экран».</p>
      </section>
      <section className="rounded-3xl bg-warn-soft p-5 text-lg leading-relaxed text-warn">
        <h2 className="mb-2 text-xl font-bold">Про уведомления на айфоне</h2>
        <p>
          Уведомления (появятся в следующих версиях) на айфоне работают только с <b>iOS 16.4</b> и новее и только если приложение
          добавлено на экран «Домой» и открыто оттуда. Из обычного Safari уведомления не придут — это ограничение Apple.
        </p>
      </section>
    </div>
  )
}
