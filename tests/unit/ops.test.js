import { describe, it, expect } from 'vitest'
import { EMPTY_BASE, enqueue, applyQueue, applyOp, dropWithDependents, pendingCount } from '../../src/lib/ops.js'

const task = (extra = {}) => ({ id: 't1', template_id: null, date: '2026-11-08', title: 'лук', done_at: null, deleted_at: null, ...extra })
const base = (tasks = [task()]) => ({ ...EMPTY_BASE, tasks: Object.fromEntries(tasks.map((t) => [t.id, t])) })
const done = (d, opId = Math.random().toString()) => ({ opId, type: 'task.done', id: 't1', done: d, at: '2026-11-08T05:00:00Z', staff_name: 'Азиз' })

describe('очередь отметок', () => {
  it('отметка видна сразу', () => {
    const b = base()
    const q = enqueue([], done(true), b)
    expect(applyQueue(b, q).tasks.t1.done_at).toBeTruthy()
    expect(applyQueue(b, q).tasks.t1.done_by_name).toBe('Азиз')
  })
  it('отметил и сразу снял — в базу ничего не уходит', () => {
    const b = base()
    let q = enqueue([], done(true), b)
    q = enqueue(q, done(false), b)
    expect(q).toHaveLength(0)
  })
  it('отметил-снял-отметил без сети → одна отметка', () => {
    const b = base()
    let q = enqueue([], done(true), b)
    q = enqueue(q, done(false), b)
    q = enqueue(q, done(true), b)
    expect(q).toHaveLength(1)
    expect(q[0].done).toBe(true)
  })
  it('действие «в полёте» не схлопывается — новое ставится следом', () => {
    const b = base()
    const first = done(true, 'A')
    let q = enqueue([], first, b)
    q = enqueue(q, done(false, 'B'), b, 'A')
    expect(q.map((o) => o.opId)).toEqual(['A', 'B'])
    expect(applyQueue(b, q).tasks.t1.done_at).toBe(null)
  })
  it('первая отметка выигрывает: чужая отметка не перезаписывается', () => {
    const b = base([task({ done_at: '2026-11-08T04:00:00Z', done_by_name: 'Оля' })])
    const s = applyOp(b, { type: 'task.done', id: 't1', done: true, at: '2026-11-08T05:00:00Z', staff_name: 'Азиз' })
    expect(s.tasks.t1.done_by_name).toBe('Оля')
  })
  it('отметка задачи, которая уже отмечена в базе, не ставится в очередь', () => {
    const b = base([task({ done_at: 'x' })])
    expect(enqueue([], done(true), b)).toHaveLength(0)
  })
  it('отметка виртуальной задачи: ensure + done, обе применяются', () => {
    const b = base([])
    let q = enqueue([], { opId: 'e', type: 'task.ensure', row: task() }, b)
    q = enqueue(q, done(true, 'd'), b)
    expect(q).toHaveLength(2)
    expect(applyQueue(b, q).tasks.t1.done_at).toBeTruthy()
    expect(pendingCount(q)).toBe(1)
  })
  it('повторный ensure не дублируется', () => {
    let q = enqueue([], { opId: 'e1', type: 'task.ensure', row: task() }, base([]))
    q = enqueue(q, { opId: 'e2', type: 'task.ensure', row: task() }, base([]))
    expect(q).toHaveLength(1)
  })
  it('откат: если база отказала в создании — уходят и зависимые отметки', () => {
    const q = [{ opId: 'e', type: 'task.ensure', row: task() }, done(true, 'd'), { opId: 'x', type: 'section.save', row: { id: 's' } }]
    expect(dropWithDependents(q, q[0]).map((o) => o.opId)).toEqual(['x'])
  })
  it('откат одной отметки возвращает экран к базе', () => {
    const b = base()
    const q = enqueue([], done(true, 'd'), b)
    expect(applyQueue(b, dropWithDependents(q, q[0])).tasks.t1.done_at).toBe(null)
  })
  it('удаление шаблона убирает его несделанные задачи, сделанные остаются', () => {
    const b = {
      ...EMPTY_BASE,
      templates: { tp: { id: 'tp', title: 'бульон' } },
      tasks: {
        a: task({ id: 'a', template_id: 'tp' }),
        b: task({ id: 'b', template_id: 'tp', done_at: 'x' }),
      },
    }
    const s = applyOp(b, { type: 'template.archive', id: 'tp', at: 'now' })
    expect(s.tasks.a.deleted_at).toBe('now')
    expect(s.tasks.b.deleted_at).toBe(null)
    expect(s.templates.tp.archived_at).toBe('now')
  })
})
