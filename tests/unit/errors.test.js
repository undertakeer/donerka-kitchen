import { describe, it, expect } from 'vitest'
import { classifyError } from '../../src/lib/errors.js'

describe('расшифровка ошибок базы', () => {
  it('нет сети', () => {
    expect(classifyError(new TypeError('Failed to fetch')).kind).toBe('network')
    expect(classifyError({ message: 'Load failed' }).kind).toBe('network')
  })
  it('42P01 / 42703 / 23514 → база отстала, с названием файла', () => {
    for (const code of ['42P01', '42703', 'PGRST204', 'PGRST202']) {
      const c = classifyError({ code, message: 'x' })
      expect(c.kind).toBe('schema')
      expect(c.message).toMatch(/SQL Editor/)
      expect(c.message).toMatch(/supabase\//)
    }
    const c = classifyError({ code: '23514', message: 'new row violates check constraint "templates_repeat_ok"' })
    expect(c.kind).toBe('schema')
    expect(c.message).toMatch(/templates_repeat_ok/)
  })
  it('задачу удалили', () => {
    expect(classifyError({ code: 'KT404', message: 'task_deleted' }).kind).toBe('deleted')
  })
  it('нет прав', () => {
    expect(classifyError({ code: '42501', message: 'permission denied' }).kind).toBe('denied')
  })
})
