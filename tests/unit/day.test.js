import { describe, it, expect } from 'vitest'
import { buildDay, groupDay, taskFromTemplate, missedTemplateTasks } from '../../src/lib/day.js'
import { instanceId } from '../../src/lib/ids.js'

const TODAY = '2026-11-08'
const tpl = (id, extra = {}) => ({
  id, title: id, section_id: 's1', repeat_kind: 'daily', start_date: '2026-11-01', archived_at: null, sort: 0, ...extra,
})
const row = (id, extra = {}) => ({ id, template_id: null, date: TODAY, title: id, section_id: 's1', done_at: null, deleted_at: null, ...extra })
const view = (templates = [], tasks = []) => ({
  sections: { s1: { id: 's1', name: 'Заготовки', sort: 10 }, s2: { id: 's2', name: 'Уборка', sort: 20 } },
  staff: {},
  templates: Object.fromEntries(templates.map((t) => [t.id, t])),
  tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
})

describe('список на день', () => {
  it('шаблон без записи → виртуальная задача на сегодня', () => {
    const items = buildDay(view([tpl('бульон')]), TODAY, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].virtual).toBe(true)
    expect(items[0].id).toBe(instanceId('бульон', TODAY))
  })
  it('шаблон и запись — без дубля', () => {
    const t = tpl('бульон')
    const items = buildDay(view([t], [taskFromTemplate(t, TODAY)]), TODAY, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].virtual).toBeUndefined()
  })
  it('удалённая сегодня повторяющаяся задача не воскресает', () => {
    const t = tpl('бульон')
    const items = buildDay(view([t], [{ ...taskFromTemplate(t, TODAY), deleted_at: 'x' }]), TODAY, TODAY)
    expect(items).toHaveLength(0)
  })
  it('прошлые дни — только реальные записи, без шаблонов', () => {
    const items = buildDay(view([tpl('бульон')]), '2026-11-05', TODAY)
    expect(items).toHaveLength(0)
  })
  it('будущий день — шаблоны видны', () => {
    const items = buildDay(view([tpl('бульон')]), '2026-11-10', TODAY)
    expect(items).toHaveLength(1)
  })
  it('несделанная разовая со вчера переносится с пометкой', () => {
    const items = buildDay(view([], [row('банкет', { date: '2026-11-07' })]), TODAY, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].carried).toBe(true)
  })
  it('у повторяющейся переносится только самый свежий хвост', () => {
    const t = tpl('бульон')
    const tasks = [taskFromTemplate(t, '2026-11-06'), taskFromTemplate(t, '2026-11-07'), taskFromTemplate(t, TODAY)]
    const items = buildDay(view([t], tasks), TODAY, TODAY)
    expect(items.map((x) => x.date).sort()).toEqual(['2026-11-07', TODAY])
    expect(missedTemplateTasks(view([t], tasks), TODAY).map((x) => x.date)).toEqual(['2026-11-06'])
  })
  it('удалённый хвост не переносится; слишком старый (>60 дней) — тоже', () => {
    const tasks = [row('a', { date: '2026-11-07', deleted_at: 'x' }), row('b', { date: '2026-08-01' })]
    expect(buildDay(view([], tasks), TODAY, TODAY)).toHaveLength(0)
  })
  it('хвост, закрытый сегодня, попадает в «Сделано» сегодня', () => {
    const tasks = [row('a', { date: '2026-11-07', done_at: '2026-11-08T05:00:00Z' })]
    const items = buildDay(view([], tasks), TODAY, TODAY)
    expect(items).toHaveLength(1)
    expect(groupDay(items, view().sections).doneCount).toBe(1)
  })
  it('сделанное вчера вчера — сегодня не показывается', () => {
    const tasks = [row('a', { date: '2026-11-07', done_at: '2026-11-07T10:00:00Z' })]
    expect(buildDay(view([], tasks), TODAY, TODAY)).toHaveLength(0)
  })
})

describe('группировка', () => {
  it('по разделам в их порядке, сделанное отдельно, прогресс', () => {
    const items = [
      row('x', { section_id: 's2' }),
      row('y', { section_id: 's1', due_time: '11:00' }),
      row('z', { section_id: 's1', due_time: '09:00' }),
      row('w', { section_id: null }),
      row('d', { done_at: '2026-11-08T05:00:00Z' }),
      row('ghost', { section_id: 'удалённый-раздел' }),
    ]
    const g = groupDay(items, view().sections)
    expect(g.groups.map((x) => x.section.name)).toEqual(['Заготовки', 'Уборка', 'Без раздела'])
    expect(g.groups[0].items.map((x) => x.id)).toEqual(['z', 'y'])
    expect(g.groups[2].items.map((x) => x.id).sort()).toEqual(['ghost', 'w'])
    expect(g.total).toBe(6)
    expect(g.doneCount).toBe(1)
  })
  it('перенесённые идут первыми в разделе', () => {
    const g = groupDay([row('new', { due_time: '08:00' }), row('old', { carried: true, due_time: '12:00' })], view().sections)
    expect(g.groups[0].items[0].id).toBe('old')
  })
})
