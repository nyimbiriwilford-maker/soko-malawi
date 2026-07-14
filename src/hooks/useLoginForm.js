import { useCallback, useRef, useState } from 'react';
import { hasErrors, validateEmail, validateLoginForm, validatePassword } from '../utils/validation';

const AUTH_ERROR_MESSAGE = 'Invalid email or password.';

/**
 * Production login form state, validation, and submit lifecycle.
 * Does not store or log credentials.
 *
 * @param {object} [options]
 * @param {(payload: { email: string, password: string, rememberMe: boolean }) => Promise<void>|void} [options.onSubmit]
 * @param {() => void} [options.onSuccess]
 * @param {(error: Error) => void} [options.onError]
 * @param {(provider: 'google'|'facebook') => Promise<void>|void} [options.onSocial]
 */
export function useLoginForm({ onSubmit, onSuccess, onError, onSocial } = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle | loading | success | error
  const [authError, setAuthError] = useState('');
  const [socialLoading, setSocialLoading] = useState(null); // null | 'google' | 'facebook'

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const submittingLock = useRef(false);
  const socialLock = useRef(false);

  const isBusy =
    loading || isSubmitting || submitStatus === 'success' || socialLoading != null;

  const markTouched = useCallback((field) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  const setFieldError = useCallback((field, message) => {
    setErrors((prev) => {
      if (!message) {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      if (prev[field] === message) return prev;
      return { ...prev, [field]: message };
    });
  }, []);

  const handleEmailChange = useCallback(
    (e) => {
      const value = e.target.value;
      setEmail(value);
      setAuthError('');
      if (submitStatus === 'error') setSubmitStatus('idle');
      if (touched.email) {
        setFieldError('email', validateEmail(value));
      }
    },
    [setFieldError, submitStatus, touched.email]
  );

  const handlePasswordChange = useCallback(
    (e) => {
      const value = e.target.value;
      setPassword(value);
      setAuthError('');
      if (submitStatus === 'error') setSubmitStatus('idle');
      if (touched.password) {
        setFieldError('password', validatePassword(value));
      }
    },
    [setFieldError, submitStatus, touched.password]
  );

  const handleEmailBlur = useCallback(() => {
    markTouched('email');
    setFieldError('email', validateEmail(email));
  }, [email, markTouched, setFieldError]);

  const handlePasswordBlur = useCallback(() => {
    markTouched('password');
    setFieldError('password', validatePassword(password));
  }, [markTouched, password, setFieldError]);

  const toggleShowPassword = useCallback(() => {
    const input = passwordRef.current;
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;

    setShowPassword((prev) => !prev);

    // Restore focus + selection after type switch (password ↔ text)
    requestAnimationFrame(() => {
      const el = passwordRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (start != null && end != null && typeof el.setSelectionRange === 'function') {
        try {
          el.setSelectionRange(start, end);
        } catch {
          /* ignore unsupported selection on transient type change */
        }
      }
    });
  }, []);

  const focusFirstInvalid = useCallback((fieldErrors) => {
    if (fieldErrors.email && emailRef.current) {
      emailRef.current.focus({ preventScroll: true });
      return;
    }
    if (fieldErrors.password && passwordRef.current) {
      passwordRef.current.focus({ preventScroll: true });
    }
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();

      if (submittingLock.current || socialLock.current) return;
      if (loading || isSubmitting || submitStatus === 'success') return;

      const fieldErrors = validateLoginForm({ email, password });
      setTouched({ email: true, password: true });
      setErrors(fieldErrors);
      setAuthError('');

      if (hasErrors(fieldErrors)) {
        setSubmitStatus('idle');
        focusFirstInvalid(fieldErrors);
        return;
      }

      if (typeof onSubmit !== 'function') {
        // Auth not wired — do not invent a success redirect
        setSubmitStatus('idle');
        setAuthError(AUTH_ERROR_MESSAGE);
        return;
      }

      submittingLock.current = true;
      setLoading(true);
      setIsSubmitting(true);
      setSubmitStatus('loading');
      setAuthError('');

      try {
        await onSubmit({
          email: email.trim(),
          password,
          rememberMe,
        });

        // Keep success visible until parent redirects; do not unlock for re-submit
        setSubmitStatus('success');
        setAuthError('');
        setLoading(false);
        setIsSubmitting(false);
        onSuccess?.();
      } catch (err) {
        const message =
          err?.message && typeof err.message === 'string' && err.message.trim()
            ? err.message
            : AUTH_ERROR_MESSAGE;

        setSubmitStatus('error');
        setAuthError(message);
        setLoading(false);
        setIsSubmitting(false);
        submittingLock.current = false;
        onError?.(err instanceof Error ? err : new Error(message));

        // Return button to default after brief error feedback
        window.setTimeout(() => {
          setSubmitStatus((status) => (status === 'error' ? 'idle' : status));
        }, 400);
      }
    },
    [
      email,
      focusFirstInvalid,
      isSubmitting,
      loading,
      onError,
      onSubmit,
      onSuccess,
      password,
      rememberMe,
      submitStatus,
    ]
  );

  const handleSocial = useCallback(
    async (provider) => {
      if (submittingLock.current || socialLock.current) return;
      if (isBusy) return;

      setAuthError('');
      socialLock.current = true;
      setSocialLoading(provider);

      try {
        if (typeof onSocial === 'function') {
          await onSocial(provider);
        } else {
          // Provider not wired — surface a clear, safe message
          throw new Error(`${provider === 'google' ? 'Google' : 'Facebook'} sign-in is unavailable.`);
        }
      } catch (err) {
        const message =
          err?.message && typeof err.message === 'string' && err.message.trim()
            ? err.message
            : AUTH_ERROR_MESSAGE;
        setAuthError(message);
        onError?.(err instanceof Error ? err : new Error(message));
      } finally {
        socialLock.current = false;
        setSocialLoading(null);
      }
    },
    [isBusy, onError, onSocial]
  );

  const handleEscape = useCallback(() => {
    if (!isBusy) setAuthError('');
  }, [isBusy]);

  return {
    email,
    password,
    rememberMe,
    showPassword,
    setRememberMe,
    errors,
    touched,
    loading,
    isSubmitting,
    submitStatus,
    authError,
    socialLoading,
    isBusy,
    emailRef,
    passwordRef,
    handlers: {
      handleEmailChange,
      handlePasswordChange,
      handleEmailBlur,
      handlePasswordBlur,
      toggleShowPassword,
      handleSubmit,
      handleSocial,
      handleEscape,
      setRememberMe,
    },
  };
}
