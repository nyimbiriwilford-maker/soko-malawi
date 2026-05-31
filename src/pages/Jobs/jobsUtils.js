export function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function daysLeft(deadline) {
  if (!deadline) return null
  const diff = new Date(deadline) - new Date()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return null
  if (days === 0) return { label: 'Closes today', urgent: true }
  if (days === 1) return { label: '1 day left', urgent: true }
  if (days <= 3) return { label: `${days} days left`, urgent: true }
  return { label: `${days} days left`, urgent: false }
}

export function formatDeadline(deadline) {
  if (!deadline) return null
  return new Date(deadline).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export function isEmail(c) { return c?.includes('@') }
export function isPhone(c) { return !!c?.match(/^\+?[\d\s\-()]+$/) }
export function isUrl(c) { return c?.startsWith('http') || c?.startsWith('www.') }

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function gradientFromName(name) {
  const gradients = [
    ['#1a7a4a', '#22a05e'],
    ['#1565c0', '#1976d2'],
    ['#6a1b9a', '#8e24aa'],
    ['#c62828', '#e53935'],
    ['#00695c', '#00897b'],
    ['#e65100', '#f57c00'],
    ['#283593', '#3949ab'],
  ]
  const idx = (name?.charCodeAt(0) || 0) % gradients.length
  return `linear-gradient(135deg, ${gradients[idx][0]}, ${gradients[idx][1]})`
}

/** Parse a textarea value (newline or bullet separated) into an array of trimmed strings */
export function parseLines(text) {
  if (!text) return []
  return text
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
}

export function validateJobForm(form) {
  const errors = {}
  if (!form.title?.trim()) errors.title = 'Job title is required'
  if (!form.company?.trim()) errors.company = 'Company name is required'
  if (!form.description?.trim()) errors.description = 'Job description is required'
  if (form.description?.trim().length < 30) errors.description = 'Description must be at least 30 characters'
  if (!form.type) errors.type = 'Please select a job type'
  if (!form.city) errors.city = 'Please select a city'
  return errors
}