import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  const v = t.slice(eq + 1).trim()
  process.env[k] = v
  if (k === 'VITE_SUPABASE_URL' && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = v
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const { data, error } = await supabase.auth.signUp({ email: `chatterr-${Date.now()}@sokotest.local`, password: 'Testpass123!' })
if (error || !data.session) process.exit(1)
const uid = data.user.id

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

// Force a failure to capture the real error object console.log would print
const up = await supabase.storage.from('listings').upload(`chat/${uid}/nope_${Date.now()}.png`, png, { contentType: 'image/png' })
console.log('ERROR_NULL_MEANS_SUCCESS', up.error === null)
console.log('FULL_ERROR_JSON', JSON.stringify(up.error, Object.getOwnPropertyNames(up.error || {}), 2))
console.log('KEYS', Object.getOwnPropertyNames(up.error || {}))
console.log('INSPECT', up.error)
process.exit(0)
