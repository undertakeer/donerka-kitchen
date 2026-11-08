// Автопрогон интерфейса: входим, открываем каждый экран, жмём кнопки, ловим падения.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App.jsx'
import { StoreProvider } from '../../src/data/StoreContext.jsx'
import { createStore } from '../../src/data/store.js'
import { createFakeBackend } from '../../src/data/fakeBackend.js'

let errors
beforeEach(() => {
  errors = []
  vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.map(String).join(' ')))
  window.addEventListener('error', (e) => errors.push(String(e.error || e.message)))
})
afterEach(() => {
  vi.restoreAllMocks()
  expect(errors).toEqual([])
})

async function boot() {
  const backend = createFakeBackend()
  const store = createStore(backend)
  await store.actions.init()
  const user = userEvent.setup()
  render(
    <StoreProvider store={store}>
      <App />
    </StoreProvider>,
  )
  return { store, backend, user }
}

async function login(user) {
  await user.type(screen.getByLabelText('Логин'), 'kuhnya')
  await user.type(screen.getByLabelText('Пароль'), 'secret')
  await user.click(screen.getByRole('button', { name: 'Войти' }))
  await screen.findByTestId('screen-today')
  await waitFor(() => expect(screen.getAllByTestId('task-card').length).toBeGreaterThan(0))
}

describe('прогон экранов', () => {
  it('неверный логин — понятная ошибка', async () => {
    const { user } = await boot()
    await user.type(screen.getByLabelText('Логин'), 'chuzhoy')
    await user.type(screen.getByLabelText('Пароль'), 'x')
    await user.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByText('Неверный логин или пароль.')).toBeTruthy()
  })

  it('Сегодня: отметка → просит имя → отмечает; прогресс растёт; сделанное сворачивается', async () => {
    const { user, backend } = await boot()
    await login(user)
    const progress = screen.getByTestId('progress')
    const before = progress.textContent
    const firstCheck = screen.getAllByRole('button', { name: /^Отметить:/ })[0]
    const title = firstCheck.getAttribute('aria-label').replace('Отметить: ', '')
    await user.click(firstCheck)
    // имя не выбрано — открылась шторка выбора
    const sheet = await screen.findByTestId('staff-sheet')
    await user.click(within(sheet).getByRole('button', { name: 'Азиз' }))
    await waitFor(() => expect(screen.getByTestId('progress').textContent).not.toBe(before))
    expect(screen.getByTestId('staff-button').textContent).toMatch('Азиз')
    // ушло в базу
    await waitFor(() => expect([...backend.db.tasks.values()].some((t) => t.title === title && t.done_at)).toBe(true))
    // сделанное свёрнуто внизу
    const toggle = screen.getByTestId('done-toggle')
    expect(toggle.textContent).toMatch('Сделано · 1')
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: `Снять отметку: ${title}` }))
    await waitFor(() => expect(screen.queryByTestId('done-toggle')).toBeNull())
  })

  it('Сегодня: подробности, факт количества с запятой, правка, удаление', async () => {
    const { user, store } = await boot()
    await login(user)
    store.actions.setStaff(Object.keys(store.getView().staff)[0])
    await user.click(screen.getByText('Сварить бульон'))
    const sheet = await screen.findByTestId('task-sheet')
    expect(within(sheet).getByText(/Курица/)).toBeTruthy()
    const fact = within(sheet).getByLabelText(/Сделано фактически/)
    await user.type(fact, '7,5')
    expect(fact.value).toBe('7,5')
    await user.click(within(sheet).getByRole('button', { name: 'Сделано' }))
    await waitFor(() => expect(screen.queryByTestId('task-sheet')).toBeNull())
    await user.click(screen.getByTestId('done-toggle'))
    expect(await screen.findByText(/7,5 из 10 л/)).toBeTruthy()

    // правка задачи — вложенная шторка открывается
    await user.click(screen.getByText('Нарезать лук'))
    await user.click(within(await screen.findByTestId('task-sheet')).getByRole('button', { name: 'Изменить' }))
    const edit = await screen.findByTestId('task-edit-sheet')
    const qty = within(edit).getByLabelText('Сколько')
    await user.clear(qty)
    await user.type(qty, '2,5')
    await user.click(within(edit).getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('2,5 кг')).toBeTruthy()

    // удаление с подтверждением
    await user.click(screen.getByText('Нарезать лук'))
    await user.click(within(await screen.findByTestId('task-sheet')).getByRole('button', { name: 'Удалить' }))
    await user.click(within(await screen.findByTestId('confirm-sheet')).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByText('Нарезать лук')).toBeNull())
  })

  it('Сегодня: новая разовая задача; листание дней; перенос со вчера', async () => {
    const { user } = await boot()
    await login(user)
    expect(screen.getByText(/^с \d\d\.\d\d$/)).toBeTruthy() // пометка «со вчера»
    expect(screen.getByText('Заказать овощи на неделю')).toBeTruthy()
    await user.click(screen.getByTestId('fab-add'))
    const sheet = await screen.findByTestId('task-edit-sheet')
    await user.click(within(sheet).getByRole('button', { name: 'Добавить' }))
    expect(within(sheet).getByRole('alert').textContent).toMatch('Напишите')
    await user.type(within(sheet).getByLabelText('Что сделать'), 'Банкет на 40 человек')
    await user.type(within(sheet).getByLabelText('Сколько'), 'abc')
    await user.click(within(sheet).getByRole('button', { name: 'Добавить' }))
    expect(await screen.findByText('Банкет на 40 человек')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Следующий день' }))
    expect(screen.getByText('Завтра')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Предыдущий день' }))
    await user.click(screen.getByRole('button', { name: 'Предыдущий день' }))
    expect(screen.getByText('Вчера')).toBeTruthy()
    expect(screen.getByText(/задним числом/)).toBeTruthy()
  })

  it('Задачи: новый шаблон по дням недели, проверки, правка, удаление', async () => {
    const { user } = await boot()
    await login(user)
    await user.click(screen.getByTestId('tab-templates'))
    await screen.findByTestId('screen-templates')
    await user.click(screen.getByTestId('add-template'))
    const sheet = await screen.findByTestId('template-sheet')
    await user.type(within(sheet).getByLabelText('Что сделать'), 'Разморозить курицу')
    await user.click(within(sheet).getByRole('button', { name: 'По дням недели' }))
    await user.click(within(sheet).getByRole('button', { name: 'Сохранить' }))
    expect(within(sheet).getByRole('alert').textContent).toMatch('день недели')
    await user.click(within(sheet).getByRole('button', { name: 'Пн' }))
    await user.click(within(sheet).getByRole('button', { name: 'Чт' }))
    expect(within(sheet).getByTestId('repeat-preview').textContent).toMatch('пн, чт')
    await user.click(within(sheet).getByRole('button', { name: 'Раз в месяц' }))
    await user.click(within(sheet).getByRole('button', { name: 'Раз в N дней' }))
    await user.click(within(sheet).getByRole('button', { name: 'По дням недели' }))
    await user.click(within(sheet).getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Разморозить курицу')).toBeTruthy()

    await user.click(screen.getByText('Разморозить курицу'))
    const s2 = await screen.findByTestId('template-sheet')
    await user.click(within(s2).getByRole('button', { name: 'Удалить шаблон' }))
    await user.click(within(await screen.findByTestId('confirm-sheet')).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByText('Разморозить курицу')).toBeNull())

    await user.click(screen.getByRole('button', { name: /Разовая задача/ }))
    const t = await screen.findByTestId('task-edit-sheet')
    await user.type(within(t).getByLabelText('Что сделать'), 'Принять поставку')
    await user.click(within(t).getByRole('button', { name: 'Добавить' }))
    expect(await screen.findByText('Принять поставку')).toBeTruthy()
  })

  it('Ещё: каждый подэкран открывается и кнопки работают', async () => {
    const { user } = await boot()
    await login(user)
    await user.click(screen.getByTestId('tab-more'))
    await screen.findByTestId('screen-more')

    await user.click(screen.getByTestId('more-journal'))
    await screen.findByTestId('screen-journal')
    await user.click(screen.getByRole('button', { name: '‹ Назад' }))

    await user.click(screen.getByTestId('more-sections'))
    await screen.findByTestId('screen-sections')
    await user.click(screen.getByRole('button', { name: /Новый раздел/ }))
    await user.type(within(await screen.findByTestId('name-sheet')).getByLabelText('Название'), 'Выпечка')
    await user.click(within(screen.getByTestId('name-sheet')).getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Выпечка')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Выше: Выпечка' }))
    const names = screen.getAllByRole('button', { name: /^Выше:/ }).map((b) => b.getAttribute('aria-label'))
    expect(names.at(-2)).toBe('Выше: Выпечка')
    await user.click(screen.getByRole('button', { name: 'Удалить: Выпечка' }))
    await user.click(within(await screen.findByTestId('confirm-sheet')).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByText('Выпечка')).toBeNull())
    await user.click(screen.getByRole('button', { name: '‹ Назад' }))

    await user.click(screen.getByTestId('more-staff'))
    await screen.findByTestId('screen-staff')
    await user.click(screen.getByRole('button', { name: /Добавить/ }))
    await user.type(within(await screen.findByTestId('name-sheet')).getByLabelText('Название'), 'Дилшод')
    await user.click(within(screen.getByTestId('name-sheet')).getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Дилшод')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '‹ Назад' }))

    await user.click(screen.getByTestId('more-settings'))
    await screen.findByTestId('screen-settings')
    await user.click(screen.getByRole('button', { name: 'Больше' }))
    await user.click(screen.getByRole('button', { name: 'Больше' }))
    expect(screen.getByTestId('nav-adjust-value').textContent).toBe('+4 px')
    expect(document.documentElement.style.getPropertyValue('--nav-adjust')).toBe('4px')
    await user.click(screen.getByRole('button', { name: 'Тёмная' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'Светлая' }))
    await user.click(screen.getByRole('button', { name: '‹ Назад' }))

    await user.click(screen.getByTestId('more-install'))
    expect(await screen.findByText(/iOS 16.4/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '‹ Назад' }))

    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await user.click(within(await screen.findByTestId('confirm-sheet')).getByRole('button', { name: 'Выйти' }))
    expect(await screen.findByLabelText('Логин')).toBeTruthy()
  })

  it('без сети: отметка видна сразу, индикатор показывает ожидание', async () => {
    const { user, store, backend } = await boot()
    await login(user)
    store.actions.setStaff(Object.keys(store.getView().staff)[0])
    backend.state.offline = true
    await user.click(screen.getAllByRole('button', { name: /^Отметить:/ })[0])
    expect(screen.getByTestId('done-toggle')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('sync-badge').textContent).toMatch(/Нет сети · ждут 1/))
    backend.state.offline = false
    await store.actions.flush()
    await waitFor(() => expect(screen.getByTestId('sync-badge').textContent).toMatch('В сети'))
  })

  it('база отстала → понятное сообщение вместо «не удалось сохранить»', async () => {
    const { user, store, backend } = await boot()
    await login(user)
    store.actions.setStaff(Object.keys(store.getView().staff)[0])
    backend.state.failNext = { code: '42P01', message: 'relation "x" does not exist' }
    await user.click(screen.getAllByRole('button', { name: /^Отметить:/ })[0])
    expect((await screen.findByRole('alert')).textContent).toMatch(/База отстала.*schema\.sql/)
    expect(screen.queryByTestId('done-toggle')).toBeNull() // отметка откатилась
  })
})
