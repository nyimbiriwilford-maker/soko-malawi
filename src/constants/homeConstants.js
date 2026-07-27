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

export const STATUS_COLORS = {
  product:   '#0F9D58',
  listing:   '#0F9D58',
  shop:      '#1A73E8',
  job:       '#ea580c',
  service:   '#7c3aed',
  promotion: '#dc2626',
  promo:     '#dc2626',
  event:     '#dc2626',
  featured:  '#f9a825',
  verified:  '#059669',
}

export const STATUS_META = {
  listing:  { label: '🛒 Product',     color: STATUS_COLORS.listing },
  product:  { label: '🛒 Product',     color: STATUS_COLORS.product },
  shop:     { label: '🏪 Shop Update', color: STATUS_COLORS.shop },
  job:      { label: '💼 Job Vacancy', color: STATUS_COLORS.job },
  service:  { label: '🛠 Service',     color: STATUS_COLORS.service },
  promo:    { label: '📢 Promotion',   color: STATUS_COLORS.promo },
  promotion:{ label: '📢 Promotion',   color: STATUS_COLORS.promotion },
  event:    { label: '🎉 Event',       color: STATUS_COLORS.event },
  featured: { label: '⭐ Featured',    color: STATUS_COLORS.featured },
  verified: { label: '✔ Verified',     color: STATUS_COLORS.verified },
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