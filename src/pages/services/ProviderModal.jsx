import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SERVICE_CATS, S, avatarColor, initials, playBookingSound } from './serviceData'

export default function ProviderModal({ provider, currentUser, onClose, onBookingDone }) {
  const navigate = useNavigate()
  const [showBooking, setShowBooking] = useState(false)
  const [bookingDone, setBookingDone] = useState(false)
  const [bookDesc, setBookDesc] = useState('')
  const [bookDate, setBookDate] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookError, setBookError] = useState('')
  const [lightboxMedia, setLightboxMedia] = useState(null)

  const isOwner = currentUser?.id === provider.provider_id
  const catInfo = SERVICE_CATS.find(c => c.name === provider.category)
  const media = provider.media_urls || []
  const heroMedia = media[0]

  async function handleBook() {
    if (!bookDesc.trim()) { setBookError('Please describe the job'); return }
    setBookError('')
    setBookingLoading(true)
    const { supabase } = await import('../../lib/supabase')
    const { error } = await supabase.from('bookings').insert({
      customer_id: currentUser.id,
      provider_id: provider.provider_id,
      service_id: provider.id,
      description: bookDesc,
      date: bookDate || null,
      status: 'pending'
    })
    setBookingLoading(false)
    if (error) { setBookError(error.message); return }
    playBookingSound()
    setBookingDone(true)
    onBookingDone()
  }

  function goChat() {
    // Navigate to chat with the provider, using their provider_id and service id as listing id
    navigate(`/chat/${provider.provider_id}/${provider.id}`)
  }

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {/* Hero — show first media if available, else dark bg */}
        {heroMedia ? (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {heroMedia.includes('.mp4') || heroMedia.includes('.mov') || heroMedia.includes('.webm') ? (
              <video src={heroMedia} style={S.modalHeroMedia} autoPlay muted loop playsInline />
            ) : (
              <img src={heroMedia} alt={provider.name} style={S.modalHeroMedia} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)', borderRadius: '24px 24px 0 0' }} />
            <button style={S.modalBack} onClick={onClose}>←</button>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', textAlign: 'center' }}>
              <div style={{ ...S.modalAvatar, background: avatarColor(provider.name), margin: '0 auto 8px', border: '3px solid #fff' }}>
                {initials(provider.name)}
              </div>
              <div style={S.modalName}>{provider.name}{provider.verified && <span style={{ color: '#5de89e' }}> ✓</span>}</div>
              <div style={S.modalRating}>
                {provider.rating > 0 && `⭐ ${provider.rating}`}
                {provider.jobs_done > 0 && ` · ${provider.jobs_done} jobs`}
                {provider.city && ` · 📍 ${provider.city}`}
              </div>
              <div style={S.modalTags}>
                <span style={S.modalTag}>{catInfo?.icon} {provider.category}</span>
                {provider.verified && <span style={S.modalTagGreen}>✓ Verified</span>}
                {provider.available && <span style={S.modalTag}>{provider.available}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div style={S.modalHero}>
            <button style={S.modalBack} onClick={onClose}>←</button>
            <div style={{ ...S.modalAvatar, background: avatarColor(provider.name) }}>{initials(provider.name)}</div>
            <div style={S.modalName}>{provider.name}{provider.verified && <span style={{ color: '#5de89e' }}> ✓</span>}</div>
            <div style={S.modalRating}>
              {provider.rating > 0 && `⭐ ${provider.rating}`}
              {provider.jobs_done > 0 && ` · ${provider.jobs_done} jobs`}
              {provider.city && ` · 📍 ${provider.city}`}
            </div>
            <div style={S.modalTags}>
              <span style={S.modalTag}>{catInfo?.icon} {provider.category}</span>
              {provider.verified && <span style={S.modalTagGreen}>✓ Verified</span>}
              {provider.available && <span style={S.modalTag}>{provider.available}</span>}
            </div>
          </div>
        )}

        <div style={S.modalBody}>
          {/* Stats */}
          <div style={S.statsRow}>
            <div style={S.statBox}><div style={S.statVal}>{provider.rate || '—'}</div><div style={S.statLabel}>Rate</div></div>
            <div style={S.statBox}><div style={S.statVal}>{provider.experience || '—'}</div><div style={S.statLabel}>Experience</div></div>
            <div style={S.statBox}><div style={S.statVal}>{provider.jobs_done || 0}</div><div style={S.statLabel}>Jobs done</div></div>
          </div>

          {provider.description && (
            <div style={S.modalSection}>
              <div style={S.modalSectionTitle}>About</div>
              <p style={S.modalText}>{provider.description}</p>
            </div>
          )}

          {provider.skills?.length > 0 && (
            <div style={S.modalSection}>
              <div style={S.modalSectionTitle}>Skills</div>
              <div style={S.skillTags}>
                {provider.skills.map(sk => <span key={sk} style={S.skillTag}>{sk}</span>)}
              </div>
            </div>
          )}

          {provider.coverage && (
            <div style={S.modalSection}>
              <div style={S.modalSectionTitle}>Coverage Area</div>
              <p style={S.modalText}>📍 {provider.coverage}</p>
            </div>
          )}

          {provider.contact && (
            <div style={S.modalSection}>
              <div style={S.modalSectionTitle}>Contact</div>
              <p style={S.modalText}>{provider.contact}</p>
            </div>
          )}

          {/* Testimonial media grid */}
          {media.length > 1 && (
            <div style={S.modalSection}>
              <div style={S.modalSectionTitle}>Photos & Videos</div>
              <div style={S.mediaGrid}>
                {media.slice(1).map((url, i) => (
                  url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') ? (
                    <video
                      key={i}
                      src={url}
                      style={S.mediaVideo}
                      muted
                      onClick={() => setLightboxMedia(url)}
                    />
                  ) : (
                    <img
                      key={i}
                      src={url}
                      alt={'media ' + i}
                      style={S.mediaThumb}
                      onClick={() => setLightboxMedia(url)}
                    />
                  )
                ))}
              </div>
            </div>
          )}

          <div style={S.payNote}>
            💰 <strong>How payment works:</strong> Pay 50% deposit when confirmed. Pay remaining 50% after the job is done.
          </div>

          {/* Booking form */}
          {!bookingDone && showBooking && !isOwner && (
            <div style={S.bookingForm}>
              <div style={S.bookingTitle}>📅 Book {provider.name}</div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Describe the job *</div>
              <textarea style={S.bookingInput} rows={3} placeholder="e.g. Fix leaking kitchen tap and bathroom drain" value={bookDesc} onChange={e => setBookDesc(e.target.value)} />
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '10px 0 6px' }}>Preferred date (optional)</div>
              <input type="date" style={{ ...S.bookingInput, fontFamily: 'inherit' }} value={bookDate} min={new Date().toISOString().split('T')[0]} onChange={e => setBookDate(e.target.value)} />
              <div style={S.bookingNote}>Rate: <strong style={{ color: '#1a7a4a' }}>{provider.rate}</strong></div>
              {bookError && <p style={{ color: '#c0392b', fontSize: '12px', marginBottom: '8px', background: '#fef0f0', borderRadius: '8px', padding: '8px 10px' }}>{bookError}</p>}
              <button style={{ ...S.bookConfirmBtn, opacity: bookingLoading ? 0.7 : 1 }} onClick={handleBook} disabled={bookingLoading}>
                {bookingLoading ? 'Sending…' : '📤 Send Booking Request'}
              </button>
            </div>
          )}

          {bookingDone && (
            <div style={S.bookingSuccess}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
              <div style={S.bookingSuccessTitle}>Booking request sent!</div>
              <p style={S.bookingSuccessText}>
                <strong>{provider.name}</strong> will confirm soon. Track it in <strong>My Bookings</strong>.
              </p>
              <div style={{ background: '#f4f8f5', borderRadius: '12px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: '#637068', lineHeight: '1.8', textAlign: 'left' }}>
                <strong style={{ color: '#0f1410' }}>What happens next:</strong><br />
                1. Provider confirms your booking<br />
                2. Pay 50% deposit to lock in slot<br />
                3. Job gets done<br />
                4. Pay remaining 50% on completion
              </div>
              <button style={S.submitBtn} onClick={() => { onClose(); onBookingDone('view') }}>View My Bookings →</button>
            </div>
          )}
        </div>

        {/* Action bar */}
        {!bookingDone && (
          <div style={S.modalActions}>
            <button style={S.msgBtn} onClick={goChat}>💬 Message</button>
            {isOwner ? (
              <div style={{ flex: 2, background: '#f0f4f1', borderRadius: '12px', padding: '12px', textAlign: 'center', fontSize: '13px', color: '#637068', fontWeight: '600' }}>
                This is your listing
              </div>
            ) : !showBooking ? (
              <button style={S.bookBtn} onClick={() => setShowBooking(true)}>📅 Book now</button>
            ) : (
              <button style={{ ...S.msgBtn, flex: 2 }} onClick={() => { setShowBooking(false); setBookDesc(''); setBookDate(''); setBookError('') }}>← Cancel</button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxMedia && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLightboxMedia(null)}>
          <button style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}>✕</button>
          {lightboxMedia.includes('.mp4') || lightboxMedia.includes('.mov') || lightboxMedia.includes('.webm')
            ? <video src={lightboxMedia} controls autoPlay style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 12 }} />
            : <img src={lightboxMedia} alt="media" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 12 }} />
          }
        </div>
      )}
    </div>
  )
}