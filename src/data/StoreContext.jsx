import { createContext, useContext, useSyncExternalStore } from 'react'

const Ctx = createContext(null)

export function StoreProvider({ store, children }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const store = useContext(Ctx)
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  return { state, view: store.getView(), actions: store.actions, store }
}
