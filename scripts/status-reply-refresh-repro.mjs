// Repro: status comments/replies disappear after refresh.
// Simulates the EXACT dual-write + load paths from src/components/StatusReplies.jsx
// against the LIVE database, with a "refresh" (brand-new clients) in between.
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

const stamp = Date.now()
const supA = createClient(URL, ANON)
const supB = createClient(URL, ANON)
const { data: a, error: ae } = await supA.auth.signUp({ email: `sr-a-${stamp}@sokotest.local`, password: 'Testpass123!' })
if (ae || !a.session) { console.log('SIGNUP_A_FAIL', ae?.message); process.exit(1) }
const { data: b, error: be } = await supB.auth.signUp({ email: `sr-b-${stamp}@sokotest.local`, password: 'Testpass123!' })
if (be || !b.session) { console.log('SIGNUP_B_FAIL', be?.message); process.exit(1) }
console.log('USERS  A(owner)=', a.user.id, ' B(commenter)=', b.user.id)

const clientA = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${a.session.access_token}` } } })
const clientB = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${b.session.access_token}` } } })

// --- A posts a status (minimal user_statuses row) ---
const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
const statusIns = await clientA.from('user_statuses').insert({ user_id: a.user.id, content: 'repro status ' + stamp, expires_at: expiresAt }).select('id').single()
if (statusIns.error) { console.log('STATUS_INSERT_FAIL', JSON.stringify(statusIns.error)); process.exit(1) }
const statusId = statusIns.data.id
console.log('STATUS_ID', statusId)

// --- B posts a reply via the EXACT hook dual-write ---
const marker = `[[status_reply:${statusId}]]`
const chatBody = [marker, 'hello from B', '', '— replied on your status', 'Status: "repro status"'].join('\n')
const msgRes = await clientB.from('messages').insert({
  from_user: b.user.id, to_user: a.user.id, body: chatBody, read: false, chat_source: 'direct',
}).select('id').single()
console.log('MSG_INSERT', msgRes.error ? 'FAIL ' + JSON.stringify(msgRes.error) : 'OK id=' + msgRes.data.id)

const replyRow = { status_id: statusId, from_user: b.user.id, to_user: a.user.id, body: 'hello from B', listing_id: null, message_id: msgRes.data?.id || null }
// EXACT hook insert: embeds author via profiles!from_user (this is what triggered PGRST200)
const replyIns = await clientB.from('status_replies').insert(replyRow).select(`
  id, body, created_at, from_user, listing_id,
  author:profiles!from_user ( id, full_name, avatar_url )
`).maybeSingle()
console.log('REPLY_INSERT', replyIns.error ? 'FAIL ' + JSON.stringify(replyIns.error) : 'OK id=' + replyIns.data?.id + ' author=' + JSON.stringify(replyIns.data?.author))

// ================= SIMULATED REFRESH: brand-new clients =================
const freshA = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${a.session.access_token}` } } })
const freshB = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${b.session.access_token}` } } })

// Hook's exact load() preferred query
async function hookLoad(client, label) {
  const { data, error, count } = await client.from('status_replies')
    .select('id, body, created_at, from_user, listing_id', { count: 'exact' })
    .eq('status_id', statusId)
    .order('created_at', { ascending: false })
    .limit(80)
  console.log(`LOAD[${label}]`, error ? 'ERROR ' + JSON.stringify(error) : `rows=${data.length}`, data?.map(r => r.body))
  return { data, error }
}
await hookLoad(freshB, 'B-after-refresh')
await hookLoad(freshA, 'A-after-refresh')

// Fallback path (messages marker) as the hook would use if status_replies errored
const { data: msgs, error: merr } = await freshB.from('messages').select('id, body').ilike('body', `%${marker}%`)
console.log('FALLBACK messages-marker', merr ? 'ERROR ' + JSON.stringify(merr) : `rows=${(msgs || []).length}`)

// RLS probe: can a THIRD unrelated authenticated user read the reply? (tests the new public-read policy)
const supC = createClient(URL, ANON)
const { data: c } = await supC.auth.signUp({ email: `sr-c-${stamp}@sokotest.local`, password: 'Testpass123!' })
if (c?.session) {
  const freshC = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${c.session.access_token}` } } })
  await hookLoad(freshC, 'C-unrelated')
}
console.log('DONE')
