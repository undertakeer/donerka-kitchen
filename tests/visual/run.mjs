// Визуальный прогон собранного приложения (демо-база в памяти) в настоящем Chrome.
// Проверяет: нижнее меню у самого низа, документ не скроллится, шторки не шире экрана,
// ничего не вылезает по горизонтали. Скриншоты — в tests/visual/screenshots.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { chromium } from 'playwright'

const PORT = 4179
const APP_URL = `http://localhost:${PORT}/donerka-kitchen/`
const OUT = new URL('./screenshots/', import.meta.url).pathname
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-demo', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('сервер не запустился')), 20000)
  server.stdout.on('data', (d) => String(d).includes('localhost') && (clearTimeout(t), resolve()))
  server.on('exit', (c) => reject(new Error('сервер упал: ' + c)))
})

const DEVICES = [
  { name: 'iphone-13', width: 390, height: 844 },
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-pro-max', width: 430, height: 932 },
  { name: 'tablet', width: 1024, height: 768, mobile: false },
]

const failures = []
const fail = (dev, msg) => failures.push(`[${dev}] ${msg}`)

async function layoutChecks(page, dev, label) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const nav = document.querySelector('[data-testid="bottom-nav"]')?.getBoundingClientRect()
    const se = document.scrollingElement
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const b = el.getBoundingClientRect()
        if (!b.width || !b.height) return false
        // элементы внутри горизонтально скрытых контейнеров не считаем
        return b.right > vw + 1 || b.left < -1
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
    const sheets = [...document.querySelectorAll('.sheet-panel')].map((p) => {
      const b = p.getBoundingClientRect()
      const scroller = p.querySelector('.scroll-y')
      return { width: b.width, left: b.left, bottom: b.bottom, overflowX: scroller ? scroller.scrollWidth - scroller.clientWidth : 0 }
    })
    return {
      vw, vh,
      navBottom: nav?.bottom, navTop: nav?.top,
      docScrollH: se.scrollHeight, docScrollW: se.scrollWidth,
      wide, sheets,
    }
  })
  if (r.navBottom !== undefined && Math.abs(r.navBottom - r.vh) > 1) fail(dev, `${label}: нижнее меню не у низа (${r.navBottom} vs ${r.vh})`)
  if (r.docScrollH > r.vh + 1) fail(dev, `${label}: документ скроллится по вертикали (${r.docScrollH} > ${r.vh})`)
  if (r.docScrollW > r.vw + 1) fail(dev, `${label}: документ шире экрана (${r.docScrollW} > ${r.vw})`)
  if (r.wide.length) fail(dev, `${label}: элементы вылезают за экран: ${r.wide.join(' | ')}`)
  for (const s of r.sheets) {
    if (s.width > r.vw + 0.5 || s.left < -0.5) fail(dev, `${label}: шторка шире экрана (${s.width})`)
    if (s.overflowX > 0) fail(dev, `${label}: содержимое шторки шире её (${s.overflowX}px)`)
    if (Math.abs(s.bottom - r.vh) > 1) fail(dev, `${label}: шторка не у низа`)
  }
  return r
}

const browser = await chromium.launch({ channel: 'chrome' })
let shots = 0
const cleanup = () => {
  try { server.kill() } catch { /* ignore */ }
}
process.on('exit', cleanup)
process.on('uncaughtException', async (e) => {
  console.error('✗ прогон упал:', e.message.split('\n')[0])
  cleanup()
  process.exit(1)
})
process.on('unhandledRejection', (e) => {
  console.error('✗ прогон упал:', String(e?.message || e).split('\n')[0])
  cleanup()
  process.exit(1)
})
for (const d of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: 2,
    isMobile: d.mobile !== false,
    hasTouch: d.mobile !== false,
    locale: 'ru-RU',
    timezoneId: 'Asia/Tashkent',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => fail(d.name, 'ошибка JS: ' + e.message))
  page.on('console', (m) => m.type() === 'error' && fail(d.name, 'console.error: ' + m.text()))
  const shot = async (label) => {
    await page.waitForTimeout(260) // анимации
    await layoutChecks(page, d.name, label)
    await page.screenshot({ path: `${OUT}${d.name}-${String(++shots).padStart(2, '0')}-${label}.png` })
  }

  await page.goto(APP_URL)
  await page.getByLabel('Логин').fill('kuhnya')
  await page.getByLabel('Пароль').fill('demo')
  await shot('вход')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.getByTestId('task-card').first().waitFor()
  await shot('сегодня')

  // отметка → выбор имени → отмечено
  await page.getByRole('button', { name: /^Отметить:/ }).first().click()
  await page.getByTestId('staff-sheet').waitFor()
  await shot('кто-на-смене')
  await page.getByTestId('staff-sheet').getByRole('button', { name: 'Азиз' }).click()
  await page.getByRole('button', { name: /^Отметить:/ }).nth(1).click()
  await page.getByTestId('done-toggle').click()
  // прокрутка до низа: меню должно остаться у низа
  await page.getByTestId('main-scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await shot('сегодня-прокрутка')

  await page.getByText('Сварить бульон').first().click()
  await page.getByTestId('task-sheet').waitFor()
  await shot('подробности')
  await page.getByTestId('task-sheet').getByRole('button', { name: 'Изменить' }).click()
  await page.getByTestId('task-edit-sheet').waitFor()
  await shot('правка-вложенная')
  await page.keyboard.press('Escape') // закрыли правку — вернулись к подробностям
  await page.getByTestId('task-sheet').waitFor()
  await page.keyboard.press('Escape')
  await page.getByTestId('task-sheet').waitFor({ state: 'detached' })

  await page.getByTestId('fab-add').click()
  await page.getByTestId('task-edit-sheet').waitFor()
  await page.getByTestId('task-edit-sheet').getByLabel('Что сделать').fill('Подготовить банкет на 40 человек — очень длинное название, чтобы проверить перенос строк')
  await shot('новая-задача')
  await page.getByTestId('task-edit-sheet').getByRole('button', { name: 'Добавить' }).click()
  await shot('сегодня-с-длинной')

  await page.getByTestId('tab-templates').click()
  await page.getByTestId('screen-templates').waitFor()
  await shot('шаблоны')
  await page.getByTestId('add-template').click()
  await page.getByTestId('template-sheet').getByRole('button', { name: 'По дням недели' }).click()
  await shot('новый-шаблон')
  await page.keyboard.press('Escape')

  await page.getByTestId('tab-more').click()
  await shot('ещё')
  for (const sub of ['journal', 'sections', 'staff', 'settings', 'install']) {
    await page.getByTestId(`more-${sub}`).click()
    await page.getByTestId(`screen-${sub}`).waitFor()
    await shot(sub)
    await page.getByRole('button', { name: '‹ Назад' }).click()
  }

  // отступ меню реально двигает меню
  await page.getByTestId('more-settings').click()
  const before = await page.getByTestId('bottom-nav').evaluate((el) => el.getBoundingClientRect().height)
  await page.getByRole('button', { name: 'Больше' }).click()
  await page.getByRole('button', { name: 'Больше' }).click()
  const after = await page.getByTestId('bottom-nav').evaluate((el) => el.getBoundingClientRect().height)
  if (Math.round(after - before) !== 4) fail(d.name, `подстройка отступа не сдвигает меню (${before} → ${after})`)
  await page.getByRole('button', { name: 'Тёмная' }).click()
  await page.getByTestId('tab-today').click()
  await shot('тёмная')
  await ctx.close()
}
await browser.close()
server.kill()

console.log(`Скриншотов: ${shots} → ${OUT}`)
if (failures.length) {
  console.error('\n✗ Визуальные проблемы:\n' + failures.map((f) => ' - ' + f).join('\n'))
  process.exit(1)
}
console.log('✓ визуальный прогон: меню у низа, шторки в ширину экрана, ничего не вылезает')
