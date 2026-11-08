import { useState } from 'react'
import { useStore } from '../data/StoreContext.jsx'
import { Button, Field, TextInput } from '../ui/kit.jsx'

export function LoginScreen() {
  const { actions } = useStore()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await actions.signIn(login, password)
    } catch (err) {
      const msg = String(err?.message || '')
      if (/Invalid login credentials/i.test(msg)) setError('Неверный логин или пароль.')
      else if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
        setError('Нет связи с базой. Проверьте интернет. Если интернет есть, а вход не работает несколько минут — откройте supabase.com, проект и нажмите Restore.')
      else setError('Не удалось войти: ' + msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll-y absolute inset-0">
      <form onSubmit={submit} className="mx-auto flex min-h-full max-w-[440px] flex-col justify-center px-5 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-brand text-4xl text-brand-ink">✓</div>
          <h1 className="text-3xl font-bold">Кухня</h1>
          <p className="mt-1 text-lg text-muted">Войдите, чтобы увидеть задачи</p>
        </div>
        <Field label="Логин">
          {(id) => (
            <TextInput id={id} value={login} onChange={setLogin} autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder="например, kuhnya" />
          )}
        </Field>
        <Field label="Пароль">
          {(id) => <TextInput id={id} type="password" value={password} onChange={setPassword} autoComplete="current-password" />}
        </Field>
        {error && <p className="mb-4 rounded-2xl bg-danger-soft p-4 text-lg text-danger" role="alert">{error}</p>}
        <Button big type="submit" disabled={busy || !login.trim() || !password}>
          {busy ? 'Входим…' : 'Войти'}
        </Button>
      </form>
    </div>
  )
}
