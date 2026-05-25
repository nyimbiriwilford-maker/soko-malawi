export const SERVICE_CATS = [
  { icon: '🔧', name: 'Plumbing' },
  { icon: '⚡', name: 'Electrical' },
  { icon: '📚', name: 'Tutoring' },
  { icon: '✂️', name: 'Tailoring' },
  { icon: '🧹', name: 'Cleaning' },
  { icon: '📸', name: 'Photography' },
  { icon: '💇', name: 'Hair & Beauty' },
  { icon: '🪚', name: 'Carpentry' },
  { icon: '🚗', name: 'Transport' },
  { icon: '💻', name: 'Tech & IT' },
  { icon: '🎨', name: 'Design' },
  { icon: '🍳', name: 'Catering' },
]

export const CITIES = ['All', 'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi', 'Karonga', 'Salima']

export const STATUS_COLORS = {
  pending:   { bg: '#fff8e6', color: '#d4920a', label: '⏳ Pending' },
  confirmed: { bg: '#e6f7ee', color: '#1a7a4a', label: '✅ Confirmed' },
  completed: { bg: '#e8eaff', color: '#3b4dd4', label: '🏁 Completed' },
  cancelled: { bg: '#fef0f0', color: '#c0392b', label: '❌ Cancelled' },
}

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
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days < 7) return days + 'd ago'
  return new Date(date).toLocaleDateString()
}

export function playBookingSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02)
      gain.gain.linearRampToValueAtTime(0, t + 0.18)
      osc.start(t); osc.stop(t + 0.2)
    })
  } catch (e) {}
}

export function playConfirmSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
      gain.gain.linearRampToValueAtTime(0, t + 0.2)
      osc.start(t); osc.stop(t + 0.22)
    })
  } catch (e) {}
}

export const S = {
  page: { minHeight: '100vh', background: '#f4f8f5', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#fff', borderBottom: '1px solid #e8f0eb', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 50 },
  headerTop: { padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: '22px', fontWeight: '800', color: '#0f1410' },
  headerSub: { fontSize: '12px', color: '#888', marginTop: '2px' },
  joinBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f4f8f5', borderRadius: '12px', padding: '10px 14px', margin: '0 14px 10px', border: '1px solid #e8f0eb' },
  searchInput: { flex: 1, border: 'none', background: 'transparent', fontSize: '14px', color: '#0f1410', fontFamily: 'inherit' },
  clearBtn2: { background: 'none', border: 'none', color: '#888', fontSize: '14px', cursor: 'pointer' },
  tabs: { display: 'flex', borderBottom: '1px solid #f0f0f0', overflowX: 'auto' },
  tab: { flexShrink: 0, background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: '#888', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px' },
  tabActive: { color: '#1a7a4a', borderBottomColor: '#1a7a4a' },
  tabBadge: { background: '#e74c3c', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  feed: { padding: '14px' },
  sectionLabel: { fontSize: '11px', fontWeight: '800', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
  countBadge: { background: '#e6f7ee', color: '#1a7a4a', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' },
  // Horizontal scrolling category chips (compact, non-blocking)
  catScrollRow: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '14px' },
  catChip: { flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1.5px solid #e8f0eb', borderRadius: '20px', padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  catChipActive: { background: '#1a7a4a', borderColor: '#1a7a4a', color: '#fff' },
  catChipIcon: { fontSize: '16px' },
  catChipName: { fontSize: '12px', fontWeight: '700', color: '#333' },
  catChipNameActive: { color: '#fff' },
  catChipCount: { fontSize: '10px', fontWeight: '700', color: '#1a7a4a', background: '#e6f7ee', borderRadius: '10px', padding: '1px 6px', marginLeft: '2px' },
  catChipCountActive: { background: 'rgba(255,255,255,0.25)', color: '#fff' },
  catFilterBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', borderRadius: '12px', padding: '10px 14px', marginBottom: '14px' },
  catFilterBannerText: { fontSize: '13px', fontWeight: '700', color: '#fff' },
  catFilterBannerClear: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', padding: '4px 10px', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' },
  cityRow: { display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '14px', paddingBottom: '4px' },
  cityChip: { flexShrink: 0, background: '#fff', border: '1.5px solid #e8f0eb', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', color: '#637068', cursor: 'pointer', fontFamily: 'inherit' },
  cityChipActive: { background: '#1a7a4a', borderColor: '#1a7a4a', color: '#fff' },
  skeleton: { height: '100px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', borderRadius: '14px', marginBottom: '10px', animation: 'pulse 1.5s infinite' },
  empty: { textAlign: 'center', padding: '50px 0' },
  emptyIcon: { fontSize: '44px', marginBottom: '10px' },
  emptyTitle: { fontSize: '16px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  emptySub: { fontSize: '13px', color: '#888', marginBottom: '16px' },
  postFirstBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  // Professional provider card
  providerCard: { background: '#fff', border: '1px solid #eef3ef', borderRadius: '16px', marginBottom: '12px', cursor: 'pointer', animation: 'fadeUp 0.3s ease both', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' },
  providerCardMedia: { width: '100%', height: '120px', objectFit: 'cover', background: '#f0f4f1', display: 'block' },
  providerCardMediaPlaceholder: { width: '100%', height: '80px', background: 'linear-gradient(135deg,#1a7a4a22,#22a05e11)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' },
  providerCardBody: { padding: '14px' },
  providerTop: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  avatar: { width: '44px', height: '44px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '800', flexShrink: 0 },
  providerInfo: { flex: 1, minWidth: 0 },
  providerName: { fontSize: '14px', fontWeight: '700', color: '#0f1410' },
  providerMeta: { fontSize: '11px', color: '#888', marginTop: '2px' },
  rate: { fontSize: '14px', fontWeight: '800', color: '#1a7a4a', whiteSpace: 'nowrap' },
  tagRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tag: { background: '#f0f4f1', color: '#637068', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '500' },
  tagGreen: { background: '#e6f7ee', color: '#1a7a4a', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '600' },
  tagGrey: { background: '#f5f5f5', color: '#555', borderRadius: '6px', padding: '3px 8px', fontSize: '11px' },
  // My service management card
  myServiceCard: { background: '#fff', border: '1px solid #eef3ef', borderRadius: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' },
  myServiceHeader: { background: 'linear-gradient(135deg,#0f1410,#1a2b20)', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' },
  myServiceAvatar: { width: '48px', height: '48px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '800', flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)' },
  myServiceName: { flex: 1, fontSize: '15px', fontWeight: '700', color: '#fff' },
  myServiceRate: { fontSize: '14px', fontWeight: '800', color: '#5de89e' },
  myServiceBody: { padding: '12px 14px' },
  myServiceStats: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' },
  myServiceStat: { background: '#f4f8f5', borderRadius: '10px', padding: '8px', textAlign: 'center' },
  myServiceStatVal: { fontSize: '16px', fontWeight: '800', color: '#1a7a4a' },
  myServiceStatLabel: { fontSize: '10px', color: '#888', marginTop: '1px' },
  myServiceActions: { display: 'flex', gap: '8px', marginTop: '2px' },
  myServiceEditBtn: { flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '10px', padding: '9px', fontSize: '13px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer', fontFamily: 'inherit' },
  myServicePauseBtn: { flex: 1, background: '#fff8e6', border: 'none', borderRadius: '10px', padding: '9px', fontSize: '13px', fontWeight: '700', color: '#d4920a', cursor: 'pointer', fontFamily: 'inherit' },
  myServiceDeleteBtn: { background: '#fef0f0', border: 'none', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', fontWeight: '700', color: '#c0392b', cursor: 'pointer', fontFamily: 'inherit' },
  // Bookings
  bookingCard: { background: '#fff', border: '1px solid #eef3ef', borderRadius: '14px', padding: '14px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  bookingCardTop: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' },
  bookingCardIcon: { fontSize: '28px', flexShrink: 0 },
  bookingCardInfo: { flex: 1 },
  bookingCardTitle: { fontSize: '14px', fontWeight: '700', color: '#0f1410' },
  bookingCardMeta: { fontSize: '12px', color: '#888', marginTop: '2px' },
  statusBadge: { borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', flexShrink: 0 },
  bookingDesc: { fontSize: '13px', color: '#555', fontStyle: 'italic', marginBottom: '8px', lineHeight: '1.5', background: '#f4f8f5', borderRadius: '8px', padding: '8px 10px' },
  bookingRate: { fontSize: '13px', fontWeight: '700', color: '#1a7a4a', marginBottom: '8px' },
  bookingDate: { fontSize: '11px', color: '#bbb', marginTop: '8px' },
  chatWithBtn: { width: '100%', background: '#e6f7ee', border: 'none', borderRadius: '10px', padding: '9px', fontSize: '13px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer', marginTop: '8px', fontFamily: 'inherit' },
  cancelBookingBtn: { width: '100%', background: 'none', border: '1.5px solid #e0ebe3', borderRadius: '10px', padding: '9px', fontSize: '13px', fontWeight: '600', color: '#888', cursor: 'pointer', marginTop: '6px', fontFamily: 'inherit' },
  completeBtn: { width: '100%', background: '#e8eaff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', color: '#3b4dd4', cursor: 'pointer', marginTop: '6px', fontFamily: 'inherit' },
  incomingActions: { display: 'flex', gap: '8px', marginTop: '10px' },
  confirmBtn: { flex: 1, background: '#e6f7ee', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer', fontFamily: 'inherit' },
  declineBtn: { flex: 1, background: '#fef0f0', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', color: '#c0392b', cursor: 'pointer', fontFamily: 'inherit' },
  notifBanner: { background: '#1a7a4a', color: '#fff', borderRadius: '12px', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'fadeUp 0.3s ease' },
  notifText: { flex: 1, fontSize: '13px', fontWeight: '600' },
  notifDismiss: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', padding: '4px 8px', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' },
  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  modalHero: { background: '#0f1410', padding: '20px 20px 16px', borderRadius: '24px 24px 0 0', textAlign: 'center', position: 'relative', flexShrink: 0 },
  modalHeroMedia: { width: '100%', height: '140px', objectFit: 'cover', borderRadius: '24px 24px 0 0', display: 'block' },
  modalBack: { position: 'absolute', top: '14px', left: '14px', width: '30px', height: '30px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '16px', cursor: 'pointer', zIndex: 2 },
  modalAvatar: { width: '64px', height: '64px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', margin: '0 auto 10px', border: '3px solid rgba(255,255,255,0.2)' },
  modalAvatarOnMedia: { width: '64px', height: '64px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', margin: '-32px auto 10px', border: '3px solid #fff', position: 'relative', zIndex: 1 },
  modalName: { fontSize: '18px', fontWeight: '800', color: '#fff', marginBottom: '4px' },
  modalRating: { fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' },
  modalTags: { display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' },
  modalTag: { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderRadius: '12px', padding: '3px 10px', fontSize: '10px' },
  modalTagGreen: { background: 'rgba(34,160,94,0.3)', color: '#5de89e', borderRadius: '12px', padding: '3px 10px', fontSize: '10px', fontWeight: '600' },
  modalBody: { padding: '16px', flex: 1 },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' },
  statBox: { background: '#f4f8f5', borderRadius: '12px', padding: '12px', textAlign: 'center' },
  statVal: { fontSize: '13px', fontWeight: '800', color: '#1a7a4a', marginBottom: '2px' },
  statLabel: { fontSize: '10px', color: '#888' },
  modalSection: { marginBottom: '14px' },
  modalSectionTitle: { fontSize: '11px', fontWeight: '800', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  modalText: { fontSize: '13px', color: '#333', lineHeight: '1.6' },
  skillTags: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  skillTag: { background: '#e6f7ee', color: '#1a7a4a', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: '500' },
  // Testimonial media
  mediaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '8px' },
  mediaThumb: { aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', width: '100%', cursor: 'pointer' },
  mediaVideo: { aspectRatio: '1', borderRadius: '8px', width: '100%', cursor: 'pointer', background: '#000' },
  payNote: { background: '#fffbe6', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#633806', lineHeight: '1.6', marginBottom: '16px' },
  bookingForm: { background: '#f4f8f5', borderRadius: '14px', padding: '16px', marginBottom: '16px' },
  bookingTitle: { fontSize: '16px', fontWeight: '700', color: '#0f1410', marginBottom: '12px' },
  bookingInput: { width: '100%', border: '1.5px solid #e0ebe3', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', background: '#fff' },
  bookingNote: { background: '#fff', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#555', margin: '10px 0 12px' },
  bookConfirmBtn: { width: '100%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  bookingSuccess: { textAlign: 'center', padding: '20px 0' },
  bookingSuccessTitle: { fontSize: '18px', fontWeight: '800', color: '#1a7a4a', marginBottom: '8px' },
  bookingSuccessText: { fontSize: '13px', color: '#637068', lineHeight: '1.6', marginBottom: '20px' },
  modalActions: { background: '#fff', borderTop: '1px solid #eef3ef', padding: '12px 16px', display: 'flex', gap: '10px', flexShrink: 0 },
  msgBtn: { flex: 1, background: 'none', border: '1.5px solid #1a7a4a', color: '#1a7a4a', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  bookBtn: { flex: 2, background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  // Post form
  form: { padding: '16px' },
  formCard: { background: '#fff', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
  formTitle: { fontSize: '20px', fontWeight: '800', color: '#0f1410', marginBottom: '4px' },
  formSub: { fontSize: '13px', color: '#888', marginBottom: '20px' },
  label: { fontSize: '12px', fontWeight: '700', color: '#637068', display: 'block', marginBottom: '5px', marginTop: '14px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: { width: '100%', border: '1.5px solid #e0ebe3', borderRadius: '12px', padding: '11px 14px', fontSize: '15px', background: '#fafcfb', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', border: '1.5px solid #e0ebe3', borderRadius: '12px', padding: '11px 14px', fontSize: '15px', background: '#fafcfb', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', boxSizing: 'border-box' },
  row: { display: 'flex', gap: '10px' },
  half: { flex: 1, minWidth: 0 },
  error: { color: '#c0392b', fontSize: '13px', marginTop: '10px', background: '#fef0f0', borderRadius: '8px', padding: '8px 12px' },
  successBanner: { background: '#e6f7ee', color: '#1a7a4a', fontWeight: '700', fontSize: '14px', borderRadius: '10px', padding: '12px', marginTop: '12px', textAlign: 'center' },
  submitBtn: { width: '100%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: '14px', padding: '15px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginTop: '20px', boxShadow: '0 3px 10px rgba(26,122,74,0.3)', fontFamily: 'inherit' },
  // Media upload
  mediaUploadBox: { border: '2px dashed #e0ebe3', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', marginTop: '8px', background: '#fafcfb' },
  mediaUploadText: { fontSize: '13px', color: '#888', marginTop: '6px' },
  mediaPreviewRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
  mediaPreviewItem: { position: 'relative', width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden' },
  mediaPreviewImg: { width: '100%', height: '100%', objectFit: 'cover' },
  mediaPreviewRemove: { position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: '#fff', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', zIndex: 100 },
  navItem: { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' },
  navIcon: { fontSize: '20px' },
  navLabel: { fontSize: '10px', color: '#888' },
  navPost: { width: '48px', height: '48px', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', marginTop: '-16px', boxShadow: '0 3px 10px rgba(26,122,74,0.4)' },
}