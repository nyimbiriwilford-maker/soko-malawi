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
const EMAIL = `covtest3-${Date.now()}@sokotest.local`
const PASSWORD = 'Testpass123!'
const { data, error } = await supabase.auth.signUp({ email: EMAIL, password: PASSWORD })
if (error || !data.session) { console.log('SIGNUP_FAIL', error?.message || 'no session'); process.exit(1) }
const uid = data.user.id
console.log('SIGNUP_OK uid=', uid)

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

// Create a throwaway shop owned by the test user (RLS allows owner insert)
const slug = `covtest-${Date.now().toString(36)}`
const { data: shop, error: shopErr } = await supabase.from('shops').insert({
  owner_id: uid, name: 'Cover Test Shop', slug, description: 'temp',
}).select('id').single()
if (shopErr) { console.log('SHOP_INSERT_FAIL', shopErr.message); process.exit(1) }
console.log('SHOP_OK', shop.id)

// Simulate the FIXED path exactly as ShopPage will: <uid>/covers/<uuid>.png
const path = `${uid}/covers/${crypto.randomUUID()}.png`
const up = await supabase.storage.from('shop-images').upload(path, png, { contentType: 'image/png' })
if (up.error) { console.log('UPLOAD_FAIL', up.error.statusCode, up.error.message); process.exit(1) }
console.log('UPLOAD_OK', up.data.path)

const { data: pub } = supabase.storage.from('shop-images').getPublicUrl(up.data.path)
console.log('PUBLIC_URL', pub.publicUrl)

// Update shops.cover_url exactly like handleCoverChange does
const upd = await supabase.from('shops').update({ cover_url: pub.publicUrl }).eq('id', shop.id)
if (upd.error) { console.log('UPDATE_FAIL', upd.error.message); process.exit(1) }

const { data: check } = await supabase.from('shops').select('id, cover_url').eq('id', shop.id).maybeSingle()
console.log('VERIFY cover_url ===', check?.cover_url === pub.publicUrl ? 'MATCH' : `MISMATCH (${check?.cover_url})`)

// Confirm the object is publicly readable (bucket is public)
const head = await fetch(pub.publicUrl, { method: 'HEAD' })
console.log('PUBLIC_READ status:', head.status)

// cleanup
await supabase.storage.from('shop-images').remove([up.data.path])
await supabase.from('shops').delete().eq('id', shop.id)
process.exit(0)
