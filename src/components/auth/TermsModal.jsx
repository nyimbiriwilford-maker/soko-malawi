// src/components/auth/TermsModal.jsx
// Full Terms & Conditions + Privacy Policy shown on the sign-up page.
// Users must read (and agree to) these before creating an account.

import { useEffect, useRef, useState } from 'react'
import { TERMS_SECTIONS, PRIVACY_SECTIONS, LEGAL } from '../../constants/legal'

const GREEN = '#0F9D58'
const GREEN_D = '#0a7a44'
const AMBER = '#F9AB00'
const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const SOFT = '#f8fafc'
const DISPLAY_FONT = "'Sora', 'Inter', system-ui, sans-serif"

export default function TermsModal({ onAgree, onClose }) {
  const [tab, setTab] = useState('terms')
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef(null)
  const agreeRef = useRef(null)

  const sections = tab === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const nearEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      setScrolled(nearEnd)
    }
    el.addEventListener('scroll', onScroll)
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [tab])

  useEffect(() => {
    // Move focus into the modal for accessibility
    const t = window.setTimeout(() => agreeRef.current?.focus({ preventScroll: true }), 50)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} role="dialog" aria-modal="true" aria-label={`SokoMw ${tab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}`} onClick={(e) => e.stopPropagation()}>

        <div style={handle} />

        {/* Brand header */}
        <div style={brandHeader}>
          <div style={logoRow}>
            <div style={logoBadge}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 12l9-9 9 9" /><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
              </svg>
            </div>
            <div style={{ fontFamily: DISPLAY_FONT, fontSize: 21, fontWeight: 800, color: GREEN, letterSpacing: '-0.6px', lineHeight: 1 }}>
              Soko<span style={{ color: AMBER }}>Mw</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <div style={titleBlock}>
          <div style={{ fontSize: 19, fontWeight: 800, color: INK, fontFamily: DISPLAY_FONT, letterSpacing: '-0.3px' }}>
            {tab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>
            Effective {LEGAL.effectiveDate} · {tab === 'terms' ? 'Read before creating your account' : 'How we protect your data'}
          </div>
        </div>

        {/* Tabs */}
        <div style={tabs}>
          {[
            { key: 'terms', label: 'Terms & Conditions' },
            { key: 'privacy', label: 'Privacy Policy' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                ...tabBtn,
                ...(tab === t.key ? tabActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} style={body}>
          <div style={intro}>
            {tab === 'terms' ? (
              <>
                <span style={{ fontWeight: 800, color: INK, display: 'block', marginBottom: 4 }}>A legally binding agreement</span>
                These Terms & Conditions are between you and {LEGAL.legalName} ("SokoMw"). Please read them carefully before creating your account.
              </>
            ) : (
              <>
                <span style={{ fontWeight: 800, color: INK, display: 'block', marginBottom: 4 }}>Your data is safe with us</span>
                This Privacy Policy explains how SokoMw collects, uses, stores and protects your personal data. It complies with the Malawi Data Protection Act, 2024.
              </>
            )}
          </div>

          {sections.map((s) => (
            <section key={s.id} style={section}>
              <h3 style={sectionTitle}>{s.title}</h3>
              <p style={sectionBody}>{s.body}</p>
            </section>
          ))}
        </div>

        {/* Read-to-end gate */}
        <div style={footer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: scrolled ? '#16a34a' : MUTED, fontWeight: 600, marginBottom: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {scrolled
                ? <><polyline points="20 6 9 17 4 12" /></>
                : <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>}
            </svg>
            {scrolled ? 'You have read the full document' : 'Please scroll to the end to read everything'}
          </div>
          <button
            ref={agreeRef}
            type="button"
            onClick={onAgree}
            disabled={!scrolled}
            style={{
              ...agreeBtn,
              ...(!scrolled ? agreeDisabled : {}),
            }}
          >
            {!scrolled ? 'Scroll to read all terms' : `I Agree to the ${tab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}`}
          </button>
          <button type="button" onClick={onClose} style={laterBtn}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  zIndex: 600,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  padding: 0,
}

const modal = {
  background: '#fff',
  borderRadius: '28px 28px 0 0',
  padding: '6px 0 calc(24px + env(safe-area-inset-bottom))',
  width: '100%',
  maxWidth: 560,
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  animation: 'slideUp 0.3s ease',
  boxShadow: '0 -8px 40px rgba(0,0,0,0.16)',
}

const handle = {
  width: 40, height: 4.5,
  background: '#e2e8f0',
  borderRadius: 3,
  margin: '8px auto 10px',
  flexShrink: 0,
}

const brandHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '6px 20px 0',
  flexShrink: 0,
}

const logoRow = {
  display: 'flex', alignItems: 'center', gap: 10,
}

const logoBadge = {
  width: 34, height: 34,
  borderRadius: 11,
  background: 'linear-gradient(135deg, rgba(15,157,88,0.16), rgba(15,157,88,0.06))',
  border: '1px solid rgba(15,157,88,0.18)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: GREEN,
}

const closeBtn = {
  width: 34, height: 34,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: SOFT, borderRadius: '50%',
  color: MUTED, cursor: 'pointer', flexShrink: 0,
}

const titleBlock = {
  padding: '12px 20px 12px',
  flexShrink: 0,
}

const tabs = {
  display: 'flex', gap: 8,
  padding: 4,
  margin: '0 20px 12px',
  background: SOFT,
  border: '1px solid #eef2f6',
  borderRadius: 12,
  flexShrink: 0,
}

const tabBtn = {
  flex: 1,
  padding: '9px 8px',
  border: 'none', borderRadius: 9,
  background: 'transparent',
  fontSize: 13, fontWeight: 700,
  color: MUTED,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
  WebkitTapHighlightColor: 'transparent',
}

const tabActive = {
  background: '#fff',
  color: GREEN,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
}

const body = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
  padding: '0 20px 12px',
  scrollbarWidth: 'thin',
  WebkitOverflowScrolling: 'touch',
}

const intro = {
  fontSize: 13.5,
  lineHeight: 1.6,
  color: MUTED,
  background: 'linear-gradient(135deg, #f0faf4, #f8fbf9)',
  border: '1px solid #d9eee2',
  borderRadius: 14,
  padding: '14px 16px',
  margin: '0 0 18px',
}

const section = {
  marginBottom: 20,
}

const sectionTitle = {
  fontSize: 13.5,
  fontWeight: 800,
  color: INK,
  margin: '0 0 6px',
  lineHeight: 1.4,
}

const sectionBody = {
  fontSize: 13.5,
  lineHeight: 1.65,
  color: '#3f4a5a',
  margin: 0,
}

const footer = {
  borderTop: '1px solid #eef2f6',
  padding: '12px 20px 0',
  flexShrink: 0,
}

const agreeBtn = {
  width: '100%',
  background: 'linear-gradient(135deg,#0F9D58,#0a7a44)',
  color: '#fff', border: 'none',
  borderRadius: 14, padding: '14px',
  fontSize: 15, fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 2px 8px rgba(15,157,88,0.28)',
  display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 8,
}

const agreeDisabled = {
  background: '#e2e8f0',
  color: '#94a3b8',
  cursor: 'not-allowed',
  boxShadow: 'none',
}

const laterBtn = {
  width: '100%',
  background: 'transparent',
  color: MUTED, border: 'none',
  borderRadius: 14, padding: '10px',
  fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
