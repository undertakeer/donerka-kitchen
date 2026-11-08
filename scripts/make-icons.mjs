// Рисует PNG-иконки из public/icon.svg через установленный Chrome.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
  await page.setViewportSize({ width: size, height: size })
  // для apple-touch-icon — без скругления (iOS скругляет сам)
  const body = name.startsWith('apple') ? svg.replace('rx="112"', 'rx="0"') : svg
  await page.setContent(`<html><body style="margin:0;padding:${pad}px;background:transparent">${body.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  await page.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: true })
}
await browser.close()
console.log('иконки готовы')
