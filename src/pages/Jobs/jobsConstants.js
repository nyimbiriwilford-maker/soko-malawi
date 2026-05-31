export const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Volunteer']

export const CITIES = [
  'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu',
  'Mangochi', 'Karonga', 'Salima', 'Nkhotakota', 'Dedza',
  'Balaka', 'Liwonde', 'Rumphi', 'Chitipa', 'Mulanje'
]

export const CATEGORIES = [
  'Technology', 'Education', 'Health', 'Finance', 'Agriculture',
  'Construction', 'Transport', 'Hospitality', 'NGO / Non-profit',
  'Media & Communications', 'Legal', 'Engineering', 'Sales & Marketing', 'Other'
]

export const TYPE_COLORS = {
  'Full-time':  { bg: '#e6f7ee', text: '#1a7a4a', dot: '#1a7a4a' },
  'Part-time':  { bg: '#fff3e0', text: '#c96a00', dot: '#e67e00' },
  'Contract':   { bg: '#ebebff', text: '#3b3dd4', dot: '#3b3dd4' },
  'Internship': { bg: '#fce4ec', text: '#b0255f', dot: '#c0255f' },
  'Volunteer':  { bg: '#f3e5f5', text: '#7b1fa2', dot: '#7b1fa2' },
}

export const CATEGORY_ICONS = {
  'Technology': '💻',
  'Education': '📚',
  'Health': '🏥',
  'Finance': '💳',
  'Agriculture': '🌾',
  'Construction': '🏗️',
  'Transport': '🚗',
  'Hospitality': '🏨',
  'NGO / Non-profit': '🤝',
  'Media & Communications': '📡',
  'Legal': '⚖️',
  'Engineering': '⚙️',
  'Sales & Marketing': '📊',
  'Other': '📋',
}

export const EMPTY_JOB_FORM = {
  // Organisation
  title:           '',
  company:         '',
  logo_url:        '',
  overview:        '',
  address:         '',
  // Position
  type:            '',
  category:        '',
  city:            '',
  salary:          '',
  deadline:        '',
  // Role
  job_purpose:     '',
  description:     '',
  responsibilities:'',
  requirements:    '',
  // Application
  contact:         '',
  contact_name:    '',
  contact_address: '',
  // Media
  cover_image_url: '',
  // Legal
  disclaimer:      '',
}