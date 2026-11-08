import { describe, it, expect } from 'vitest'
import { parseQty, formatQty, qtyLabel, sanitizeQtyInput } from '../../src/lib/qty.js'
import { instanceId, newId } from '../../src/lib/ids.js'

describe('количества', () => {
  it('запятая и точка', () => {
    expect(parseQty('2,5')).toBe(2.5)
    expect(parseQty('2.5')).toBe(2.5)
    expect(parseQty(' 3 ')).toBe(3)
    expect(parseQty(',5')).toBe(0.5)
    expect(parseQty('')).toBe(null)
    expect(parseQty(null)).toBe(null)
  })
  it('мусор — ошибка, а не молчаливый ноль', () => {
    expect(parseQty('abc')).toBeNaN()
    expect(parseQty('1,2,3')).toBeNaN()
    expect(parseQty('-1')).toBeNaN()
  })
  it('вывод с запятой', () => {
    expect(formatQty(2.5)).toBe('2,5')
    expect(formatQty(3)).toBe('3')
    expect(formatQty(0.1 + 0.2)).toBe('0,3')
    expect(qtyLabel(3, 'кг')).toBe('3 кг')
  })
  it('поле ввода оставляет только число', () => {
    expect(sanitizeQtyInput('2.5')).toBe('2,5')
    expect(sanitizeQtyInput('2,5,1')).toBe('2,51')
    expect(sanitizeQtyInput('3 кг')).toBe('3')
  })
})

describe('id задач из шаблона', () => {
  it('одинаковый на всех устройствах', () => {
    expect(instanceId('t1', '2026-11-08')).toBe(instanceId('t1', '2026-11-08'))
  })
  it('разный для разных дней и шаблонов', () => {
    expect(instanceId('t1', '2026-11-08')).not.toBe(instanceId('t1', '2026-11-09'))
    expect(instanceId('t1', '2026-11-08')).not.toBe(instanceId('t2', '2026-11-08'))
  })
  it('формат UUID', () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    expect(instanceId('abc', '2026-11-08')).toMatch(re)
    expect(newId()).toMatch(re)
  })
})
