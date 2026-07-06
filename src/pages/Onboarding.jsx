import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const T = {
  green: '#2e7d32',
  greenDark: '#1b5e20',
  greenDarker: '#0d1f0f',
  greenLight: '#e8f5e9',
  gold: '#f9a825',
  goldDark: '#f57f17',
  white: '#ffffff',
  offwhite: '#f9fafb',
  text: '#0d1b0e',
  textMuted: '#4a5e4d',
  textLight: '#7a917c',
  border: '#d8e8da',
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  @keyframes ob-fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ob-spin { to { transform: rotate(360deg); } }

  .ob-root {
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
    background: ${T.offwhite};
    display: flex;
    flex-direction: column;
  }

  /* ── HERO ── */
  .ob-hero {
    position: relative;
    background: linear-gradient(155deg, ${T.greenDarker} 0%, #14361a 55%, ${T.greenDark} 100%);
    overflow: hidden;
    padding: 26px 24px 30px;
    text-align: center;
  }
  .ob-hero-arc-tl {
    position: absolute; top: -120px; left: -120px;
    width: 280px; height: 280px; border-radius: 50%;
    border: 36px solid rgba(46,125,50,0.45);
  }
  .ob-hero-arc-tr {
    position: absolute; top: -60px; right: -180px;
    width: 320px; height: 320px; border-radius: 50%;
    border: 40px solid rgba(46,125,50,0.3);
  }
  .ob-hero-arc-br {
    position: absolute; bottom: -160px; right: -100px;
    width: 300px; height: 300px; border-radius: 50%;
    border: 44px solid rgba(249,168,37,0.35);
  }
  .ob-hero-inner {
    position: relative;
    z-index: 2;
    max-width: 640px;
    margin: 0 auto;
    animation: ob-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
  }
  .ob-brand {
    font-size: 30px;
    font-weight: 900;
    letter-spacing: -1px;
    color: ${T.white};
  }
  .ob-brand span { color: ${T.gold}; }
  .ob-tagline {
    font-size: 13px;
    color: rgba(255,255,255,0.55);
    font-weight: 600;
    letter-spacing: 1px;
    margin-top: 6px;
  }
  .ob-welcome {
    font-size: clamp(24px, 3.6vw, 34px);
    font-weight: 900;
    color: ${T.white};
    letter-spacing: -1px;
    margin-top: 16px;
    line-height: 1.15;
  }
  .ob-welcome span { color: #22a05e; }
  .ob-sub {
    font-size: 13.5px;
    color: rgba(255,255,255,0.65);
    line-height: 1.5;
    margin-top: 10px;
    max-width: 460px;
    margin-left: auto;
    margin-right: auto;
  }
  .ob-trustline {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24px;
    margin-top: 16px;
  }
  .ob-trustline-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13.5px;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
  }

  /* ── PROMPT ── */
  .ob-prompt {
    text-align: center;
    padding: 18px 24px 4px;
  }
  .ob-prompt h2 {
    font-size: 22px;
    font-weight: 800;
    color: ${T.text};
    letter-spacing: -0.4px;
  }
  .ob-prompt-underline {
    width: 48px;
    height: 3px;
    background: ${T.green};
    border-radius: 2px;
    margin: 12px auto 0;
  }

  /* ── CARDS ── */
  .ob-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    max-width: 1040px;
    margin: 18px auto 0;
    padding: 0 24px;
    flex: 1;
  }
  @media (max-width: 860px) {
    .ob-cards { grid-template-columns: 1fr; max-width: 460px; }
  }

  .ob-card {
    background: ${T.white};
    border: 1.5px solid ${T.border};
    border-radius: 16px;
    padding: 18px 18px 18px;
    display: flex;
    flex-direction: column;
    animation: ob-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .ob-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(13,31,15,0.08); }
  .ob-card.featured {
    background: linear-gradient(180deg, #fffaf0 0%, ${T.white} 100%);
    border-color: #f6dba0;
  }

  .ob-icon-circle {
    width: 56px; height: 56px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 12px;
  }
  .ob-icon-circle.buyer { background: ${T.greenLight}; }
  .ob-icon-circle.shop  { background: #fdf0d5; }
  .ob-icon-circle.later { background: #eceeec; }

  .ob-card h3 {
    text-align: center;
    font-size: 17px;
    font-weight: 800;
    color: ${T.text};
    letter-spacing: -0.3px;
  }
  .ob-card-desc {
    text-align: center;
    font-size: 12.5px;
    color: ${T.textMuted};
    line-height: 1.45;
    margin-top: 5px;
    min-height: 0;
  }

  .ob-feature-list {
    list-style: none;
    margin-top: 10px;
    flex: 1;
  }
  .ob-feature-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: ${T.text};
    padding: 3px 0;
  }
  .ob-feature-check {
    width: 16px; height: 16px;
    border-radius: 50%;
    background: ${T.greenLight};
    color: ${T.green};
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .ob-btn {
    width: 100%;
    border: none;
    border-radius: 11px;
    padding: 11px 18px;
    font-size: 13.5px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 14px;
    transition: all 0.2s;
  }
  .ob-btn:disabled { opacity: 0.65; cursor: not-allowed; }
  .ob-btn.buyer {
    background: ${T.green};
    color: ${T.white};
    box-shadow: 0 4px 14px rgba(46,125,50,0.28);
  }
  .ob-btn.buyer:hover { background: ${T.greenDark}; transform: translateY(-1px); }
  .ob-btn.shop {
    background: linear-gradient(135deg, ${T.gold} 0%, ${T.goldDark} 100%);
    color: ${T.text};
    box-shadow: 0 4px 14px rgba(249,168,37,0.35);
  }
  .ob-btn.shop:hover { box-shadow: 0 6px 20px rgba(249,168,37,0.45); transform: translateY(-1px); }
  .ob-btn.later {
    background: ${T.white};
    color: ${T.text};
    border: 1.5px solid ${T.border};
  }
  .ob-btn.later:hover { background: #f5f7f5; }

  .ob-spinner {
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 2.2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    animation: ob-spin 0.6s linear infinite;
  }
  .ob-spinner-dark {
    border-color: rgba(13,27,14,0.2);
    border-top-color: ${T.text};
  }

  /* ── TRUST BAR ── */
  .ob-bottombar {
    max-width: 1040px;
    margin: 16px auto 20px;
    padding: 0 24px;
  }
  .ob-bottombar-inner {
    background: ${T.greenDarker};
    border-radius: 16px;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }
  .ob-bottombar-badge {
    width: 44px; height: 44px;
    border-radius: 12px;
    background: rgba(255,255,255,0.08);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }
  .ob-bottombar-text { flex: 1; min-width: 200px; }
  .ob-bottombar-text h4 {
    color: ${T.white};
    font-size: 15px;
    font-weight: 700;
  }
  .ob-bottombar-text p {
    color: rgba(255,255,255,0.55);
    font-size: 13px;
    margin-top: 3px;
    line-height: 1.45;
  }
  .ob-avatars {
    display: flex;
    align-items: center;
  }
  .ob-avatar {
    width: 38px; height: 38px;
    border-radius: 50%;
    border: 2px solid ${T.greenDarker};
    margin-left: -10px;
    background: ${T.green};
    display: flex; align-items: center; justify-content: center;
    color: ${T.white};
    font-size: 13px;
    font-weight: 700;
    overflow: hidden;
  }
  .ob-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .ob-avatar.plus {
    background: ${T.gold};
    color: ${T.text};
    font-size: 11px;
  }
  .ob-avatar:first-child { margin-left: 0; }
`

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function Onboarding() {
  const navigate = useNavigate()
  const [loadingPath, setLoadingPath] = useState(null) // 'buyer' | 'shop' | 'later'

  async function choose(path) {
    setLoadingPath(path)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) { navigate('/login'); return }

    if (path === 'buyer') {
      await supabase.from('profiles').update({
        onboarded: true,
        account_type: 'personal',
      }).eq('id', user.id)
      navigate('/')
      return
    }

    if (path === 'shop') {
      await supabase.from('profiles').update({
        onboarded: true,
        account_type: 'shop',
      }).eq('id', user.id)
      navigate('/shop-setup')
      return
    }

    // Continue Later — ask once, don't nag again
    await supabase.from('profiles').update({
      onboarding_skipped: true,
    }).eq('id', user.id)
    navigate('/')
  }

  return (
    <div className="ob-root">
      <style>{css}</style>

      {/* ── HERO ── */}
      <div className="ob-hero">
        <div className="ob-hero-arc-tl" />
        <div className="ob-hero-arc-tr" />
        <div className="ob-hero-arc-br" />

        <div className="ob-hero-inner">
          <div className="ob-brand">Soko<span>MW</span></div>
          <div className="ob-tagline">Buy &nbsp;·&nbsp; Sell &nbsp;·&nbsp; Grow</div>

          <h1 className="ob-welcome">Welcome to <span>SokoMW</span></h1>
          <p className="ob-sub">
            Malawi's smarter marketplace. Buy, sell and grow with people you can trust.
          </p>

          <div className="ob-trustline">
            <div className="ob-trustline-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22a05e" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/>
              </svg>
              Safe &amp; Secure
            </div>
            <div className="ob-trustline-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22a05e" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 1 1 18 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Local First
            </div>
            <div className="ob-trustline-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22a05e" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              For Everyone
            </div>
          </div>
        </div>
      </div>

      {/* ── PROMPT ── */}
      <div className="ob-prompt">
        <h2>What would you like to do?</h2>
        <div className="ob-prompt-underline" />
      </div>

      {/* ── CARDS ── */}
      <div className="ob-cards">

        {/* Buyer */}
        <div className="ob-card">
          <div className="ob-icon-circle buyer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
              <path d="M3 6h18"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <h3>Buy &amp; Sell Items</h3>
          <p className="ob-card-desc">I want to buy, sell or post occasionally.</p>
          <ul className="ob-feature-list">
            <li><span className="ob-feature-check"><CheckIcon /></span>Post items easily</li>
            <li><span className="ob-feature-check"><CheckIcon /></span>Find great deals</li>
            <li><span className="ob-feature-check"><CheckIcon /></span>Chat with sellers</li>
            <li><span className="ob-feature-check"><CheckIcon /></span>Bid on products</li>
          </ul>
          <button className="ob-btn buyer" onClick={() => choose('buyer')} disabled={loadingPath !== null}>
            {loadingPath === 'buyer' ? <div className="ob-spinner" /> : <>Continue as Buyer →</>}
          </button>
        </div>

        {/* Shop */}
        <div className="ob-card featured">
          <div className="ob-icon-circle shop">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4920a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9 12 3l9 6"/>
              <path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/>
              <path d="M9 21V14h6v7"/>
            </svg>
          </div>
          <h3>Grow My Business</h3>
          <p className="ob-card-desc">I own a business and want an online shop.</p>
          <ul className="ob-feature-list">
            <li><span className="ob-feature-check"><CheckIcon /></span>Create your own shop</li>
            <li><span className="ob-feature-check"><CheckIcon /></span>Reach more customers</li>
            <li><span className="ob-feature-check"><CheckIcon /></span>Build trust &amp; followers</li>
            <li><span className="ob-feature-check"><CheckIcon /></span>Share your shop link</li>
          </ul>
          <button className="ob-btn shop" onClick={() => choose('shop')} disabled={loadingPath !== null}>
            {loadingPath === 'shop' ? <div className="ob-spinner ob-spinner-dark" /> : <>Create My Shop →</>}
          </button>
        </div>

        {/* Later */}
        <div className="ob-card">
          <div className="ob-icon-circle later">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#637068" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 3"/>
            </svg>
          </div>
          <h3>Continue Later</h3>
          <p className="ob-card-desc">I'm not sure right now. Let me explore first.</p>
          <ul className="ob-feature-list">
            <li><span className="ob-feature-check"><CheckIcon /></span>Explore SokoMW</li>
            <li><span className="ob-feature-check"><CheckIcon /></span>Post or buy items</li>
            <li><span className="ob-feature-check"><CheckIcon /></span>Create a shop anytime</li>
          </ul>
          <button className="ob-btn later" onClick={() => choose('later')} disabled={loadingPath !== null}>
            {loadingPath === 'later' ? <div className="ob-spinner ob-spinner-dark" /> : <>Explore First →</>}
          </button>
        </div>

      </div>

      {/* ── TRUST BAR ── */}
      <div className="ob-bottombar">
        <div className="ob-bottombar-inner">
          <div className="ob-bottombar-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22a05e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div className="ob-bottombar-text">
            <h4>Trusted by thousands across Malawi</h4>
            <p>Join local buyers and businesses already growing on SokoMW.</p>
          </div>
          <div className="ob-avatars">
            <div className="ob-avatar">G</div>
            <div className="ob-avatar">T</div>
            <div className="ob-avatar">M</div>
            <div className="ob-avatar plus">+5K</div>
          </div>
        </div>
      </div>
    </div>
  )
}