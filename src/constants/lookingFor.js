import { T } from './tokens'

export const CATEGORIES = [
  'All','Products','Electronics','Fashion','Vehicles',
  'Property','Agriculture','Services','Jobs','Business Partners','Other',
]

export const CAT_EMOJI = {
  Electronics: '📱',
  Fashion: '👗',
  Vehicles: '🚗',
  Property: '🏠',
  Agriculture: '🌾',
  Services: '⚙️',
  Jobs: '💼',
  'Business Partners': '🤝',
  Products: '📦',
  Other: '📋',
}

export const SORT_OPTIONS = [
  { k: 'recent', l: 'Newest' },
  { k: 'budget', l: 'Top Budget' },
  { k: 'demand', l: 'Most Offers' },
  { k: 'urgent', l: 'Urgent First' },
]

export const URGENCY_OPTIONS = [
  { value: 'urgent',    label: 'Urgent',    color: T.red,    bg: '#fef2f2', border: '#fca5a5' },
  { value: 'this_week', label: 'This Week', color: T.amber,  bg: '#fffbeb', border: '#fcd34d' },
  { value: 'flexible',  label: 'Flexible',  color: T.gray600, bg: T.gray50,  border: T.gray200 },
]

/**
 * How long a Looking For post stays visible.
 * days: number | 'custom' | null (prefer not to say = no auto-expiry)
 */
export const DURATION_OPTIONS = [
  { days: 1,  label: '1 day',   hint: 'Flash need' },
  { days: 3,  label: '3 days',  hint: 'Quick hunt' },
  { days: 7,  label: '7 days',  hint: 'Recommended' },
  { days: 14, label: '14 days', hint: 'Two weeks' },
  { days: 30, label: '30 days', hint: 'Long search' },
  { days: 'custom', label: 'Customise', hint: 'Your own days' },
  { days: null, label: 'Prefer not to say', hint: 'No auto-expiry' },
]

export function expiresAtFromDays(days) {
  if (days == null || days === '' || days === 'none') return null
  const d = Number(days)
  if (!Number.isFinite(d) || d <= 0) return null
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString()
}