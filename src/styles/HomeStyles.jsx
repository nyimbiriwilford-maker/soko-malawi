// Inject this <style> tag once inside your top-level layout or Home component.
// Usage:  import HomeStyles from '../styles/HomeStyles'
//         then render <HomeStyles /> at the top of the JSX tree.

export default function HomeStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
      * { box-sizing: border-box; }
      @keyframes fadeUp        { from{opacity:0} to{opacity:1} }
      @keyframes shimmer       { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
      @keyframes pulse         { 0%,100%{opacity:1} 50%{opacity:0.4} }
      @keyframes slideDown     { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes scaleIn       { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
      @keyframes cursorBlink   { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      @keyframes cursorSolid   { 0%,100%{opacity:1} }
      @keyframes spin          { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes imgBannerIn   { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      @keyframes flashPulse    { 0%,100%{opacity:1} 50%{opacity:0.7} }
      @keyframes timerTick     { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }
      @keyframes brandReveal   { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
      @keyframes sloganReveal  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      @keyframes logoPopIn     { 0%{opacity:0;transform:scale(0.5) rotate(-15deg)} 70%{transform:scale(1.12) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0deg)} }
      @keyframes bellWiggle    { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(14deg)} 40%{transform:rotate(-12deg)} 60%{transform:rotate(8deg)} 80%{transform:rotate(-6deg)} }
      @keyframes avatarGlow    { 0%,100%{box-shadow:0 2px 8px rgba(26,122,74,0.3)} 50%{box-shadow:0 4px 18px rgba(26,122,74,0.55)} }
      @keyframes searchSlideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      @keyframes pillBounceIn  { 0%{opacity:0;transform:scale(0.7) translateY(8px)} 65%{transform:scale(1.08) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
      @keyframes underlineGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
      @keyframes featuredHeaderIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
      @keyframes cardSlideIn   { from{opacity:0;transform:translateX(40px) scale(0.95)} to{opacity:1;transform:translateX(0) scale(1)} }
      @keyframes shimmerOverlay{ 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      @keyframes pricePopIn    { 0%{opacity:0;transform:scale(0.7) translateY(6px)} 70%{transform:scale(1.1) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
      @keyframes starSpin      { 0%{transform:rotate(0deg) scale(1)} 25%{transform:rotate(-15deg) scale(1.3)} 75%{transform:rotate(10deg) scale(1.15)} 100%{transform:rotate(0deg) scale(1)} }
      @keyframes flashStripIn  { from{opacity:0;max-height:0;padding:0} to{opacity:1;max-height:400px} }
@keyframes wordSlideUp {
  0%   { transform: translateY(100%); opacity: 0;   }
  15%  { transform: translateY(0);    opacity: 1;   }
  70%  { transform: translateY(0);    opacity: 1;   }
  85%  { transform: translateY(-100%);opacity: 0;   }
  100% { transform: translateY(-100%);opacity: 0;   }
}
      input:focus { outline: none; }
      ::-webkit-scrollbar { display: none; }
      button, select { font-family: 'DM Sans', system-ui, sans-serif; }
      .catpill { transition: background 0.16s, color 0.16s, border-color 0.16s, transform 0.1s; }
      .catpill:active { transform: scale(0.93); }
      .listing-card { cursor: pointer; }
      .listing-card:active { opacity: 0.92; }
      .listing-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important; }
      /* Add at the bottom of HomeStyles */
.soko-v2 * { background-color: unset; }
.soko-v2 .soko-card-bg { background-color: #ffffff !important; }
    `}</style>
  )
}