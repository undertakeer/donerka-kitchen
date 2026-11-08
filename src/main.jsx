import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './data/StoreContext.jsx'
import { createStore } from './data/store.js'
import { createSupabaseBackend } from './data/supabaseBackend.js'
import { createFakeBackend } from './data/fakeBackend.js'

const env = import.meta.env
let backend
if (env.VITE_BACKEND === 'fake') {
  backend = createFakeBackend()
} else {
  backend = createSupabaseBackend(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY)
}

const store = createStore(backend)
window.__kitchen = { store, backend }

// часы: раз в 30 секунд обновляем «сейчас» (подсветка опозданий, смена дня в 04:00)
setInterval(() => store.actions.tick(), 30_000)
window.addEventListener('online', () => {
  store.actions.setConnection('unknown')
  store.actions.refresh()
})
window.addEventListener('offline', () => store.actions.setConnection('offline'))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    store.actions.tick()
    store.actions.refresh()
  }
})
setInterval(() => {
  if (store.getState().queue.length) store.actions.flush()
}, 20_000)

store.actions.init()

if ('serviceWorker' in navigator && env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
)
