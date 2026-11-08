import { useState } from 'react'
import { parseQty, formatQty } from '../lib/qty.js'
import { shortTime } from '../lib/time.js'

export const UNITS = ['кг', 'г', 'л', 'шт', 'порц.', 'уп.']

/** Общие поля задачи/шаблона: название, раздел, количество, время, примечание. */
export function useTaskFields(src) {
  const [title, setTitle] = useState(src?.title || '')
  const [sectionId, setSectionId] = useState(src?.section_id || null)
  const [qty, setQty] = useState(src?.qty !== null && src?.qty !== undefined ? formatQty(src.qty) : '')
  const [unit, setUnit] = useState(src?.unit || '')
  const [due, setDue] = useState(shortTime(src?.due_time))
  const [note, setNote] = useState(src?.note || '')
  const [error, setError] = useState('')

  const validate = () => {
    if (!title.trim()) return setError('Напишите, что нужно сделать'), null
    const q = parseQty(qty)
    if (Number.isNaN(q)) return setError('Количество — число, например 2,5'), null
    setError('')
    return {
      title: title.trim(),
      section_id: sectionId,
      qty: q,
      unit: unit.trim() || null,
      due_time: due || null,
      note: note.trim() || null,
    }
  }
  return { title, setTitle, sectionId, setSectionId, qty, setQty, unit, setUnit, due, setDue, note, setNote, error, validate }
}

