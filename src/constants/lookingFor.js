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