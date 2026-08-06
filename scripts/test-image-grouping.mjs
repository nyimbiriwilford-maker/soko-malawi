import { ImageGroupingService } from '../src/lib/imageGroupingService.js'

const svc = new ImageGroupingService()

// Helper to build a fake image message
function img(id, fromUser, createdAt, url = `https://r2.dev/${id}.jpg`) {
  return { id, from_user: fromUser, created_at: createdAt, media_type: 'image', media_url: url }
}

// Helper to build a fake text message
function txt(id, fromUser, createdAt) {
  return { id, from_user: fromUser, created_at: createdAt, media_type: 'text', media_url: null, body: 'hi' }
}

// Helper for ISO timestamp offset from a base
const base = new Date('2026-08-06T10:00:00Z').getTime()
const t = (offsetSeconds) => new Date(base + offsetSeconds * 1000).toISOString()

const assert = (cond, label) => {
  if (!cond) {
    console.log(`${label}`)
    process.exitCode = 1
    throw new Error(label)
  }
}

// TEST 1 — Two images within 60s are grouped
const r1 = svc.groupMessages([img('a', 'u1', t(0)), img('b', 'u1', t(30))])
assert(r1.length === 1 && r1[0]._isGroup && r1[0]._imageGroup.length === 2, 'TEST 1 FAIL')
console.log('TEST 1 PASS — 2 images within 60s grouped')

// TEST 2 — Five consecutive images are grouped
const r2 = svc.groupMessages([0, 10, 20, 30, 40].map((s, i) => img(`c${i}`, 'u1', t(s))))
assert(r2.length === 1 && r2[0]._isGroup && r2[0]._imageGroup.length === 5, 'TEST 2 FAIL')
console.log('TEST 2 PASS — 5 consecutive images grouped')

// TEST 3 — Images more than 60s apart are NOT grouped
const r3 = svc.groupMessages([img('d1', 'u1', t(0)), img('d2', 'u1', t(61))])
assert(r3.length === 2, 'TEST 3 FAIL')
console.log('TEST 3 PASS — images >60s apart not grouped')

// TEST 4 — Text message breaks an image group
const r4 = svc.groupMessages([img('e1', 'u1', t(0)), txt('e2', 'u1', t(5)), img('e3', 'u1', t(10))])
assert(r4.length === 3 && !r4[0]._isGroup && !r4[2]._isGroup, 'TEST 4 FAIL')
console.log('TEST 4 PASS — text breaks image group')

// TEST 5 — Images from different users never group
const r5 = svc.groupMessages([img('f1', 'u1', t(0)), img('f2', 'u2', t(5))])
assert(r5.length === 2 && !r5[0]._isGroup && !r5[1]._isGroup, 'TEST 5 FAIL')
console.log('TEST 5 PASS — different senders not grouped')

// TEST 6 — More than 9 images split into separate groups
const r6 = svc.groupMessages([...Array(10)].map((_, i) => img(`g${i}`, 'u1', t(i * 2))))
assert(r6.length === 2 && r6[0]._imageGroup.length === 9 && !r6[1]._isGroup, 'TEST 6 FAIL — should be group of 9 + single bubble')
console.log('TEST 6 PASS — 10 images split into group of 9 + 1')

// TEST 7 — appendMessage correctly joins an image to an existing group
const base7 = svc.groupMessages([img('h1', 'u1', t(0)), img('h2', 'u1', t(10))])
const r7 = svc.appendMessage(base7, img('h3', 'u1', t(20)))
assert(r7.length === 1 && r7[0]._imageGroup.length === 3, 'TEST 7 FAIL')
console.log('TEST 7 PASS — appendMessage joins image into existing group')

// TEST 8 — appendMessage does NOT join image from different sender
const base8 = svc.groupMessages([img('i1', 'u1', t(0)), img('i2', 'u1', t(10))])
const r8 = svc.appendMessage(base8, img('i3', 'u2', t(20)))
assert(r8.length === 2, 'TEST 8 FAIL')
console.log('TEST 8 PASS — appendMessage rejects different sender')

// TEST 9 — appendMessage does NOT join image after 60s gap
const base9 = svc.groupMessages([img('j1', 'u1', t(0)), img('j2', 'u1', t(10))])
const r9 = svc.appendMessage(base9, img('j3', 'u1', t(80)))
assert(r9.length === 2, 'TEST 9 FAIL')
console.log('TEST 9 PASS — appendMessage rejects image after 60s gap')

// TEST 10 — Duplicate messages are deduplicated by groupMessages
const r10 = svc.groupMessages([img('k1', 'u1', t(0)), img('k1', 'u1', t(0)), img('k2', 'u1', t(10))])
assert(r10.length === 1 && r10[0]._imageGroup.length === 2, 'TEST 10 FAIL — duplicate not deduped')
console.log('TEST 10 PASS — duplicate messages deduplicated')

// TEST 11 — Out-of-order messages are sorted before grouping
const r11 = svc.groupMessages([img('l2', 'u1', t(30)), img('l1', 'u1', t(0)), img('l3', 'u1', t(15))])
assert(r11.length === 1 && r11[0]._imageGroup.map(m => m.id).join(',') === 'l1,l3,l2', 'TEST 11 FAIL — wrong order')
console.log('TEST 11 PASS — out-of-order messages sorted correctly')

// TEST 12 — Single image after group deletion collapses to single bubble
const r12base = svc.groupMessages([img('m1', 'u1', t(0)), img('m2', 'u1', t(10)), img('m3', 'u1', t(20))])
assert(r12base[0]._imageGroup.length === 3, 'TEST 12 setup FAIL')
const r12 = svc.groupMessages([img('m1', 'u1', t(0))])
assert(!r12[0]._isGroup, 'TEST 12 FAIL — single remaining image should not be _isGroup')
console.log('TEST 12 PASS — deleted group member collapses to single bubble')

// TEST 13 — configurable windowMs is respected
const svc13 = new ImageGroupingService({ windowMs: 10000 })
const r13a = svc13.groupMessages([img('n1', 'u1', t(0)), img('n2', 'u1', t(9))])
const r13b = svc13.groupMessages([img('n3', 'u1', t(0)), img('n4', 'u1', t(11))])
assert(r13a.length === 1 && r13a[0]._isGroup, 'TEST 13a FAIL — should group within 10s window')
assert(r13b.length === 2, 'TEST 13b FAIL — should not group outside 10s window')
console.log('TEST 13 PASS — configurable windowMs respected')

// TEST 14 — configurable maxGroupSize is respected
const svc14 = new ImageGroupingService({ maxGroupSize: 3 })
const r14 = svc14.groupMessages([...Array(4)].map((_, i) => img(`o${i}`, 'u1', t(i * 5))))
assert(r14.length === 2 && r14[0]._imageGroup.length === 3, 'TEST 14 FAIL')
console.log('TEST 14 PASS — configurable maxGroupSize respected')

console.log('\nALL 14 TESTS PASSED')