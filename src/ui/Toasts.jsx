import { useStore } from '../data/StoreContext.jsx'

export function Toasts() {
  const { state, actions } = useStore()
  if (!state.toasts.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
      {state.toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`pointer-events-auto flex w-full max-w-[560px] items-start gap-3 rounded-2xl p-4 text-lg shadow-lg anim-fade ${
            t.kind === 'error' ? 'bg-danger text-white' : 'bg-ink text-bg'
          }`}
        >
          <div className="min-w-0 flex-1 break-words">{t.message}</div>
          <button type="button" onClick={() => actions.dismissToast(t.id)} className="shrink-0 rounded-xl bg-white/20 px-3 py-1 font-semibold">
            OK
          </button>
        </div>
      ))}
    </div>
  )
}
