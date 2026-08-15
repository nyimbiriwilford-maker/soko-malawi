// src/components/auth/TermsModal.jsx
// Full Terms & Conditions + Privacy Policy shown on the sign-up page.
// Users must read (and agree to) these before creating an account.

import { useEffect, useRef, useState } from 'react'
import { TERMS_SECTIONS, PRIVACY_SECTIONS, LEGAL } from '../../constants/legal'

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

        <div style={headerRow}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(15,157,88,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F9D58" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f1410' }}>SokoMw {tab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</div>
            <div style={{ fontSize: 11.5, color: '#637068', marginTop: 2 }}>
              Effective {LEGAL.effectiveDate} · {tab === 'terms' ? 'Read before creating your account' : 'How we protect your data'}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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
          {tab === 'terms' ? (
            <p style={intro}>
              These Terms & Conditions ("Terms") are a legally binding agreement between you and {LEGAL.legalName} ("SokoMw"). Please read them carefully before creating an account.
            </p>
          ) : (
            <p style={intro}>
              This Privacy Policy explains how SokoMw collects, uses, stores and protects your personal data. It complies with the Malawi Data Protection Act, 2024.
            </p>
          )}

          {sections.map((s) => (
            <section key={s.id} style={section}>
              <h3 style={sectionTitle}>{s.title}</h3>
              <p style={sectionBody}>{s.body}</p>
            </section>
          ))}
        </div>

        {/* Read-to-end gate */}
        <div style={footer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: scrolled ? '#16a34a' : '#94a3b8', fontWeight: 600, marginBottom: 10 }}>
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
  borderRadius: '24px 24px 0 0',
  padding: '8px 20px calc(24px + env(safe-area-inset-bottom))',
  width: '100%',
  maxWidth: 560,
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  animation: 'slideUp 0.3s ease',
}

const handle = {
  width: 36, height: 4,
  background: '#e0ebe3',
  borderRadius: 2,
  margin: '8px auto 16px',
  flexShrink: 0,
}

const headerRow = {
  display: 'flex', alignItems: 'center', gap: 12,
  marginBottom: 14,
  flexShrink: 0,
}

const closeBtn = {
  marginLeft: 'auto',
  width: 36, height: 36,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: '#f1f5f9', borderRadius: '50%',
  color: '#64748b', cursor: 'pointer', flexShrink: 0,
}

const tabs = {
  display: 'flex', gap: 8,
  padding: 4,
  background: '#f1f5f9',
  borderRadius: 12,
  marginBottom: 12,
  flexShrink: 0,
}

const tabBtn = {
  flex: 1,
  padding: '9px 8px',
  border: 'none', borderRadius: 9,
  background: 'transparent',
  fontSize: 13, fontWeight: 700,
  color: '#64748b',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s, color 0.15s',
}

const tabActive = {
  background: '#fff',
  color: '#0F9D58',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
}

const body = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
  padding: '4px 2px 12px',
  scrollbarWidth: 'thin',
}

const intro = {
  fontSize: 13.5,
  lineHeight: 1.6,
  color: '#0f1410',
  background: '#f8fbf9',
  border: '1px solid #e0ebe3',
  borderRadius: 12,
  padding: '12px 14px',
  margin: '0 0 14px',
}

const section = {
  marginBottom: 16,
}

const sectionTitle = {
  fontSize: 13.5,
  fontWeight: 800,
  color: '#0f1410',
  margin: '0 0 5px',
  lineHeight: 1.4,
}

const sectionBody = {
  fontSize: 13,
  lineHeight: 1.62,
  color: '#374151',
  margin: 0,
}

const footer = {
  borderTop: '1px solid #eef2f6',
  paddingTop: 12,
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
  color: '#64748b', border: 'none',
  borderRadius: 14, padding: '10px',
  fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
