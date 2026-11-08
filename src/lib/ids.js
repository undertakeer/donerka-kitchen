// Идентификатор задачи из шаблона на конкретный день вычисляется одинаково
// на всех устройствах. Поэтому если два телефона одновременно (или без сети)
// создают «бульон на 08.11», в базе окажется одна запись, а не две.

function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

const hex8 = (n) => n.toString(16).padStart(8, '0')

function toUuid(words) {
  const h = words.map(hex8).join('')
  // версия 5 и вариант RFC 4122 — чтобы это был формально корректный UUID
  const v = '5' + h.slice(13, 16)
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${v}-${variant}-${h.slice(20, 32)}`
}

export function instanceId(templateId, date) {
  return toUuid(cyrb128(`${templateId}|${date}`))
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  const r = () => Math.floor(Math.random() * 2 ** 32)
  return toUuid([r(), r(), r(), r()]).replace(/^(.{14})5/, '$14')
}
