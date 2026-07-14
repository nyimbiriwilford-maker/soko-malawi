import { memo } from 'react';

function Logo({ className = '' }) {
  return (
    <div className={['login-logo', className].filter(Boolean).join(' ')}>
      <div className="login-logo__wordmark" aria-label="SokoMw" role="img">
        <span className="login-logo__soko">Soko</span>
        <span className="login-logo__mw">Mw</span>
      </div>
      <p className="login-logo__tagline">Buy. Sell. Connect.</p>
    </div>
  );
}

export default memo(Logo);
