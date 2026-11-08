// Количества вводятся в текстовые поля: принимаем и «2,5», и «2.5».

/** '' → null; '2,5' → 2.5; мусор → NaN */
export function parseQty(input) {
  if (input === null || input === undefined) return null
  const s = String(input).trim().replace(/\s+/g, '').replace(',', '.')
  if (s === '') return null
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN
}

/** 2.5 → '2,5' */
export function formatQty(n) {
  if (n === null || n === undefined || n === '') return ''
  const x = Math.round(Number(n) * 1000) / 1000
  return String(x).replace('.', ',')
}

/** «3 кг» */
export function qtyLabel(qty, unit) {
  if (qty === null || qty === undefined) return unit || ''
  return `${formatQty(qty)}${unit ? ' ' + unit : ''}`
}

/** Только цифры и одна запятая/точка — для onChange полей ввода. */
export function sanitizeQtyInput(s) {
  let v = String(s).replace(/[^\d.,]/g, '').replace('.', ',')
  const i = v.indexOf(',')
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, '')
  return v
}
