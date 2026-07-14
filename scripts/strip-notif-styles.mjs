import fs from 'fs'

const p = new URL('../src/pages/Notifications.jsx', import.meta.url)
let c = fs.readFileSync(p, 'utf8')

const startMarker = '<style>{`'
const endMarker = '`}</style>'
const start = c.indexOf(startMarker)
const end = c.indexOf(endMarker)

if (start < 0 || end < 0) {
  console.error('style block not found', { start, end })
  process.exit(1)
}

const before = c.slice(0, start)
const after = c.slice(end + endMarker.length)
c = before + after

if (!c.includes("notifications.css")) {
  c = c.replace(
    "import BottomNav from '../components/BottomNav'",
    "import BottomNav from '../components/BottomNav'\nimport '../styles/notifications.css'"
  )
}

// clean leftover blank lines where style was
c = c.replace(/return \(\s*\n\s*\n\s*<div className="notifications-page">/, 'return (\n    <div className="notifications-page">')

fs.writeFileSync(p, c)
console.log('Stripped inline styles. New size:', fs.statSync(p).size)
