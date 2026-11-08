// Проверка: в репозиторий и в собранный сайт не попали секретные ключи Supabase.
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const PATTERNS = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'секретный ключ sb_secret_'],
  [/service_role/, 'упоминание service_role'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'JWT-ключ (возможно service_role)'],
  [/SUPABASE_SERVICE/, 'переменная SUPABASE_SERVICE*'],
]
const ALLOW = new Set(['scripts/check-secrets.mjs'])

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean)
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
for (const d of ['dist', 'dist-demo']) if (existsSync(d)) files.push(...walk(d))

let bad = 0
for (const f of files) {
  if (ALLOW.has(f) || /\.(png|jpg|ico|woff2?)$/.test(f)) continue
  let text
  try { text = readFileSync(f, 'utf8') } catch { continue }
  for (const [re, what] of PATTERNS) {
    // в SQL-комментариях и README про service_role говорить можно
    if (what === 'упоминание service_role' && /\.(sql|md)$/.test(f)) continue
    if (re.test(text)) {
      console.error(`✗ ${f}: найден ${what}`)
      bad++
    }
  }
}
if (bad) {
  console.error('\nСекреты не должны попадать в репозиторий. Уберите их и смените ключ в Supabase.')
  process.exit(1)
}
console.log(`✓ секретов нет (проверено файлов: ${files.length})`)
