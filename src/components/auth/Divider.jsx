import { memo } from 'react';

function Divider({ label = 'OR CONTINUE WITH', className = '' }) {
  return (
    <div
      className={['login-divider', className].filter(Boolean).join(' ')}
      role="separator"
      aria-label={label}
    >
      <span className="login-divider__line" aria-hidden="true" />
      <span className="login-divider__text">{label}</span>
      <span className="login-divider__line" aria-hidden="true" />
    </div>
  );
}

export default memo(Divider);
