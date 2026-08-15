import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, S, avatarColor, initials, renderStars, formatWhatsApp } from './serviceData'
import ReviewSection from './ReviewSection'
import { X, ArrowLeft, Share2, Flag, MapPin, Eye, BadgeCheck, Wrench, Star, Info, MessageCircle, Phone, PlayCircle, Lightbulb, CheckCircle2 } from 'lucide-react'

export default function ProviderModal({ provider, currentUser, onClose }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('info')
  const [lightboxMedia, setLightboxMedia] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)

  const catInfo = SERVICE_CATS.find(c => c.name === provider.category)
  const media = provider.media_urls || []
  const heroMedia = media[0]
  const isOwner = currentUser?.id === provider.provider_id

  // Track view on open
  useEffect(() => {
    supabase.from('services')
      .update({ views: (provider.views || 0) + 1 })
      .eq('id', provider.id)
  }, [])

  function goChat() {
    if (!currentUser) return
    navigate(`/chat/${provider.provider_id}/${provider.id}?src=service`, {
      state: { source: 'service' },
    })
  }

  function doCall() {
    if (provider.contact) window.location.href = `tel:${provider.contact}`
  }

  function doWhatsApp() {
    window.open(formatWhatsApp(provider.contact, provider.name, provider.category), '_blank')
  }

  async function handleShare() {
    const text = `Check out ${provider.name} on Soko Malawi — ${provider.category} in ${provider.city}. Rate: ${provider.rate}`
    if (navigator.share) {
      try { await navigator.share({ title: provider.name, text }) } catch (_) {}
    } else {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    }
  }

  async function submitReport() {
    if (!reportReason) return
    await supabase.from('reports').insert({
      service_id: provider.id,
      reporter_id: currentUser?.id || null,
      reason: reportReason,
    })
    setReportSent(true)
  }

  const hasContact = !!provider.contact

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* ── Close button ── */}
        <button
          onClick={onClose}
          style={{
            position: 'fixed', top: 14, right: 14, zIndex: 1100,
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: 'none',
            color: '#fff', fontSize: 22, lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', backdropFilter: 'blur(4px)',
          }}
        >
          <X size={20} />
        </button>

        {/* ── Hero ─────────────────────────────────── */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {heroMedia ? (
            heroMedia.match(/\.(mp4|mov|webm)$/i)
              ? <video src={heroMedia} style={S.modalHeroMedia} autoPlay muted loop playsInline />
              : <img src={heroMedia} alt={provider.name} style={S.modalHeroMedia} />
          ) : (
            <div style={S.modalHeroPlaceholder}>
            {catInfo ? <catInfo.icon size={44} strokeWidth={1.6} /> : <Wrench size={44} strokeWidth={1.6} />}
          </div>
          )}

          {/* Gradient overlay */}
          <div style={S.modalOverlayGrad} />

          {/* Back */}
          <button style={S.modalBack} onClick={onClose}><ArrowLeft size={18} /></button>

          {/* Share + Report */}
          <div style={S.modalTopRight}>
            <button style={S.modalIconBtn} onClick={handleShare} title="Share"><Share2 size={15} /></button>
            {!isOwner && (
              <button style={S.modalIconBtn} onClick={() => setShowReport(true)} title="Report"><Flag size={15} /></button>
            )}
          </div>

          {/* Hero info */}
          <div style={S.modalHeroContent}>
            <div style={{ ...S.modalAvatar, background: avatarColor(provider.name) }}>
              {initials(provider.name)}
            </div>
            <div style={S.modalName}>
              {provider.name}
              {provider.verified && <BadgeCheck size={16} style={{ color: '#5de89e', marginLeft: '4px', verticalAlign: '-2px' }} />}
            </div>
            <div style={S.modalSubline}>
              {provider.rating > 0 && <span style={{ color: '#f0c040' }}>{renderStars(provider.rating)} {provider.rating} · </span>}
              {provider.city && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {provider.city}</span>}
              {(provider.views || 0) > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}> · <Eye size={11} /> {provider.views}</span>}
            </div>
            <div style={S.modalTags}>
              <span style={{ ...S.modalTag, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{catInfo ? <catInfo.icon size={11} /> : <Wrench size={11} />} {provider.category}</span>
              {provider.verified && <span style={{ ...S.modalTagGreen, display: 'inline-flex', alignItems: 'center', gap: 4 }}><BadgeCheck size={11} /> Verified</span>}
              {provider.available && <span style={S.modalTag}>{provider.available}</span>}
            </div>
          </div>
        </div>

        {/* ── Inner tabs ───────────────────────────── */}
        <div style={{ display: 'flex', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#f0f0f0', background: '#fff', flexShrink: 0 }}>
          {['info', 'reviews'].map(t => (
            <button
              key={t}
              style={{ ...S.tab, flex: 1, justifyContent: 'center', ...(activeTab === t ? S.tabActive : {}) }}
              onClick={() => setActiveTab(t)}
            >
              {t === 'info' ? <><Info size={15} /> Info</> : <><Star size={15} fill={provider.rating > 0 ? '#d4920a' : 'none'} /> Reviews{provider.rating > 0 ? ` ${provider.rating}` : ''}</>}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────── */}
        <div style={{ ...S.modalBody, overflowY: 'auto' }}>

          {activeTab === 'info' && (
            <>
              {/* Stats */}
              <div style={S.statsRow}>
                <div style={S.statBox}>
                  <div style={S.statVal}>{provider.experience || '—'}</div>
                  <div style={S.statLabel}>Experience</div>
                </div>
                <div style={S.statBox}>
                  <div style={S.statVal}>{provider.rate || '—'}</div>
                  <div style={S.statLabel}>Rate</div>
                </div>
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
                  <p style={{ ...S.modalText, display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} /> {provider.coverage}</p>
                </div>
              )}

              {/* Contact card */}
              {hasContact && (
                <div style={S.modalSection}>
                  <div style={S.modalSectionTitle}>Contact</div>
                  <div style={{ background: '#f4f8f5', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f1410' }}>{provider.contact}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Call or WhatsApp</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={{ background: '#e6f7ee', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer' }}
                        onClick={doCall}
                      >
                        <Phone size={15} />
                      </button>
                      <button
                        style={{ background: '#e7f9ee', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: '700', color: '#128c3e', cursor: 'pointer' }}
                        onClick={doWhatsApp}
                      >
                        WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Media grid */}
              {media.length > 1 && (
                <div style={S.modalSection}>
                  <div style={S.modalSectionTitle}>Photos & Videos ({media.length})</div>
                  <div style={S.mediaGrid}>
                    {media.slice(1).map((url, i) => (
                      url.match(/\.(mp4|mov|webm)$/i) ? (
                        <div key={i} style={{ position: 'relative' }}>
                          <video src={url} style={S.mediaVideo} muted onClick={() => setLightboxMedia(url)} />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}><PlayCircle size={26} fill="rgba(0,0,0,0.35)" stroke="#fff" /></div>
                        </div>
                      ) : (
                        <img key={i} src={url} alt="" style={S.mediaThumb} onClick={() => setLightboxMedia(url)} />
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* How to connect tip */}
              <div style={{ background: '#fffbe6', borderWidth: '1px', borderStyle: 'solid', borderColor: '#fde68a', borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: '#7a5a00', lineHeight: '1.7', marginBottom: '8px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Lightbulb size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span><strong>How to connect:</strong> Message or call {provider.name} directly to discuss your needs, agree on a price, and arrange the job.</span>
              </div>
            </>
          )}

          {activeTab === 'reviews' && (
            <ReviewSection
              serviceId={provider.id}
              providerId={provider.provider_id}
              currentUser={currentUser}
            />
          )}
        </div>

        {/* ── Action bar ──────────────────────────── */}
        <div style={S.modalActions}>
          {isOwner ? (
            <div style={{ flex: 1, background: '#f0f4f1', borderRadius: '12px', padding: '12px', textAlign: 'center', fontSize: '13px', color: '#637068', fontWeight: '600' }}>
              This is your listing
            </div>
          ) : (
            <>
              {currentUser && (
                <button style={S.chatBtn} onClick={goChat}><MessageCircle size={18} /></button>
              )}
              {hasContact && (
                <button style={S.callBtn} onClick={doCall}><Phone size={15} /> Call</button>
              )}
              <button style={S.whatsappBtn} onClick={doWhatsApp}>
                WhatsApp {provider.name.split(' ')[0]}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Lightbox ────────────────────────────── */}
      {lightboxMedia && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightboxMedia(null)}
        >
          <button style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
          {lightboxMedia.match(/\.(mp4|mov|webm)$/i)
            ? <video src={lightboxMedia} controls autoPlay style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 12 }} />
            : <img src={lightboxMedia} alt="media" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
          }
        </div>
      )}

      {/* ── Report modal ────────────────────────── */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowReport(false)}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '300px', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}><CheckCircle2 size={40} color="#1a7a4a" strokeWidth={1.8} /></div>
                <div style={{ fontWeight: '800', marginBottom: '6px', fontSize: '16px' }}>Report submitted</div>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>We'll review this listing.</p>
                <button style={S.postFirstBtn} onClick={() => setShowReport(false)}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: 6 }}><Flag size={16} color="#c0392b" /> Report listing</div>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>Why are you reporting this?</p>
                {['Fake or scam', 'Inappropriate content', 'Wrong category', 'Duplicate listing', 'Other'].map(r => (
                  <button
                    key={r}
                    style={{ width: '100%', textAlign: 'left', background: reportReason === r ? '#fef0f0' : '#f4f8f5', borderWidth: '1.5px', borderStyle: 'solid', borderColor: reportReason === r ? '#c0392b' : 'transparent', borderRadius: '10px', padding: '9px 12px', marginBottom: '6px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', color: reportReason === r ? '#c0392b' : '#333', fontWeight: reportReason === r ? '700' : '400' }}
                    onClick={() => setReportReason(r)}
                  >
                    {r}
                  </button>
                ))}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button style={{ flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }} onClick={() => setShowReport(false)}>Cancel</button>
                  <button style={{ flex: 1, background: '#c0392b', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', color: '#fff', cursor: 'pointer', opacity: reportReason ? 1 : 0.4 }} disabled={!reportReason} onClick={submitReport}>Submit</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
