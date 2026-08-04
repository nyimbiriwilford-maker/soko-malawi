import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
}
const URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const ACCOUNT_ID = env.VITE_R2_ACCOUNT_ID
const ACCESS_KEY_ID = env.VITE_R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = env.VITE_R2_SECRET_ACCESS_KEY
const BUCKET = env.VITE_R2_BUCKET
const PUBLIC_URL = env.VITE_R2_PUBLIC_URL
const S3_ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`

async function sha256(m) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('') }
async function hmac(key, m) { const kb = typeof key === 'string' ? new TextEncoder().encode(key) : key; const mb = typeof m === 'string' ? new TextEncoder().encode(m) : m; const ck = await crypto.subtle.importKey('raw', kb, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return crypto.subtle.sign('HMAC', ck, mb) }
async function hmacHex(key, m) { return Array.from(new Uint8Array(await hmac(key, m))).map(x => x.toString(16).padStart(2, '0')).join('') }
async function getSigningKey(s, d) { const kd = await hmac(`AWS4${s}`, d); const kr = await hmac(kd, 'auto'); const ks = await hmac(kr, 's3'); return hmac(ks, 'aws4_request') }
async function getSignedHeaders(method, key, contentType = '') {
  const url = `${S3_ENDPOINT}/${BUCKET}/${key}`
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = datetime.slice(0, 8)
  const ch = `content-type:${contentType}\nhost:${ACCOUNT_ID}.r2.cloudflarestorage.com\nx-amz-date:${datetime}\n`
  const sh = 'content-type;host;x-amz-date'
  const cr = [method, `/${BUCKET}/${key}`, '', ch, sh, 'UNSIGNED-PAYLOAD'].join('\n')
  const scope = `${date}/auto/s3/aws4_request`
  const sts = ['AWS4-HMAC-SHA256', datetime, scope, await sha256(cr)].join('\n')
  const sk = await getSigningKey(SECRET_ACCESS_KEY, date)
  const sig = await hmacHex(sk, sts)
  return { url, datetime, authorization: `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${scope}, SignedHeaders=${sh}, Signature=${sig}` }
}

// isRelevantMessage recreated exactly as in Chat.jsx:579
function isRelevantMessage(msg, myId, otherUserId, source, ctxId) {
  const relevant = (msg.from_user === myId && msg.to_user === otherUserId) || (msg.from_user === otherUserId && msg.to_user === myId)
  if (!relevant) return false
  if (!ctxId || source === 'direct') {
    if (msg.chat_source && msg.chat_source !== 'direct') return false
    if (msg.listing_id || msg.service_id || msg.job_id || msg.shop_id || msg.request_id) return false
    return true
  }
  switch (source) {
    case 'service': return msg.service_id === ctxId
    case 'listing': return msg.listing_id === ctxId
    case 'job': return msg.job_id === ctxId || msg.chat_source === 'job'
    case 'shop': return msg.shop_id === ctxId || msg.chat_source === 'shop'
    case 'request': return msg.request_id === ctxId || msg.chat_source === 'request'
    default: return true
  }
}

const stamp = Date.now()
const supA = createClient(URL, ANON)
const supB = createClient(URL, ANON)
const { data: a, error: ae } = await supA.auth.signUp({ email: `tr-${stamp}@sokotest.local`, password: 'Testpass123!' })
if (ae || !a.session) { console.log('SIGNUP_A_FAIL', ae?.message); process.exit(1) }
const { data: b, error: be } = await supB.auth.signUp({ email: `tr2-${stamp}@sokotest.local`, password: 'Testpass123!' })
if (be || !b.session) { console.log('SIGNUP_B_FAIL', be?.message); process.exit(1) }
console.log('THREAD', a.user.id, '<->', b.user.id, '(generic direct, source=direct, ctxId=null)')

const clientA = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${a.session.access_token}` } } })

// 1. TEXT message first (the "working" case): messageContextFields('direct', null) = { chat_source: 'direct' }
const textIns = await clientA.from('messages').insert({
  from_user: a.user.id, to_user: b.user.id, body: 'hello text', media_url: null, media_type: 'text', read: false,
  chat_source: 'direct',
}).select('*').single()
console.log('TEXT_INSERT_ERR', textIns.error ? textIns.error.message : 'null')
const textRow = textIns.data

// 2. VOICE note: same thread, messageContextFields('direct', null) = { chat_source: 'direct' }
const path = `chat/${a.user.id}/audio_${stamp}.webm`
const { url, datetime, authorization } = await getSignedHeaders('PUT', path, 'audio/webm')
const up = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'audio/webm', 'x-amz-date': datetime, Authorization: authorization, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' }, body: Buffer.from('1a45dfa3' + '0000000000000000', 'hex') })
console.log('R2_UPLOAD', up.status)
const mediaUrl = `${PUBLIC_URL}/${path}`
const voiceIns = await clientA.from('messages').insert({
  from_user: a.user.id, to_user: b.user.id, body: '', media_url: mediaUrl, media_type: 'audio', read: false,
  chat_source: 'direct',
}).select('*').single()
console.log('VOICE_INSERT_ERR', voiceIns.error ? voiceIns.error.message : 'null')
const voiceRow = voiceIns.data

// 3. Query the thread exactly as loadMessages does (generic direct: no context filter)
const q = await clientA.from('messages').select('*')
  .or(`and(from_user.eq.${a.user.id},to_user.eq.${b.user.id}),and(from_user.eq.${b.user.id},to_user.eq.${a.user.id})`)
  .order('created_at', { ascending: true })
console.log('\nLOADED_ROWS (what the thread view would render):', q.error ? q.error.message : q.data.length)
for (const r of q.data || []) {
  console.log(`  - media_type=${r.media_type} body=${JSON.stringify(r.body)} chat_source=${r.chat_source} listing_id=${r.listing_id} service_id=${r.service_id} job_id=${r.job_id} shop_id=${r.shop_id} request_id=${r.request_id}`)
}

// 4. Evaluate isRelevantMessage for each row as viewed in the generic direct thread
console.log('\nisRelevantMessage(direct view, ctxId=null):')
for (const r of [textRow, voiceRow]) {
  const verdict = isRelevantMessage(r, a.user.id, b.user.id, 'direct', null)
  console.log(`  - ${r.media_type}: ${verdict ? 'RELEVANT → would render' : 'DROPPED → would NOT render'}`)
}

// cleanup
for (const r of [textRow, voiceRow]) if (r?.id) await clientA.from('messages').delete().eq('id', r.id)
const del = await getSignedHeaders('DELETE', path, '')
await fetch(del.url, { method: 'DELETE', headers: { 'Content-Type': '', 'x-amz-date': del.datetime, Authorization: del.authorization, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' } })
console.log('\nCLEANUP_DONE')
process.exit(0)
