import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../../src/data/store.js'
import { createFakeBackend } from '../../src/data/fakeBackend.js'
import { buildDay } from '../../src/lib/day.js'
import { workDate } from '../../src/lib/time.js'

const TODAY = workDate()
function seed() {
  return {
    sections: [{ id: 's1', name: 'Заготовки', sort: 10 }],
    staff: [{ id: 'p1', name: 'Азиз', sort: 0, active: true }, { id: 'p2', name: 'Оля', sort: 1, active: true }],
    templates: [{ id: 'tp1', title: 'Бульон', section_id: 's1', repeat_kind: 'daily', start_date: '2026-01-01', archived_at: null, sort: 0 }],
    tasks: [],
  }
}
async function device(backend, staffId = 'p1', storage = false) {
  const store = createStore(backend, { storage })
  await store.actions.init()
  await store.actions.signIn('kuhnya', 'x')
  await vi.waitFor(() => expect(store.getState().loaded).toBe(true))
  store.actions.setStaff(staffId)
  return store
}
const todayItems = (store) => buildDay(store.getView(), TODAY, store.today())
const bulyon = (store) => todayItems(store).find((t) => t.title === 'Бульон')

describe('хранилище + база в памяти', () => {
  it('без выбранного сотрудника отметка просит выбрать имя', async () => {
    const be = createFakeBackend({ seed: seed() })
    const s = await device(be)
    s.actions.setStaff(null)
    expect(s.actions.toggleDone(bulyon(s))).toBe('need-staff')
  })

  it('утром создаются задачи из шаблонов; два устройства — без дублей', async () => {
    const be = createFakeBackend({ seed: seed() })
    const a = await device(be, 'p1')
    const b = await device(be, 'p2')
    await a.actions.refresh()
    await b.actions.refresh()
    const rows = [...be.db.tasks.values()].filter((t) => t.template_id === 'tp1' && t.date === TODAY)
    expect(rows).toHaveLength(1)
  })

  it('без сети: отметка сразу на экране, хранится и уходит в базу, когда сеть вернулась', async () => {
    const be = createFakeBackend({ seed: seed() })
    const s = await device(be, 'p1', true)
    be.state.offline = true
    s.actions.toggleDone(bulyon(s))
    expect(bulyon(s).done_at).toBeTruthy()
    await vi.waitFor(() => expect(s.getState().connection).toBe('offline'))
    // очередь сохранена на устройстве — переживёт закрытие приложения
    const cached = JSON.parse(localStorage.getItem('kitchen-cache-v1:user-kuhnya'))
    expect(cached.queue.some((o) => o.type === 'task.done')).toBe(true)
    be.state.offline = false
    await s.actions.flush()
    const row = [...be.db.tasks.values()].find((t) => t.template_id === 'tp1')
    expect(row.done_at).toBeTruthy()
    expect(row.done_by_name).toBe('Азиз')
    expect(s.getState().queue).toHaveLength(0)
  })

  it('база отказала → отметка исчезает и показывается понятная ошибка', async () => {
    const be = createFakeBackend({ seed: seed() })
    const s = await device(be)
    be.state.failNext = { code: '42703', message: 'column "x" does not exist' }
    s.actions.toggleDone(bulyon(s))
    await vi.waitFor(() => expect(s.getState().queue).toHaveLength(0))
    expect(bulyon(s).done_at).toBe(null)
    expect(s.getState().toasts[0].message).toMatch(/База отстала/)
  })

  it('двое отметили одновременно — засчитана первая отметка', async () => {
    const be = createFakeBackend({ seed: seed() })
    const a = await device(be, 'p1')
    const b = await device(be, 'p2')
    a.actions.toggleDone(bulyon(a))
    b.actions.toggleDone(bulyon(b))
    await a.actions.flush()
    await b.actions.flush()
    await vi.waitFor(() => expect(b.getState().queue).toHaveLength(0))
    const row = [...be.db.tasks.values()].find((t) => t.template_id === 'tp1')
    expect(row.done_by_name).toBe('Азиз')
    expect(bulyon(b).done_by_name).toBe('Азиз') // второе устройство видит правду из базы
  })

  it('задачу удалили на другом устройстве, пока у повара не было сети', async () => {
    const be = createFakeBackend({ seed: seed() })
    const s = await device(be)
    const t = bulyon(s)
    be.state.offline = true
    s.actions.toggleDone(t)
    await s.actions.flush() // попытка без сети — действие остаётся в очереди
    expect(s.getState().queue).toHaveLength(1)
    // управляющий удаляет задачу
    const row = [...be.db.tasks.values()].find((x) => x.template_id === 'tp1')
    be.db.tasks.set(row.id, { ...row, deleted_at: new Date().toISOString() })
    be.state.offline = false
    await s.actions.flush()
    expect(s.getState().toasts.some((x) => /удалили/.test(x.message))).toBe(true)
    expect(s.getState().queue).toHaveLength(0)
    await vi.waitFor(() => expect(bulyon(s)).toBeUndefined()) // экран показывает правду: задачи нет
  })

  it('изменение с другого устройства появляется без перезагрузки', async () => {
    const be = createFakeBackend({ seed: seed() })
    const s = await device(be)
    be.remote('tasks', { id: 'new1', template_id: null, date: TODAY, title: 'Банкет на 40', section_id: 's1', done_at: null, deleted_at: null })
    await vi.waitFor(() => expect(todayItems(s).some((t) => t.title === 'Банкет на 40')).toBe(true))
  })

  it('удаление шаблона: несделанное исчезает, сделанное остаётся', async () => {
    const be = createFakeBackend({ seed: seed() })
    const s = await device(be)
    await s.actions.flush()
    s.actions.archiveTemplate('tp1')
    await s.actions.flush()
    expect(todayItems(s).find((t) => t.title === 'Бульон')).toBeUndefined()
    expect(s.getView().templates.tp1).toBeUndefined()
  })

  it('удалённая сегодня повторяющаяся задача не появляется снова после обновления', async () => {
    const be = createFakeBackend({ seed: seed() })
    const s = await device(be)
    s.actions.deleteTask(bulyon(s))
    await s.actions.flush()
    await s.actions.refresh()
    expect(bulyon(s)).toBeUndefined()
  })
})
