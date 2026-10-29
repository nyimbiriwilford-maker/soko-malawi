import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
const INCLUDE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json'])
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.aider.tags.cache.v4', '.kilo'])
const TARGET_FILES = new Set(['index.html', 'vite.config.js', 'sw.js'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue
      walk(full, out)
    } else {
      const ext = extname(name)
      if (INCLUDE_EXT.has(ext) || TARGET_FILES.has(name)) out.push(full)
    }
  }
  return out
}

const bad = []
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (/^\s*EOF\s*$/.test(line)) bad.push(`${file}:${i + 1}: stray EOF line`)
    if (/<<\s*'EOF'/.test(line) || /<<\s*EOF/.test(line)) bad.push(`${file}:${i + 1}: heredoc leftover`)
  })
}

if (bad.length) {
  console.error('Source safety check failed:')
  for (const b of bad) console.error('  ' + b)
  process.exit(1)
}
console.log('Source safety check passed.')