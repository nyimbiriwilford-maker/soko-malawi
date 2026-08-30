import { useNavigate } from 'react-router-dom'
import SokoNav from '../components/SokoNav'

/*
 * SafetyPage — "Learn more about safe trading" education hub.
 * Linked from the product page (Buy with Confidence card) and the chats
 * sidebar ("Buy and sell safely"). SokoMW connects buyers and sellers;
 * people meet, inspect and pay directly — so this page teaches exactly
 * how to do that safely in the Malawi context.
 */

const GREEN  = '#0F9D58'
const GREEND = '#0a7a44'
const AMBER  = '#F9AB00'
const RED    = '#dc2626'
const INK    = '#0f172a'
const SUB    = '#475569'
const MUTED  = '#64748b'
const LINE   = '#e2e8f0'

const DO = [
  { icon: '📍', title: 'Meet in a public place', body: 'Arrange to meet the seller in a busy, open location — a market, filling station, shop entrance or police-checked area. Never invite a stranger to your home, and never go to theirs alone.' },
  { icon: '✅', title: 'Inspect before you pay', body: 'Open the box, test the phone, start the engine — check everything works before money changes hands. On SokoMW you are free to take your time; the seller should never rush you.' },
  { icon: '💬', title: 'Keep the conversation on SokoMW', body: 'Chat inside the app, or use the WhatsApp / call buttons on the listing. Our chat keeps a record of your deal — if anything goes wrong, that history helps us act on reports.' },
  { icon: '🤝', title: 'Pay on delivery, in person', body: 'SokoMW does not process payments — you pay the seller directly when you meet. Pay only after you have seen and accepted the item. Cash on delivery is the safest default.' },
  { icon: '⭐', title: 'Check the seller before the deal', body: 'Look at the seller profile and shop page: ratings, reviews, how long they have been selling, and their verification badge. Verified sellers have proven their identity to SokoMW.' },
  { icon: '📸', title: 'Keep evidence of your deal', body: 'Save screenshots of the listing, the agreed price and the chat. Note the seller name, phone number and listing title — you will need them if you report a problem.' },
]

const DONT = [
  { icon: '💸', title: 'Never pay in advance', body: 'No deposit, no "booking fee", no delivery pre-payment to a stranger. A genuine seller will not ask for money before you see the item. Advance-payment requests are the #1 scam pattern.' },
  { icon: '📱', title: 'Never share OTPs or passwords', body: 'No SokoMW staff will ever ask for your password or the code sent to your email. Anyone asking is trying to take over your account — report them immediately.' },
  { icon: '🎣', title: 'Don\'t trust "too good to be true"', body: 'A brand-new iPhone at a quarter of the price? A job that pays before you work? If it looks too good, it is a scam. Compare prices across listings before you commit.' },
  { icon: '📦', title: 'Don\'t pay for "delivery" you didn\'t arrange', body: 'If the seller suddenly says an agent will deliver the item and you must pay the agent first, stop. Meet in person instead. Fake courier + advance delivery fee is a common scam.' },
  { icon: '🔗', title: 'Don\'t transact off-platform links', body: 'If a seller sends you to another website to "complete payment", or asks you to click strange links, do not. SokoMW deals are completed in person or via chat — nothing needs an external payment site.' },
  { icon: '⚡', title: 'Don\'t let anyone rush you', body: '"Someone else is buying it right now!" Pressure is a scammer\'s tool. A genuine seller will let you ask questions, inspect the item and think it over.' },
]

const STEPS = [
  { n: '1', title: 'Find the item', body: 'Browse listings, shops and categories. Compare prices with similar listings so you know what a fair price looks like.' },
  { n: '2', title: 'Check the seller', body: 'Open the seller profile or shop. Look for ratings, reviews, verification badge and how long they have been on SokoMW.' },
  { n: '3', title: 'Chat and ask questions', body: 'Use Chat with Seller, WhatsApp or Call — all available on every listing. Ask about condition, history, and why they are selling.' },
  { n: '4', title: 'Agree on a public meeting point', body: 'Choose a safe, busy place near you, agree a time in the chat so there is a record, and let a friend or family member know where you are going.' },
  { n: '5', title: 'Inspect and pay in person', body: 'Test the item thoroughly. Once you are satisfied, pay the seller directly — cash on delivery. Get a receipt or written proof if possible.' },
  { n: '6', title: 'Report anything wrong', body: 'If a listing is fake, a seller behaves suspiciously or you were scammed, use the Report Listing button on the product page. Our admin team reviews every report and can remove listings and act on sellers.' },
]

export default function SafetyPage() {
  const navigate = useNavigate()
  const goHome = () => navigate('/')

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8f7', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        .sf-card:hover { transform: translateY(-2px); }
        .sf-card { transition: transform .15s ease; }
      `}</style>
      <SokoNav />

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 18px 80px' }}>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 60%, #fffbeb 130%)', border: '1px solid #bbf7d0', borderRadius: 22, padding: '28px 26px', marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: '-0.4px' }}>Safe Trading Guide</div>
              <div style={{ fontSize: 12.5, color: GREEND, fontWeight: 600, marginTop: 2 }}>How to buy and sell safely on SokoMW</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: SUB, lineHeight: 1.65, margin: 0 }}>
            SokoMW connects buyers and sellers across Malawi — you chat, meet and pay each other directly.
            That freedom works best when you trade smart. This guide shows you exactly how: what to always do,
            what to never do, and how the deal works step by step.
          </p>
        </div>

        {/* ── The Golden Rules ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 26 }}>
          {/* DO */}
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ background: '#f0fdf4', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${LINE}` }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: GREEND }}>Always do</span>
            </div>
            <div style={{ padding: '6px 18px 14px' }}>
              {DO.map(item => (
                <div key={item.title} className="sf-card" style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: `1px solid #f1f5f9` }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, marginBottom: 3 }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DON'T */}
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ background: '#fef2f2', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${LINE}` }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: RED, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✕</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: RED }}>Never do</span>
            </div>
            <div style={{ padding: '6px 18px 14px' }}>
              {DONT.map(item => (
                <div key={item.title} className="sf-card" style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: `1px solid #f1f5f9` }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, marginBottom: 3 }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Step by step ── */}
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 20, padding: '24px 22px', marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{ width: 30, height: 30, borderRadius: 10, background: '#fffbeb', color: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🧭</span>
            <span style={{ fontSize: 16.5, fontWeight: 800, color: INK }}>A safe deal, step by step</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            {STEPS.map(s => (
              <div key={s.n} className="sf-card" style={{ background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: 14, padding: '16px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: GREEN, color: '#fff', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{s.title}</span>
                </div>
                <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Spot the scam ── */}
        <div style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a', borderRadius: 20, padding: '24px 22px', marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 16.5, fontWeight: 800, color: '#92400e' }}>Spot a scam instantly</span>
          </div>
          <p style={{ fontSize: 13, color: SUB, lineHeight: 1.65, margin: '0 0 14px' }}>
            Almost every marketplace scam in Malawi is a variation of these three moves. Recognise one, and you are safe:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { t: 'The advance payment', d: '"Send a deposit / delivery fee / agent fee first, then you get the item." — No. Pay only when the item is in your hands.' },
              { t: 'The rush', d: '"Pay now or someone else takes it / price ends in 10 minutes." — Genuine sellers don\'t pressure. Pressure = walk away.' },
              { t: 'The redirect', d: '"Click this link / pay on this other site / send me the OTP." — SokoMW never needs this. Links and OTPs are for account takeovers.' },
            ].map(x => (
              <div key={x.t} style={{ background: 'rgba(255,255,255,.85)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: RED, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>✕</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{x.t}:</span>{' '}
                  <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{x.d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Report + support ── */}
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 20, padding: '24px 22px', marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🚩</span>
            <span style={{ fontSize: 16.5, fontWeight: 800, color: INK }}>See something wrong? Report it</span>
          </div>
          <p style={{ fontSize: 13, color: SUB, lineHeight: 1.65, margin: '0 0 14px' }}>
            On every product page there is a <strong>Report Listing</strong> button — use it for scams, fake items,
            prohibited goods, misleading prices or anything suspicious. Reports go straight to our admin team,
            who can remove the listing and act on the seller. If you were defrauded, also report it to the
            Malawi Police Service (cybercrime unit) and keep all your chat evidence.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => navigate('/')} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 22px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Browse listings safely
            </button>
            <button type="button" onClick={goHome} style={{ background: '#fff', color: INK, border: `1.5px solid ${LINE}`, borderRadius: 12, padding: '12px 22px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Back to home
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>
          SokoMW connects buyers and sellers — it does not process payments, hold items, or guarantee transactions.<br />
          Trade smart: meet in public, inspect first, pay on delivery.
        </div>
      </div>
    </div>
  )
}
