import { T } from './tokens'

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .lf-v2 { font-family: ${T.font}; background: ${T.gray50}; color: ${T.gray900}; }
  .lf-v2 button, .lf-v2 input, .lf-v2 select, .lf-v2 textarea { font-family: inherit; }
  .lf-scroll::-webkit-scrollbar { display: none; }
  .lf-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes spin   { to { transform:rotate(360deg); } }
  @keyframes pulse  { 0%,100%{opacity:1;} 50%{opacity:0.45;} }
  @keyframes shimmer { 0%{background-position:-600px 0;} 100%{background-position:600px 0;} }
  @keyframes badgePop { 0%{transform:scale(0.7);opacity:0;} 70%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;} }
  @keyframes slideUp { from{transform:translateY(100%);} to{transform:translateY(0);} }
  .lf-nav-glass {
    position: sticky; top: 0; z-index: 200;
    backdrop-filter: blur(20px) saturate(1.8);
    -webkit-backdrop-filter: blur(20px) saturate(1.8);
    background: rgba(255,255,255,0.90);
    border-bottom: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.04);
  }
  .lf-card {
    background: ${T.white};
    border-radius: 20px;
    border: 1px solid ${T.gray100};
    box-shadow: ${T.shadow};
    transition: transform 0.22s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.22s ease;
  }
  .lf-card:hover {
    transform: translateY(-3px) scale(1.006);
    box-shadow: ${T.shadowMd};
  }
  .lf-btn-primary {
    background: ${T.green}; color: #fff; border: none;
    border-radius: 12px; padding: 11px 20px;
    font-size: 13.5px; font-weight: 700; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    white-space: nowrap;
  }
  .lf-btn-primary:hover { background: ${T.greenD}; box-shadow: 0 4px 16px rgba(15,157,88,0.3); transform: translateY(-1px); }
  .lf-btn-primary:active { transform: scale(0.98); }
  .lf-btn-secondary {
    background: ${T.white}; color: ${T.gray800};
    border: 1.5px solid ${T.gray200}; border-radius: 12px;
    padding: 10px 18px; font-size: 13px; font-weight: 600;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    transition: all 0.15s; white-space: nowrap;
  }
  .lf-btn-secondary:hover { border-color: ${T.green}; color: ${T.green}; background: ${T.greenL}; }
  .lf-input {
    width: 100%; border: 1.5px solid ${T.gray200}; border-radius: 12px;
    padding: 11px 14px; font-size: 14px; background: ${T.white}; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s; color: ${T.gray900};
  }
  .lf-input:focus { border-color: ${T.green}; box-shadow: 0 0 0 3px rgba(15,157,88,0.10); }
  .lf-select {
    width: 100%; border: 1.5px solid ${T.gray200}; border-radius: 12px;
    padding: 11px 14px; font-size: 14px; background: ${T.white}; outline: none;
    appearance: none; color: ${T.gray900}; cursor: pointer;
    transition: border-color 0.15s;
  }
  .lf-select:focus { border-color: ${T.green}; box-shadow: 0 0 0 3px rgba(15,157,88,0.10); }
  .lf-pill {
    border-radius: 50px; padding: 7px 15px; font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; white-space: nowrap; border: none;
  }
  .lf-tab {
    padding: 8px 16px; border-radius: 50px; border: 1.5px solid ${T.gray200};
    background: ${T.white}; font-size: 13px; font-weight: 600; color: ${T.gray600};
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .lf-tab.active {
    background: ${T.green} !important; border-color: ${T.green} !important;
    color: #fff !important; box-shadow: 0 2px 10px rgba(15,157,88,0.28);
  }
  .lf-tab:hover:not(.active) { border-color: ${T.green}; color: ${T.green}; background: ${T.greenL}; }
  .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
    background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: 10px;
  }
  @media (max-width: 768px) {
    .lf-grid-3 { grid-template-columns: 1fr !important; }
    .lf-featured-grid { grid-template-columns: 1fr !important; }
  }
`