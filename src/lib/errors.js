// Перевод ошибок базы на человеческий язык.

/** Версия схемы, которую ждёт эта сборка приложения. Растёт с каждой миграцией. */
export const EXPECTED_SCHEMA = 1

export const MIGRATION_FILES = {
  1: 'supabase/schema.sql',
}

export function migrationHint(fromVersion) {
  const files = []
  for (let v = (fromVersion || 0) + 1; v <= EXPECTED_SCHEMA; v++) files.push(MIGRATION_FILES[v])
  if (!files.length) files.push(MIGRATION_FILES[EXPECTED_SCHEMA])
  return files
}

const SCHEMA_CODES = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205', 'PGRST200'])

/**
 * Классифицирует ошибку.
 * kind:
 *  - network — нет связи (действие остаётся в очереди и уйдёт позже)
 *  - schema  — база отстала от приложения
 *  - deleted — задачу удалили
 *  - auth    — нужно войти заново
 *  - denied  — нет прав
 *  - other
 */
export function classifyError(err) {
  if (!err) return { kind: 'other', message: 'Неизвестная ошибка' }
  const code = err.code || ''
  const msg = String(err.message || err.error_description || err || '')

  if (
    err.name === 'NetworkError' ||
    /Failed to fetch|NetworkError|Load failed|network|fetch failed|timeout|ECONN/i.test(msg) ||
    (err.status === 0 && !code) ||
    err.status === 502 || err.status === 503 || err.status === 504 || err.status === 544
  ) {
    return { kind: 'network', message: 'Нет связи с базой. Изменения сохранены на устройстве и уйдут, когда появится интернет.' }
  }

  if (SCHEMA_CODES.has(code)) {
    const files = migrationHint(0).join(', ')
    const what =
      code === '42P01' || code === 'PGRST205' ? 'не хватает таблицы'
      : code === '42703' || code === 'PGRST204' ? 'не хватает столбца'
      : 'не хватает функции'
    return {
      kind: 'schema',
      message: `База отстала от приложения (${what}, код ${code}). Откройте Supabase → SQL Editor и прогоните файл ${files} — или все миграции, которые ещё не прогоняли.`,
    }
  }

  if (code === '23514') {
    const m = msg.match(/constraint "([^"]+)"/)
    return {
      kind: 'schema',
      message: `База не приняла значение (проверка ${m ? m[1] : code}). Если приложение недавно обновлялось — база отстала: прогоните в SQL Editor последние файлы из папки supabase/migrations.`,
    }
  }

  if (code === 'KT404' || code === 'PGRST116' || /task_deleted/.test(msg)) {
    return { kind: 'deleted', message: 'Эту задачу уже удалили на другом устройстве — отметка не сохранена.' }
  }
  if (code === '23503') {
    return { kind: 'deleted', message: 'Связанная запись (раздел или шаблон) уже удалена на другом устройстве.' }
  }
  if (code === '42501' || code === 'PGRST301' || err.status === 403) {
    return { kind: 'denied', message: 'Нет прав на это действие. Если вы уверены, что права есть, — выйдите и войдите заново.' }
  }
  if (err.status === 401 || /JWT|refresh token/i.test(msg)) {
    return { kind: 'auth', message: 'Вход устарел. Выйдите и войдите заново (Ещё → Выйти).' }
  }
  if (code === '23505') {
    return { kind: 'other', message: 'Такая запись уже есть.' }
  }
  if (code === '22P02' || code === '22007' || code === '22008') {
    return { kind: 'other', message: `Неверный формат значения (код ${code}).` }
  }
  return { kind: 'other', message: `Не удалось сохранить: ${msg || code}` }
}
