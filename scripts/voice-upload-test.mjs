import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
}

const ACCOUNT_ID = env.VITE_R2_ACCOUNT_ID
const ACCESS_KEY_ID = env.VITE_R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = env.VITE_R2_SECRET_ACCESS_KEY
const BUCKET = env.VITE_R2_BUCKET
const PUBLIC_URL = env.VITE_R2_PUBLIC_URL
const S3_ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function hmac(key, message) {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const msgBuffer = typeof message === 'string' ? new TextEncoder().encode(message) : message
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, msgBuffer)
}
async function hmacHex(key, message) {
  const buf = await hmac(key, message)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function getSigningKey(secret, date) {
  const kDate = await hmac(`AWS4${secret}`, date)
  const kRegion = await hmac(kDate, 'auto')
  const kService = await hmac(kRegion, 's3')
  return hmac(kService, 'aws4_request')
}
async function getSignedHeaders(method, key, contentType = '') {
  const url = `${S3_ENDPOINT}/${BUCKET}/${key}`
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = datetime.slice(0, 8)
  const canonicalHeaders = `content-type:${contentType}\nhost:${ACCOUNT_ID}.r2.cloudflarestorage.com\nx-amz-date:${datetime}\n`
  const signedHeaders = 'content-type;host;x-amz-date'
  const canonicalRequest = [method, `/${BUCKET}/${key}`, '', canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n')
  const credentialScope = `${date}/auto/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, await sha256(canonicalRequest)].join('\n')
  const signingKey = await getSigningKey(SECRET_ACCESS_KEY, date)
  const signature = await hmacHex(signingKey, stringToSign)
  const authorization = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return { url, datetime, authorization }
}

// Emulate uploadToR2 for an audio/webm file (compressImage is bypassed: not image/)
const file = { type: 'audio/webm', name: `voice_${Date.now()}.webm` }
const blob = Buffer.from('1a45dfa3' + '0000000000000000', 'hex') // minimal webm bytes
const path = `chat/voice-note-test/${file.name}`
const { url, datetime, authorization } = await getSignedHeaders('PUT', path, file.type)
const res = await fetch(url, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type,
    'x-amz-date': datetime,
    Authorization: authorization,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  },
  body: blob,
})
console.log('AUDIO_UPLOAD_STATUS', res.status)
if (res.ok) {
  const publicUrl = `${PUBLIC_URL}/${path}`
  console.log('AUDIO_UPLOAD_OK', publicUrl)
  const head = await fetch(publicUrl, { method: 'HEAD' })
  console.log('PUBLIC_READ_STATUS', head.status)
  // cleanup
  const del = await getSignedHeaders('DELETE', path, '')
  await fetch(del.url, {
    method: 'DELETE',
    headers: { 'Content-Type': '', 'x-amz-date': del.datetime, Authorization: del.authorization, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' },
  })
  console.log('CLEANUP_DONE')
} else {
  console.log('BODY', (await res.text()).slice(0, 300))
}
process.exit(0)
