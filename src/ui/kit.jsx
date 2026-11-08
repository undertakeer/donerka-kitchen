import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { sanitizeQtyInput } from '../lib/qty.js'
import { IconX } from './icons.jsx'

const VARIANTS = {
  primary: 'bg-brand text-brand-ink',
  done: 'bg-done text-white',
  secondary: 'bg-surface-2 text-ink',
  danger: 'bg-danger-soft text-danger',
  ghost: 'bg-transparent text-ink',
}

export function Button({ variant = 'primary', className = '', big = false, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold active:scale-[.98] transition-transform disabled:opacity-40 ${
        big ? 'min-h-16 px-6 text-xl' : 'min-h-14 px-5 text-lg'
      } ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

/**
 * Нижняя шторка. Рендерится порталом прямо в <body> — поэтому вложенная шторка
 * всегда оказывается соседом родительской, а не внутри неё (иначе её обрежет).
 * По горизонтали ничего не вылезает: ширина жёстко ограничена, overflow-x скрыт.
 */
export function Sheet({ open, onClose, title, children, footer, testId }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col justify-end overflow-hidden" data-testid={testId} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45 anim-fade" onClick={onClose} />
      <div
        className="sheet-panel relative mx-auto flex w-full max-w-[640px] max-h-[92%] flex-col overflow-hidden rounded-t-3xl bg-surface anim-sheet"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <h2 className="min-w-0 flex-1 truncate text-2xl font-bold">{title}</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="grid size-12 place-items-center rounded-full bg-surface-2 text-2xl">
            <IconX />
          </button>
        </div>
        <div className="scroll-y min-w-0 flex-1 px-5 pb-4">{children}</div>
        {footer && (
          <div className="flex min-w-0 gap-3 border-t border-line px-5 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            {footer}
          </div>
        )}
        {!footer && <div style={{ height: 'env(safe-area-inset-bottom)' }} />}
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, hint, children }) {
  const id = useId()
  return (
    <div className="mb-4 min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold text-muted">
        {label}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}

const inputCls =
  'block w-full min-w-0 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-lg outline-none focus:border-brand'

export function TextInput({ value, onChange, ...props }) {
  return <input className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
}

export function TextArea({ value, onChange, ...props }) {
  return <textarea rows={3} className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
}

/** Число текстом: принимает «2,5». */
export function QtyInput({ value, onChange, ...props }) {
  return (
    <input
      className={inputCls}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value ?? ''}
      onChange={(e) => onChange(sanitizeQtyInput(e.target.value))}
      {...props}
    />
  )
}

export function Chips({ options, value, onChange, multi = false }) {
  const isOn = (id) => (multi ? value.includes(id) : value === id)
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={isOn(o.id)}
          onClick={() => onChange(multi ? (isOn(o.id) ? value.filter((x) => x !== o.id) : [...value, o.id]) : o.id)}
          className={`min-h-12 rounded-2xl border-2 px-4 text-lg font-semibold ${
            isOn(o.id) ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ConfirmSheet({ open, title, text, confirmLabel = 'Да', danger, onConfirm, onClose }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      testId="confirm-sheet"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={() => { onConfirm(); onClose() }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-lg">{text}</p>
    </Sheet>
  )
}

export function ScreenHeader({ title, onBack, right }) {
  return (
    <div className="flex items-center gap-2 pb-3">
      {onBack && (
        <button type="button" onClick={onBack} className="-ml-2 min-h-12 rounded-xl px-2 text-lg font-semibold text-brand">
          ‹ Назад
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-3xl font-bold">{title}</h1>
      {right}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="rounded-3xl border-2 border-dashed border-line p-6 text-center text-lg text-muted">{children}</div>
}
