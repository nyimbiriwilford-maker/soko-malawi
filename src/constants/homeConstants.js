export const ALL_CATEGORIES = ['Electronics', 'Furniture', 'Clothing', 'Vehicles', 'Property', 'Agriculture', 'Food', 'Services', 'Other']

export const CITIES = ['All', 'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi', 'Karonga', 'Salima']

export const PRICE_RANGES = [
  { label: 'Any price', min: 0, max: Infinity },
  { label: 'Under 5K', min: 0, max: 5000 },
  { label: '5K – 20K', min: 5000, max: 20000 },
  { label: '20K – 100K', min: 20000, max: 100000 },
  { label: '100K+', min: 100000, max: Infinity },
]

export const SORT_OPTIONS = ['Most recent', 'Price: Low–High', 'Price: High–Low']

export const CAT_META = {
  Electronics: { color: '#1a7a4a', bg: '#e6f4ec' },
  Furniture:   { color: '#b45309', bg: '#fef3c7' },
  Clothing:    { color: '#7c3aed', bg: '#ede9fe' },
  Vehicles:    { color: '#1d4ed8', bg: '#dbeafe' },
  Property:    { color: '#0f766e', bg: '#ccfbf1' },
  Agriculture: { color: '#15803d', bg: '#dcfce7' },
  Food:        { color: '#dc2626', bg: '#fee2e2' },
  Services:    { color: '#d97706', bg: '#fef3c7' },
  Other:       { color: '#6b7280', bg: '#f3f4f6' },
}

export const BADGE_META = {
  hot:      { label: '🔥 Hot',     bg: '#fef2f2', color: '#dc2626' },
  sale:     { label: '💸 Sale',    bg: '#fffbeb', color: '#d97706' },
  new_in:   { label: '🆕 New',     bg: '#eff6ff', color: '#1d4ed8' },
  limited:  { label: '⚡ Limited', bg: '#faf5ff', color: '#7c3aed' },
  featured: { label: '⭐ Featured',bg: '#fffbeb', color: '#f59e0b' },
}

export const CONDITION_SHORT = {
  new:       { label: 'New',      color: '#15803d' },
  like_new:  { label: 'Like New', color: '#1a7a4a' },
  good:      { label: 'Good',     color: '#0f766e' },
  fair:      { label: 'Fair',     color: '#b45309' },
  for_parts: { label: 'Parts',    color: '#6b7280' },
}

export const TYPE_SPEED_MIN = 55
export const TYPE_SPEED_MAX = 110
export const ERASE_SPEED = 38
export const PAUSE_AFTER_TYPE = 1800
export const PAUSE_AFTER_ERASE = 320