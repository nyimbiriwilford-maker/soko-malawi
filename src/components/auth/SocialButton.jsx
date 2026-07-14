import { memo } from 'react';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}

const PROVIDERS = {
  google: { label: 'Continue with Google', icon: GoogleIcon },
  facebook: { label: 'Continue with Facebook', icon: FacebookIcon },
};

function SocialButton({
  provider = 'google',
  onClick,
  loading = false,
  disabled = false,
  className = '',
  children,
}) {
  const config = PROVIDERS[provider] || PROVIDERS.google;
  const Icon = config.icon;
  const label = children || config.label;
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={typeof label === 'string' ? label : config.label}
      aria-busy={loading || undefined}
      className={['login-social-btn', className].filter(Boolean).join(' ')}
    >
      {loading ? (
        <span className="login-btn__spinner" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: '#16A34A' }} aria-hidden="true" />
      ) : (
        <Icon />
      )}
      <span>{loading ? 'Connecting...' : label}</span>
    </button>
  );
}

export default memo(SocialButton);
