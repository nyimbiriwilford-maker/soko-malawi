import { useEffect, useRef } from 'react';

/**
 * Google One Tap — silently detects the Google account(s) already signed in on
 * this device/browser and, if found, renders the native "Continue as {email}"
 * prompt. The resulting ID token is exchanged for a Supabase session without
 * leaving the page. Requires VITE_GOOGLE_CLIENT_ID (web client id) to be set.
 *
 * Renders nothing — One Tap draws its own iframe UI.
 */
function GoogleOneTap({ clientId, onCredential, onError }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!clientId) {
      console.warn('[OneTap] VITE_GOOGLE_CLIENT_ID is not set — One Tap disabled.');
      return undefined;
    }
    if (typeof window === 'undefined' || firedRef.current) return undefined;
    firedRef.current = true;

    let cancelled = false;

    const loadScript = () =>
      new Promise((resolve, reject) => {
        if (window.google?.accounts?.id) {
          resolve();
          return;
        }
        const existing = document.getElementById('gsi-script');
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('load failed')), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.id = 'gsi-script';
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Google Identity Services failed to load.'));
        document.head.appendChild(s);
      });

    loadScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        console.log('[OneTap] GIS loaded; initializing with client id:', clientId.slice(0, 8) + '…');
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            if (resp?.credential) onCredential?.(resp.credential);
            else onError?.(new Error('Google sign-in was not completed.'));
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.prompt?.((notification) => {
          console.log('[OneTap] prompt notification:', notification);
          if (notification && notification.isNotDisplayed && !notification.isSkippedMoment) {
            onError?.(new Error(notification.getNotDisplayedReason?.() || 'NO_SESSION'));
          }
        });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[OneTap] failed to load/init:', err);
          onError?.(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, onError]);

  return null;
}

export default GoogleOneTap;
