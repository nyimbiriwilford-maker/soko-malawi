import { memo, useEffect, useRef, useId, useCallback } from 'react';

/**
 * Cloudflare Turnstile widget.
 *
 * Env:
 *   VITE_TURNSTILE_SITE_KEY — production site key
 *
 * Test key (always passes): 1x00000000000000000000AA
 * Docs: https://developers.cloudflare.com/turnstile/
 */
const TEST_SITE_KEY = '1x00000000000000000000AA';

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileLoading) return window.__turnstileLoading;

  window.__turnstileLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load captcha'));
    document.head.appendChild(s);
  });
  return window.__turnstileLoading;
}

function Captcha({ onToken, onExpire, className = '' }) {
  const hostRef = useRef(null);
  const widgetId = useRef(null);
  const reactId = useId().replace(/:/g, '');
  const siteKey =
    import.meta.env.VITE_TURNSTILE_SITE_KEY || TEST_SITE_KEY;

  const render = useCallback(async () => {
    try {
      await loadTurnstileScript();
      if (!hostRef.current || !window.turnstile) return;

      // Clear previous widget on re-render
      if (widgetId.current != null) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }

      while (hostRef.current.firstChild) {
        hostRef.current.removeChild(hostRef.current.firstChild);
      }
      widgetId.current = window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        theme: 'light',
        size: 'flexible',
        callback: (token) => onToken?.(token),
        'expired-callback': () => {
          onToken?.('');
          onExpire?.();
        },
        'error-callback': () => onToken?.(''),
      });
    } catch {
      // If script fails, leave token empty — server will reject when secret is set
      onToken?.('');
    }
  }, [onExpire, onToken, siteKey]);

  useEffect(() => {
    render();
    return () => {
      if (widgetId.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
      }
    };
  }, [render]);

  return (
    <div className={className}>
      <div
        ref={hostRef}
        id={`cf-turnstile-${reactId}`}
        className="min-h-[65px] w-full"
        aria-label="Security verification"
      />
      {!import.meta.env.VITE_TURNSTILE_SITE_KEY && (
        <p className="mt-1 text-[11px] text-[#94a3b8]">
          Dev captcha (set VITE_TURNSTILE_SITE_KEY for production)
        </p>
      )}
    </div>
  );
}

export default memo(Captcha);
