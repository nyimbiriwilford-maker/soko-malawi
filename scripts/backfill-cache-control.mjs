// Cache-Control backfill for image storage: R2 bucket + Supabase Storage buckets.
//
// Usage:
//   node scripts/backfill-cache-control.mjs                    # dry-run (default)
//   node scripts/backfill-cache-control.mjs --apply            # actually update metadata
//   node scripts/backfill-cache-control.mjs --r2-only          # skip Supabase pass
//   node scripts/backfill-cache-control.mjs --supabase-only    # skip R2 pass
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-cache-control.mjs --apply
//
// Sets Cache-Control: public, max-age=31536000, immutable on existing objects
// that were uploaded before that header existed. Dry-run lists exactly what
// would change (key, current headers) and counts; apply mode performs it.
//
// R2:    S3-compatible CopyObject with MetadataDirective=REPLACE (metadata is
//        additive on R2; REPLACE is required because a bare COPY directive keeps
//        the old headers verbatim). The object's existing Content-Type must also
//        be re-sent with REPLACE or it is dropped.
// Supabase: the REST copy endpoint silently ignores cacheControl on S3-backed
//          projects (supabase/storage#1109), so these objects are downloaded and
//          re-uploaded with a cache-control header on PUT.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ---------- env loading (mirrors scripts/cover-upload-test.mjs) ----------
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  const v = t.slice(eq + 1).trim()
  process.env[k] = v
  if (k === 'VITE_SUPABASE_URL' && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = v
  if (k === 'VITE_SUPABASE_ANON_KEY' && !process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = v
  if (k === 'VITE_R2_ACCOUNT_ID' && !process.env.R2_ACCOUNT_ID) process.env.R2_ACCOUNT_ID = v
  if (k === 'VITE_R2_ACCESS_KEY_ID' && !process.env.R2_ACCESS_KEY_ID) process.env.R2_ACCESS_KEY_ID = v
  if (k === 'VITE_R2_SECRET_ACCESS_KEY' && !process.env.R2_SECRET_ACCESS_KEY) process.env.R2_SECRET_ACCESS_KEY = v
  if (k === 'VITE_R2_BUCKET' && !process.env.R2_BUCKET) process.env.R2_BUCKET = v
}

const APPLY = process.argv.includes('--apply')
const DO_R2 = !process.argv.includes('--supabase-only')
const DO_SUPA = !process.argv.includes('--r2-only')
const TARGET_CACHE = 'public, max-age=31536000, immutable'
const SUPA_BUCKETS = ['shop-images', 'service-media', 'listings', 'avatars']
const REPORT_COUNT = 30

// ---------- SigV4 signing (browser r2.js logic ported to Node crypto) ----------
const { createHmac, createHash } = await import('node:crypto')

function sha256Hex(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex')
}
function hmac(key, msg) {
  return createHmac('sha256', key).update(msg, 'utf8').digest()
}
function hmacHex(key, msg) {
  return hmac(key, msg).toString('hex')
}
function getSigningKey(secret, date) {
  const kDate = hmac(`AWS4${secret}`, date)
  const kRegion = hmac(kDate, 'auto')
  const kService = hmac(kRegion, 's3')
  return hmac(kService, 'aws4_request')
}

// Build a signed request and fetch it. `path` is the canonical URI under the
// bucket (may be '' for the bucket root); `query` is the raw query string
// WITHOUT a leading '?'. `signedHeaders` are signed into the request;
// `extraHeaders` are sent but not signed on purpose.
async function signedRequest({ method, path = '', query = '', signedHeaders = {}, extraHeaders = {}, body = null }) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const canonicalUri = `/${R2_BUCKET}${path}`
  const url = `https://${host}${canonicalUri}${query ? `?${query}` : ''}`
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = datetime.slice(0, 8)

  const headers = {
    'host': host,
    'x-amz-date': datetime,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    ...signedHeaders,
  }
  const signedHeaderNames = ['host', 'x-amz-date', ...Object.keys(signedHeaders)].sort()
  const canonicalHeaders = signedHeaderNames.map(h => `${h}:${headers[h]}`).join('\n') + '\n'
  const signedHeaderString = signedHeaderNames.join(';')

  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    canonicalHeaders,
    signedHeaderString,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const credentialScope = `${date}/auto/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signingKey = getSigningKey(R2_SECRET_ACCESS_KEY, date)
  const signature = hmacHex(signingKey, stringToSign)
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderString}, Signature=${signature}`

  return fetch(url, {
    method,
    headers: { 'Authorization': authorization, ...headers, ...extraHeaders },
    body,
  })
}

async function listR2Objects(continuationToken = null, acc = []) {
  let query = 'list-type=2&max-keys=1000'
  if (continuationToken) query += `&continuation-token=${encodeURIComponent(continuationToken)}`
  const res = await signedRequest({ method: 'GET', query })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 403 || res.status === 401) throw new Error(`R2 list auth failed (${res.status}) ${text.slice(0, 400)}`)
    throw new Error(`R2 list failed (${res.status}) ${text.slice(0, 400)}`)
  }
  const xml = await res.text()
  const keys = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map(m => m[1]).filter(Boolean)
  acc.push(...keys)
  const nextToken = [...xml.matchAll(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/g)].map(m => m[1])[0]
  if (nextToken) return listR2Objects(nextToken, acc)
  return [...new Set(acc)]
}

// URL-encode each path segment so slashes survive (R2 expects the bucket prefix
// not to be double-encoded).
function r2ObjectPath(key) {
  return '/' + key.split('/').map(s => encodeURIComponent(s)).join('/')
}

async function headR2Object(key) {
  const res = await signedRequest({ method: 'HEAD', path: r2ObjectPath(key) })
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    cacheControl: res.headers.get('cache-control'),
  }
}

async function copyR2Object(key, contentType) {
  const copySource = `/${process.env.R2_BUCKET}/${key}`
  const res = await signedRequest({
    method: 'PUT',
    path: r2ObjectPath(key),
    signedHeaders: {
      'x-amz-copy-source': copySource,
      'x-amz-metadata-directive': 'REPLACE',
    },
    extraHeaders: {
      'content-type': contentType || 'application/octet-stream',
      'cache-control': TARGET_CACHE,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`R2 copy failed for ${key} (${res.status}): ${text.slice(0, 300)}`)
  }
}

function needsCache(cacheControl) {
  if (!cacheControl) return true
  const c = cacheControl.toLowerCase()
  return !(c.includes('31536000') && c.includes('immutable'))
}

async function summarizeR2() {
  console.log('\n=== R2 pass ===')
  const keys = await listR2Objects()
  console.log(`objects in bucket "${process.env.R2_BUCKET}": ${keys.length}`)
  const toFix = []
  const ok = []
  const errors = []
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    try {
      const head = await headR2Object(key)
      if (head.status === 404) continue
      if (needsCache(head.cacheControl)) toFix.push({ key, contentType: head.contentType, cacheControl: head.cacheControl })
      else ok.push({ key })
    } catch (e) {
      errors.push({ key, error: e.message })
    }
    if ((i + 1) % 50 === 0) console.log(`  ...inspected ${i + 1}/${keys.length}`)
  }
  console.log(`needs Cache-Control update: ${toFix.length}`)
  console.log(`already OK: ${ok.length}`)
  console.log(`errors: ${errors.length}`)
  if (errors.length) console.log('first errors:', errors.slice(0, 3).map(e => `${e.key}: ${e.error}`))
  for (const { key, contentType, cacheControl } of toFix.slice(0, REPORT_COUNT)) {
    console.log(`  - ${key}  (${contentType || 'no type'}) [${cacheControl || 'no cache-control'}]`)
  }
  if (toFix.length > REPORT_COUNT) console.log(`  ... and ${toFix.length - REPORT_COUNT} more`)

  if (!APPLY) return
  console.log('\nAPPLYING R2 metadata updates...')
  let applied = 0
  for (const { key, contentType } of toFix) {
    try {
      await copyR2Object(key, contentType)
      applied++
      if (applied % 25 === 0) console.log(`  done ${applied}/${toFix.length}`)
    } catch (e) {
      console.error(`  FAIL ${key}: ${e.message}`)
    }
  }
  console.log(`R2 apply complete. ${applied}/${toFix.length} succeeded.`)
}

async function listSupabaseFolder(supabase, bucket, prefix, acc) {
  acc = acc ?? []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`bucket "${bucket}"${prefix ? `/${prefix}` : ''} list failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const f of data) {
      const full = prefix ? `${prefix}/${f.name}` : f.name
      if (f.id === null) {
        await listSupabaseFolder(supabase, bucket, full, acc) // recurse into subfolder
      } else {
        acc.push({ ...f, name: full })
      }
    }
    if (data.length < 1000) break
    offset += 1000
  }
  return acc
}

async function listSupabaseObjects(supabase, bucket) {
  return listSupabaseFolder(supabase, bucket, '')
}

async function summarizeSupabase() {
  console.log('\n=== Supabase pass ===')
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  let totalObjects = 0
  let totalToFix = 0
  const errors = []
  for (const bucket of SUPA_BUCKETS) {
    console.log(`bucket "${bucket}":`)
    let objects
    try {
      objects = await listSupabaseObjects(supabase, bucket)
    } catch (e) {
      console.log('  list failed:', e.message)
      continue
    }
    console.log(`  objects found: ${objects.length}`)
    totalObjects += objects.length
    const toFix = objects.filter(o => needsCache(o.metadata?.cacheControl))
    totalToFix += toFix.length
    for (const o of toFix.slice(0, REPORT_COUNT)) {
      const c = o.metadata?.cacheControl || '(none)'
      console.log(`    - ${o.name} [${c}]`)
    }
    if (toFix.length > REPORT_COUNT) console.log(`    ... and ${toFix.length - REPORT_COUNT} more`)
  }
  console.log(`\nSupabase totals: ${totalToFix} of ${totalObjects} objects need the header`)

  if (!APPLY) return
  console.log('\nAPPLYING Supabase re-uploads...')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('  SKIPPED: SUPABASE_SERVICE_ROLE_KEY not set. Set it to re-upload with the storage update API.')
    return
  }
  let done = 0
  for (const bucket of SUPA_BUCKETS) {
    const objects = await listSupabaseObjects(supabase, bucket).catch(() => [])
    for (const o of objects) {
      if (!needsCache(o.metadata?.cacheControl)) continue
      try {
        const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${o.name}`)
        if (!res.ok) {
          console.error(`  FAIL download ${bucket}/${o.name} (${res.status})`)
          continue
        }
        const body = await res.arrayBuffer()
        const up = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${o.name}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'cache-control': TARGET_CACHE,
            'content-type': o.metadata?.mimetype || 'application/octet-stream',
            'x-upsert': 'true',
          },
          body,
        })
        if (!up.ok) {
          console.error(`  FAIL re-upload ${bucket}/${o.name} (${up.status})`)
          continue
        }
        done++
        if (done % 25 === 0) console.log(`  done ${done} re-uploads`)
      } catch (e) {
        errors.push(`${bucket}/${o.name}: ${e.message}`)
      }
    }
  }
  console.log(`Supabase apply: ${done} objects re-uploaded.`)
  if (errors.length) console.error('errors:', errors.slice(0, 5))
}

console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} (pass --apply to write)`)

if (DO_R2) await summarizeR2().catch(e => { console.error('R2 pass error:', e.message); process.exitCode = 1 })
if (DO_SUPA) await summarizeSupabase().catch(e => { console.error('Supabase pass error:', e.message); process.exitCode = 1 })

console.log('\nDone.')