import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useStore } from './data/StoreContext.jsx'
import { Toasts } from './ui/Toasts.jsx'
import { IconToday, IconRepeat, IconMore, IconUser, IconCloudOff, IconChevronDown } from './ui/icons.jsx'
import { LoginScreen } from './screens/LoginScreen.jsx'
import { TodayScreen } from './screens/TodayScreen.jsx'
import { TemplatesScreen } from './screens/TemplatesScreen.jsx'
import { MoreScreen } from './screens/MoreScreen.jsx'
import { StaffPickerSheet } from './sheets/StaffPickerSheet.jsx'

const ShellCtx = createContext(null)
// eslint-disable-next-line react-refresh/only-export-components
export const useShell = () => useContext(ShellCtx)

const TABS = [
  { id: 'today', label: 'Сегодня', Icon: IconToday },
  { id: 'templates', label: 'Задачи', Icon: IconRepeat },
  { id: 'more', label: 'Ещё', Icon: IconMore },
]

export default function App() {
  const { state } = useStore()

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = state.theme
    root.style.setProperty('--nav-adjust', `${state.navAdjust}px`)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#15130f' : '#f6f3ee')
  }, [state.theme, state.navAdjust])

  if (state.status === 'init') {
    return <div className="grid h-full place-items-center text-xl text-muted">Загрузка…</div>
  }
  return (
    <>
      {state.status === 'signedOut' ? <LoginScreen /> : <Shell />}
      <Toasts />
    </>
  )
}

function Shell() {
  const { state } = useStore()
  const [tab, setTab] = useState('today')
  const [moreSub, setMoreSub] = useState(null)
  const [picker, setPicker] = useState({ open: false, then: null })

  const requireStaff = useCallback((then) => setPicker({ open: true, then }), [])
  const shell = useMemo(() => ({ requireStaff, openStaffPicker: () => setPicker({ open: true, then: null }) }), [requireStaff])

  const go = (id) => {
    setTab(id)
    if (id === 'more') setMoreSub(null)
  }

  return (
    <ShellCtx.Provider value={shell}>
      <div className="absolute inset-0 flex flex-col">
        <TopBar onStaff={shell.openStaffPicker} />
        {(state.schemaProblem || state.accessProblem) && (
          <div className="mx-3 mb-2 rounded-2xl bg-danger-soft p-4 text-lg text-danger" role="alert" data-testid="schema-banner">
            {state.accessProblem || state.schemaProblem}
          </div>
        )}
        <main className="scroll-y min-h-0 flex-1" data-testid="main-scroll">
          <div className="mx-auto w-full max-w-[760px] px-4 pt-1 pb-28">
            {tab === 'today' && <TodayScreen />}
            {tab === 'templates' && <TemplatesScreen />}
            {tab === 'more' && <MoreScreen sub={moreSub} setSub={setMoreSub} />}
          </div>
        </main>
        <BottomNav tab={tab} onTab={go} />
      </div>
      <StaffPickerSheet
        open={picker.open}
        onClose={() => setPicker({ open: false, then: null })}
        onPicked={() => {
          const then = picker.then
          setPicker({ open: false, then: null })
          then?.()
        }}
      />
    </ShellCtx.Provider>
  )
}

function TopBar({ onStaff }) {
  const { state, view, store } = useStore()
  const staff = state.staffId ? view.staff[state.staffId] : null
  const pending = store.pending()
  const offline = state.connection === 'offline'
  return (
    <header className="flex items-center gap-2 px-3 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
      <button
        type="button"
        onClick={onStaff}
        data-testid="staff-button"
        className={`flex min-h-12 min-w-0 items-center gap-2 rounded-2xl px-3 text-lg font-semibold ${
          staff ? 'bg-surface-2' : 'bg-warn-soft text-warn'
        }`}
      >
        <IconUser className="shrink-0 text-xl" />
        <span className="truncate">{staff ? staff.name : 'Кто на смене?'}</span>
        <IconChevronDown className="shrink-0" />
      </button>
      <div className="flex-1" />
      <div
        data-testid="sync-badge"
        className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-base font-semibold ${
          offline ? 'bg-warn-soft text-warn' : pending ? 'bg-surface-2 text-muted' : 'text-muted'
        }`}
      >
        {offline ? <IconCloudOff /> : <span className={`size-2.5 rounded-full ${state.connection === 'ok' ? 'bg-done' : 'bg-muted'}`} />}
        {offline ? (pending ? `Нет сети · ждут ${pending}` : 'Нет сети') : pending ? `Отправка ${pending}…` : 'В сети'}
      </div>
    </header>
  )
}

function BottomNav({ tab, onTab }) {
  return (
    <nav
      data-testid="bottom-nav"
      className="shrink-0 border-t border-line bg-surface"
      style={{ paddingBottom: 'max(0px, calc(env(safe-area-inset-bottom) + var(--nav-adjust)))' }}
    >
      <div className="mx-auto flex max-w-[760px]">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            data-testid={`tab-${id}`}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${
              tab === id ? 'text-brand' : 'text-muted'
            }`}
          >
            <Icon className="text-[28px]" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
