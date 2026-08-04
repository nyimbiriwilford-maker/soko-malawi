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

const stamp = Date.now()
const supA = createClient(URL, ANON)
const supB = createClient(URL, ANON)
const { data: a, error: ae } = await supA.auth.signUp({ email: `va-${stamp}@sokotest.local`, password: 'Testpass123!' })
if (ae || !a.session) { console.log('SIGNUP_A_FAIL', ae?.message); process.exit(1) }
const { data: b, error: be } = await supB.auth.signUp({ email: `vb-${stamp}@sokotest.local`, password: 'Testpass123!' })
if (be || !b.session) { console.log('SIGNUP_B_FAIL', be?.message); process.exit(1) }
console.log('USERS_OK', a.user.id, '->', b.user.id)

const authA = { global: { headers: { Authorization: `Bearer ${a.session.access_token}` } } }
const clientA = createClient(URL, ANON, authA)
const authB = { global: { headers: { Authorization: `Bearer ${b.session.access_token}` } } }
const clientB = createClient(URL, ANON, authB)

// 1. Voice note: exactly what uploadAndSend does — uploadToR2(file=audio/webm, path)
const fileName = `voice_${stamp}.webm`
const path = `chat/${a.user.id}/audio_${stamp}.webm`
const fileType = 'audio/webm'
const webmBytes = Buffer.from('1a45dfa3' + '0000000000000000', 'hex')
const { url, datetime, authorization } = await getSignedHeaders('PUT', path, fileType)
const up = await fetch(url, { method: 'PUT', headers: { 'Content-Type': fileType, 'x-amz-date': datetime, Authorization: authorization, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' }, body: webmBytes })
console.log('R2_UPLOAD', up.status)
if (!up.ok) process.exit(1)
const mediaUrl = `${PUBLIC_URL}/${path}`

// 2. Exactly what sendMessage does — messages.insert with media_type='audio', body=''
const msgData = {
  from_user: a.user.id,
  to_user: b.user.id,
  body: '',
  media_url: mediaUrl,
  media_type: 'audio',
  read: false,
}
const ins = await clientA.from('messages').insert(msgData).select('*').single()
console.log('INSERT_ERROR_FIELD', ins.error ? JSON.stringify(ins.error, Object.getOwnPropertyNames(ins.error)) : 'null')
console.log('INSERTED', ins.data ? JSON.stringify(ins.data) : 'null')

// 3. Query most recent row for sender, order by created_at desc limit 1
const q = await clientA.from('messages').select('*').eq('from_user', a.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
console.log('RECENT_ROW', q.data ? JSON.stringify(q.data) : 'null')
console.log('RECENT_ERROR', q.error ? q.error.message : 'null')

// 4. Also check distinct media_type values already in the table (does 'audio' already exist?)
const dt = await clientB.from('messages').select('media_type').eq('to_user', b.user.id).limit(5)
console.log('MEDIA_TYPES_SAMPLE', JSON.stringify(dt.data))

// cleanup
if (ins.data) await clientA.from('messages').delete().eq('id', ins.data.id)
const del = await getSignedHeaders('DELETE', path, '')
await fetch(del.url, { method: 'DELETE', headers: { 'Content-Type': '', 'x-amz-date': del.datetime, Authorization: del.authorization, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' } })
console.log('CLEANUP_DONE')
process.exit(0)
