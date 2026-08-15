import { Wrench, Zap, BookOpen, Scissors, Sparkles, Camera, Brush, Hammer, Car, Laptop, PenTool, ChefHat, Flower, ShieldCheck, Stethoscope, Truck, Clock, Star, Eye, BadgeCheck } from 'lucide-react'

export const SERVICE_CATS = [
  { emoji: '🔧', icon: Wrench,        name: 'Plumbing' },
  { emoji: '⚡', icon: Zap,           name: 'Electrical' },
  { emoji: '📚', icon: BookOpen,      name: 'Tutoring' },
  { emoji: '✂️', icon: Scissors,      name: 'Tailoring' },
  { emoji: '🧹', icon: Sparkles,      name: 'Cleaning' },
  { emoji: '📸', icon: Camera,        name: 'Photography' },
  { emoji: '💇', icon: Brush,         name: 'Hair & Beauty' },
  { emoji: '🪚', icon: Hammer,        name: 'Carpentry' },
  { emoji: '🚗', icon: Car,           name: 'Transport' },
  { emoji: '💻', icon: Laptop,        name: 'Tech & IT' },
  { emoji: '🎨', icon: PenTool,       name: 'Design' },
  { emoji: '🍳', icon: ChefHat,       name: 'Catering' },
  { emoji: '🌿', icon: Flower,        name: 'Gardening' },
  { emoji: '🔐', icon: ShieldCheck,   name: 'Security' },
  { emoji: '🏥', icon: Stethoscope,   name: 'Healthcare' },
  { emoji: '📦', icon: Truck,         name: 'Delivery' },
]

export const CITIES = ['All', 'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi', 'Karonga', 'Salima']

export const AVAILABILITY_OPTIONS = [
  'Available today',
  'Weekdays only',
  'Weekends only',
  'By appointment',
  'Evenings only',
  'Full time',
]

export const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest',      icon: Clock },
  { value: 'rating',  label: 'Top rated',    icon: Star },
  { value: 'views',   label: 'Most viewed',  icon: Eye },
  { value: 'verified',label: 'Verified',     icon: BadgeCheck },
]

export function avatarColor(name) {
  const colors = ['#1a7a4a', '#d4920a', '#534AB7', '#c0392b', '#2980b9', '#8e44ad']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + hash
  return colors[hash % colors.length]
}

export function initials(name) {
  return (name || 'P').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days < 7) return days + 'd ago'
  return new Date(date).toLocaleDateString()
}

export function renderStars(rating, size = 13) {
  const full = Math.floor(rating)
  let out = ''
  for (let i = 0; i < 5; i++) out += i < full ? '★' : '☆'
  return out
}

export function formatWhatsApp(number, name, category) {
  const clean = (number || '').replace(/\s+/g, '').replace(/^0/, '265')
  const msg = encodeURIComponent(`Hi ${name}, I found your ${category} service on Soko Malawi and I'd like to enquire.`)
  return `https://wa.me/${clean}?text=${msg}`
}

// ─── Styles ────────────────────────────────────────────────────────────────

export const S = {
  // Layout
  page: { minHeight: '100vh', background: '#f4f8f5', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' },

  // Header
  header: { background: '#fff', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#e8f0eb', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 50 },
  headerTop: { padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: '22px', fontWeight: '800', color: '#0f1410' },
  headerSub: { fontSize: '12px', color: '#888', marginTop: '2px' },
  offerBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },

  // Search
  searchBox: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f4f8f5', borderRadius: '12px', padding: '10px 14px', margin: '0 14px 10px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#e8f0eb' },
  searchInput: { flex: 1, border: 'none', background: 'transparent', fontSize: '14px', color: '#0f1410', fontFamily: 'inherit' },
  clearBtn: { background: 'none', border: 'none', color: '#aaa', fontSize: '14px', cursor: 'pointer', padding: '0 2px' },

  // Tabs
  tabs: { display: 'flex', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#f0f0f0', overflowX: 'auto' },
  tab: { flexShrink: 0, background: 'none', border: 'none', borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: 'transparent', padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#888', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px' },
  tabActive: { color: '#1a7a4a', borderBottomColor: '#1a7a4a' },
  tabBadge: { background: '#1a7a4a', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: '800' },

  // Feed
  feed: { padding: '14px' },
  sectionLabel: { fontSize: '11px', fontWeight: '800', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
  countBadge: { background: '#e6f7ee', color: '#1a7a4a', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' },

  // Category chips
  catScrollRow: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '12px' },
  catChip: { flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#e8f0eb', borderRadius: '20px', padding: '6px 13px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  catChipActive: { background: '#1a7a4a', borderColor: '#1a7a4a' },
  catChipIcon: { fontSize: '15px' },
  catChipName: { fontSize: '12px', fontWeight: '700', color: '#333' },
  catChipNameActive: { color: '#fff' },
  catChipCount: { fontSize: '10px', fontWeight: '700', color: '#1a7a4a', background: '#e6f7ee', borderRadius: '10px', padding: '1px 5px' },
  catChipCountActive: { background: 'rgba(255,255,255,0.25)', color: '#fff' },

  // Active cat banner
  catFilterBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px' },
  catFilterBannerText: { fontSize: '13px', fontWeight: '700', color: '#fff' },
  catFilterBannerClear: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', padding: '4px 10px', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' },

  // City row
  cityRow: { display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '2px' },
  cityChip: { flexShrink: 0, background: '#fff', borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#e8f0eb', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', color: '#637068', cursor: 'pointer', fontFamily: 'inherit' },
  cityChipActive: { background: '#1a7a4a', borderColor: '#1a7a4a', color: '#fff' },

  // Sort + filter
  sortRow: { display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' },
  sortChip: { flexShrink: 0, background: '#fff', borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#e8f0eb', borderRadius: '20px', padding: '5px 12px', fontSize: '11px', fontWeight: '600', color: '#637068', cursor: 'pointer', fontFamily: 'inherit' },
  sortChipActive: { background: '#0f1410', borderColor: '#0f1410', color: '#fff' },

  // Filter panel
  filterPanel: { background: '#fff', borderRadius: '16px', padding: '16px', marginBottom: '14px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#e8f0eb', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' },
  filterPanelTitle: { fontSize: '11px', fontWeight: '800', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' },
  filterRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' },
  filterChip: { background: '#f4f8f5', borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'transparent', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', color: '#637068', cursor: 'pointer', fontFamily: 'inherit' },
  filterChipActive: { background: '#e6f7ee', borderColor: '#1a7a4a', color: '#1a7a4a' },
  filterApplyBtn: { width: '100%', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  filterResetBtn: { background: 'none', border: 'none', color: '#aaa', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', marginTop: '8px', display: 'block', width: '100%', textAlign: 'center' },

  // Skeleton / empty
  skeleton: { height: '140px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', borderRadius: '16px', marginBottom: '12px', animation: 'pulse 1.5s infinite' },
  empty: { textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  emptyTitle: { fontSize: '17px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  emptySub: { fontSize: '13px', color: '#888', marginBottom: '20px', lineHeight: '1.6' },
  postFirstBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '11px 24px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },

  // Provider card
  providerCard: { background: '#fff', borderWidth: '1px', borderStyle: 'solid', borderColor: '#eef3ef', borderRadius: '18px', marginBottom: '14px', cursor: 'pointer', animation: 'fadeUp 0.3s ease both', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden', position: 'relative' },
  providerCardMedia: { width: '100%', height: '130px', objectFit: 'cover', display: 'block', background: '#f0f4f1' },
  providerCardMediaPlaceholder: { width: '100%', height: '90px', background: 'linear-gradient(135deg,#1a7a4a18,#22a05e0e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' },
  providerCardBody: { padding: '14px' },
  providerTop: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  avatar: { width: '46px', height: '46px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', flexShrink: 0 },
  providerInfo: { flex: 1, minWidth: 0 },
  providerName: { fontSize: '15px', fontWeight: '700', color: '#0f1410', marginBottom: '2px' },
  providerMeta: { fontSize: '11px', color: '#888' },
  rate: { fontSize: '14px', fontWeight: '800', color: '#1a7a4a', whiteSpace: 'nowrap' },
  tagRow: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' },
  tag: { background: '#f0f4f1', color: '#637068', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '500' },
  tagGreen: { background: '#e6f7ee', color: '#1a7a4a', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '600' },
  tagGrey: { background: '#f5f5f5', color: '#555', borderRadius: '6px', padding: '3px 8px', fontSize: '11px' },
  tagBlue: { background: '#e8eaff', color: '#3b4dd4', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '600' },

  // Quick action buttons on card
  cardActions: { display: 'flex', gap: '8px', marginTop: '10px' },
  cardChatBtn: { flex: 1, background: '#e6f7ee', border: 'none', borderRadius: '10px', padding: '9px', fontSize: '12px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer', fontFamily: 'inherit' },
  cardCallBtn: { flex: 1, background: '#f4f8f5', border: 'none', borderRadius: '10px', padding: '9px', fontSize: '12px', fontWeight: '700', color: '#0f1410', cursor: 'pointer', fontFamily: 'inherit' },
  cardWhatsAppBtn: { flex: 1, background: '#e7f9ee', border: 'none', borderRadius: '10px', padding: '9px', fontSize: '12px', fontWeight: '700', color: '#128c3e', cursor: 'pointer', fontFamily: 'inherit' },

  // My service management card
  myServiceCard: { background: '#fff', borderWidth: '1px', borderStyle: 'solid', borderColor: '#eef3ef', borderRadius: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' },
  myServiceHeader: { background: 'linear-gradient(135deg,#0f1410,#1a2b20)', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' },
  myServiceAvatar: { width: '48px', height: '48px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '800', flexShrink: 0, borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.2)' },
  myServiceName: { fontSize: '15px', fontWeight: '700', color: '#fff' },
  myServiceRate: { fontSize: '14px', fontWeight: '800', color: '#5de89e' },
  myServiceBody: { padding: '12px 14px' },
  myServiceStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' },
  myServiceStat: { background: '#f4f8f5', borderRadius: '10px', padding: '10px', textAlign: 'center' },
  myServiceStatVal: { fontSize: '17px', fontWeight: '800', color: '#1a7a4a' },
  myServiceStatLabel: { fontSize: '10px', color: '#888', marginTop: '2px' },
  myServiceActions: { display: 'flex', gap: '8px', marginTop: '4px' },
  myServiceEditBtn: { flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '10px', padding: '9px', fontSize: '13px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer', fontFamily: 'inherit' },
  myServicePauseBtn: { flex: 1, background: '#fff8e6', border: 'none', borderRadius: '10px', padding: '9px', fontSize: '13px', fontWeight: '700', color: '#d4920a', cursor: 'pointer', fontFamily: 'inherit' },
  myServiceDeleteBtn: { background: '#fef0f0', border: 'none', borderRadius: '10px', padding: '9px 14px', fontSize: '13px', color: '#c0392b', cursor: 'pointer', fontFamily: 'inherit' },

  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  modalHeroMedia: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '24px 24px 0 0', display: 'block' },
  modalHeroPlaceholder: { height: '120px', background: 'linear-gradient(135deg,#0f1410,#1a2b20)', borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', position: 'relative', flexShrink: 0 },
  modalBack: { position: 'absolute', top: '14px', left: '14px', width: '32px', height: '32px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '16px', cursor: 'pointer', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalTopRight: { position: 'absolute', top: '14px', right: '14px', display: 'flex', gap: '8px' },
  modalIconBtn: { width: '32px', height: '32px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalOverlayGrad: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 100%)', borderRadius: '24px 24px 0 0' },
  modalHeroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', textAlign: 'center' },
  modalAvatar: { width: '64px', height: '64px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', margin: '0 auto 8px', borderWidth: '3px', borderStyle: 'solid', borderColor: '#fff' },
  modalName: { fontSize: '20px', fontWeight: '800', color: '#fff', marginBottom: '3px' },
  modalSubline: { fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' },
  modalTags: { display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' },
  modalTag: { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', borderRadius: '12px', padding: '3px 10px', fontSize: '11px' },
  modalTagGreen: { background: 'rgba(34,160,94,0.35)', color: '#5de89e', borderRadius: '12px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' },

  // Modal body
  modalBody: { padding: '16px', flex: 1 },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' },
  statBox: { background: '#f4f8f5', borderRadius: '12px', padding: '12px', textAlign: 'center' },
  statVal: { fontSize: '13px', fontWeight: '800', color: '#1a7a4a', marginBottom: '2px' },
  statLabel: { fontSize: '10px', color: '#888' },
  modalSection: { marginBottom: '16px' },
  modalSectionTitle: { fontSize: '11px', fontWeight: '800', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  modalText: { fontSize: '13px', color: '#333', lineHeight: '1.7' },
  skillTags: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  skillTag: { background: '#e6f7ee', color: '#1a7a4a', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: '500' },
  mediaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' },
  mediaThumb: { aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', width: '100%', cursor: 'pointer' },
  mediaVideo: { aspectRatio: '1', borderRadius: '8px', width: '100%', cursor: 'pointer', background: '#000' },

  // Contact action bar at bottom of modal
  modalActions: { background: '#fff', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#eef3ef', padding: '12px 16px', display: 'flex', gap: '10px', flexShrink: 0 },
  whatsappBtn: { flex: 2, background: '#25D366', color: '#fff', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  callBtn: { flex: 1, background: '#f0f4f1', color: '#0f1410', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  chatBtn: { flex: 1, background: '#e6f7ee', color: '#1a7a4a', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },

  // Review styles
  reviewCard: { background: '#f4f8f5', borderRadius: '10px', padding: '12px', marginBottom: '8px' },
  reviewerName: { fontSize: '13px', fontWeight: '700', color: '#0f1410', marginBottom: '2px' },
  reviewStars: { fontSize: '13px', color: '#d4920a', marginBottom: '4px' },
  reviewText: { fontSize: '12px', color: '#555', lineHeight: '1.5' },
  reviewTime: { fontSize: '10px', color: '#bbb', marginTop: '4px' },
  reviewBox: { background: '#f4f8f5', borderRadius: '12px', padding: '14px', marginBottom: '14px' },
  reviewTitle: { fontSize: '13px', fontWeight: '700', color: '#0f1410', marginBottom: '10px' },
  starRow: { display: 'flex', gap: '6px', marginBottom: '10px' },
  starBtn: { fontSize: '26px', background: 'none', border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1 },
  reviewTextarea: { width: '100%', borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#e0ebe3', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', background: '#fff' },
  reviewSubmitBtn: { width: '100%', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', marginTop: '10px', fontFamily: 'inherit' },

  // Post/edit form
  form: { padding: '16px' },
  formCard: { background: '#fff', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
  formTitle: { fontSize: '20px', fontWeight: '800', color: '#0f1410', marginBottom: '4px' },
  formSub: { fontSize: '13px', color: '#888', marginBottom: '20px', lineHeight: '1.5' },
  label: { fontSize: '11px', fontWeight: '800', color: '#637068', display: 'block', marginBottom: '5px', marginTop: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { width: '100%', borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#e0ebe3', borderRadius: '12px', padding: '11px 14px', fontSize: '15px', background: '#fafcfb', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#e0ebe3', borderRadius: '12px', padding: '11px 14px', fontSize: '15px', background: '#fafcfb', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', boxSizing: 'border-box' },
  row: { display: 'flex', gap: '10px' },
  half: { flex: 1, minWidth: 0 },
  error: { color: '#c0392b', fontSize: '13px', marginTop: '10px', background: '#fef0f0', borderRadius: '8px', padding: '8px 12px' },
  successBanner: { background: '#e6f7ee', color: '#1a7a4a', fontWeight: '700', fontSize: '14px', borderRadius: '10px', padding: '12px', marginTop: '12px', textAlign: 'center' },
  submitBtn: { width: '100%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: '14px', padding: '15px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginTop: '22px', boxShadow: '0 3px 10px rgba(26,122,74,0.3)', fontFamily: 'inherit' },
  mediaUploadBox: { borderWidth: '2px', borderStyle: 'dashed', borderColor: '#e0ebe3', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', marginTop: '8px', background: '#fafcfb' },
  mediaUploadText: { fontSize: '13px', color: '#888', marginTop: '6px' },
  mediaPreviewRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
  mediaPreviewItem: { position: 'relative', width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden' },
  mediaPreviewImg: { width: '100%', height: '100%', objectFit: 'cover' },
  mediaPreviewRemove: { position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: '#fff', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Nav
  nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', zIndex: 100 },
  navItem: { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' },
  navIcon: { fontSize: '20px' },
  navLabel: { fontSize: '10px', color: '#888' },
  navPost: { width: '48px', height: '48px', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', marginTop: '-16px', boxShadow: '0 3px 12px rgba(26,122,74,0.4)' },
}