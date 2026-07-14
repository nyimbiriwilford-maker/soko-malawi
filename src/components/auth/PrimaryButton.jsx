import { memo } from 'react';
import { Check } from 'lucide-react';

function PrimaryButton({
  type = 'button',
  children = 'Sign In',
  loading = false,
  success = false,
  disabled = false,
  onClick,
  className = '',
  'aria-label': ariaLabel,
}) {
  const busy = loading || success;
  const isDisabled = disabled || busy;

  let label = children;
  if (loading) label = 'Signing In...';
  if (success) label = 'Success';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={
        ariaLabel ||
        (loading ? 'Signing in' : success ? 'Success' : typeof children === 'string' ? children : 'Submit')
      }
      aria-busy={loading || undefined}
      className={['login-btn', loading ? 'is-loading' : '', className].filter(Boolean).join(' ')}
    >
      {loading && <span className="login-btn__spinner" aria-hidden="true" />}
      {success && (
        <span className="flex" aria-hidden="true">
          <Check size={18} strokeWidth={2.5} />
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}

export default memo(PrimaryButton);
