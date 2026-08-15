import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DISABLED_MESSAGE,
  USERNAME_RE,
  createAccountAfterOtp,
  isCaptchaRequired,
  sanitizeAuthError,
  sendOtp,
  signInWithEmailPassword,
  signInWithOAuth,
  verifyOtp,
} from '../lib/authApi';
import { validateEmail, validatePassword, validateStrongPassword, validatePasswordMatch } from '../utils/validation';

export const AUTH_MODES = {
  LOGIN: 'login',
  SIGNUP: 'signup',
  VERIFY_SIGNUP: 'verify_signup',
  FORGOT: 'forgot',
  OTP_RESET: 'otp_reset',
  NEW_PASSWORD: 'new_password',
};

const RESEND_COOLDOWN_SECONDS = 45;

/**
 * Full SokoMw auth flow (login, signup OTP, reset OTP, OAuth).
 * Visual state only — credentials are never logged or stored beyond React state for the form.
 */
export function useAuthFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState(AUTH_MODES.LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [username, setUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loadingAction, setLoadingAction] = useState(null);
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle | loading | success
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('disabled')) {
      return { text: DISABLED_MESSAGE, isError: false };
    }
    return { text: '', isError: false };
  });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0); // remount widget after use

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const usernameRef = useRef(null);
  const lockRef = useRef(false);

  // React to ?disabled=1 if navigated after mount
  useEffect(() => {
    if (searchParams.get('disabled')) {
      setMessage({ text: DISABLED_MESSAGE, isError: false });
    }
  }, [searchParams]);

  const setError = useCallback((text) => {
    setMessage({ text: sanitizeAuthError(text), isError: true });
  }, []);
  const setInfo = useCallback((text) => setMessage({ text, isError: false }), []);
  const clearMsg = useCallback(() => setMessage({ text: '', isError: false }), []);
  const startResendCooldown = useCallback(() => setResendCooldown(RESEND_COOLDOWN_SECONDS), []);
  const resetCaptcha = useCallback(() => {
    setCaptchaToken('');
    setCaptchaKey((k) => k + 1);
  }, []);

  /** Wipe secrets from memory when leaving password-bearing modes */
  const clearSecrets = useCallback(() => {
    setPassword('');
    setConfirmPassword('');
    setNewPass('');
    setConfirmPass('');
    setOtpCode('');
    setShowPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, []);

  const busy = loadingAction != null || submitStatus === 'success';

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const id = window.setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  // Soft autofocus only on login — never mark fields touched on mount
  useEffect(() => {
    if (mode !== AUTH_MODES.LOGIN) return undefined;
    const t = window.setTimeout(() => {
      emailRef.current?.focus({ preventScroll: true });
    }, 320);
    return () => window.clearTimeout(t);
  }, [mode]);

  // After signup OTP complete → focus username
  useEffect(() => {
    if (mode === AUTH_MODES.VERIFY_SIGNUP && otpCode.length === 6) {
      usernameRef.current?.focus({ preventScroll: true });
    }
  }, [otpCode, mode]);

  const goTo = useCallback(
    (nextMode) => {
      clearMsg();
      setFieldErrors({});
      setTouched({});
      setSubmitStatus('idle');
      // Clear OTP / password secrets when switching major flows
      if (
        nextMode === AUTH_MODES.LOGIN ||
        nextMode === AUTH_MODES.FORGOT ||
        nextMode === AUTH_MODES.SIGNUP
      ) {
        clearSecrets();
      }
      resetCaptcha();
      setMode(nextMode);
    },
    [clearMsg, clearSecrets, resetCaptcha]
  );

  const toggleShowPassword = useCallback(() => {
    const input = passwordRef.current;
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;
    setShowPassword((p) => !p);
    requestAnimationFrame(() => {
      const el = passwordRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (start != null && end != null) {
        try {
          el.setSelectionRange(start, end);
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  /* ─── LOGIN ─── */
  const handleLogin = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (lockRef.current || busy) return;

      // Match original Login logic: require email format + non-empty password
      const nextErrors = {};
      const emailErr = validateEmail(email);
      if (emailErr) nextErrors.email = emailErr;
      if (!password) nextErrors.password = 'Enter your email and password.';
      setTouched({ email: true, password: true });
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length) {
        if (nextErrors.email) emailRef.current?.focus();
        else passwordRef.current?.focus();
        return;
      }

      lockRef.current = true;
      setLoadingAction('signin');
      setSubmitStatus('loading');
      clearMsg();

      try {
        const { redirectTo } = await signInWithEmailPassword(email, password);
        setSubmitStatus('success');
        setLoadingAction(null);
        // Drop password from component state ASAP after success
        setPassword('');
        const safePath = redirectTo === '/admin' ? '/admin' : '/';
        window.setTimeout(() => {
          navigate(safePath);
        }, 700);
      } catch (err) {
        if (err?.isInfo || err?.code === 'ACCOUNT_DISABLED') {
          setInfo(err.message || DISABLED_MESSAGE);
        } else {
          setError(err.message || 'Invalid email or password.');
        }
        setSubmitStatus('idle');
        setLoadingAction(null);
        lockRef.current = false;
      }
    },
    [busy, clearMsg, email, navigate, password, setError, setInfo]
  );

  /* ─── OAUTH ─── */
  const handleOAuth = useCallback(
    async (provider) => {
      if (lockRef.current || busy) return;
      // Defense in depth — only google | facebook
      if (provider !== 'google') {
        setError('This sign-in method is not available.');
        return;
      }
      lockRef.current = true;
      setLoadingAction(provider);
      clearMsg();
      try {
        await signInWithOAuth(provider);
        // Browser navigates away on success
      } catch (err) {
        setError(err.message || 'Something went wrong. Please try again.');
        setLoadingAction(null);
        lockRef.current = false;
      }
    },
    [busy, clearMsg, setError]
  );

  /* ─── SIGNUP START ─── */
  const handleSignUpStart = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (lockRef.current || busy) return;

      if (!email.trim() || !password) {
        setError('Enter email and password');
        return;
      }
      const strongErr = validateStrongPassword(password);
      if (strongErr) {
        setError(strongErr);
        return;
      }
      const matchErr = validatePasswordMatch(confirmPassword, password);
      if (matchErr) {
        setError(matchErr);
        return;
      }
      if (!agreedToTerms) {
        setError('Please agree to the Terms & Privacy Policy');
        return;
      }
      if (isCaptchaRequired() && !captchaToken) {
        setError('Please complete the security check.');
        return;
      }

      lockRef.current = true;
      setLoadingAction('signup');
      clearMsg();
      try {
        await sendOtp(email, captchaToken);
        setInfo('Verification code sent to your email.');
        setOtpCode('');
        startResendCooldown();
        resetCaptcha();
        setMode(AUTH_MODES.VERIFY_SIGNUP);
      } catch (err) {
        setError(err.message);
        resetCaptcha();
      } finally {
        setLoadingAction(null);
        lockRef.current = false;
      }
    },
    [agreedToTerms, busy, captchaToken, clearMsg, confirmPassword, email, password, resetCaptcha, setError, setInfo, startResendCooldown]
  );

  /* ─── VERIFY SIGNUP + CREATE ─── */
  const handleVerifyAndCreate = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (lockRef.current || busy) return;

      if (!otpCode || otpCode.length !== 6) {
        setError('Enter the 6-digit code');
        return;
      }
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        setError('Choose a username');
        return;
      }
      if (!USERNAME_RE.test(trimmedUsername)) {
        setError('Username must be 3-20 characters (letters, numbers, . or _ only)');
        return;
      }

      lockRef.current = true;
      setLoadingAction('verifySignup');
      clearMsg();
      try {
        // Single path: verify OTP + create confirmed user + profile (see authApi)
        const result = await createAccountAfterOtp({
          email,
          password,
          username: trimmedUsername,
          otpCode,
        });
        if (result.needsLogin) {
          setInfo(result.message);
          setOtpCode('');
          setPassword('');
          setMode(AUTH_MODES.LOGIN);
          return;
        }
        setSubmitStatus('success');
        setPassword('');
        window.setTimeout(() => navigate(result.redirectTo || '/'), 700);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingAction(null);
        lockRef.current = false;
      }
    },
    [busy, clearMsg, email, navigate, otpCode, password, setError, setInfo, username]
  );

  /* ─── FORGOT / RESET ─── */
  const handleSendResetOtp = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (lockRef.current || busy) return;
      if (!email.trim()) {
        setError('Enter your email address');
        return;
      }
      if (isCaptchaRequired() && !captchaToken) {
        setError('Please complete the security check.');
        return;
      }
      lockRef.current = true;
      setLoadingAction('sendReset');
      clearMsg();
      try {
        await sendOtp(email, captchaToken);
        setInfo('Code sent to your email.');
        setOtpCode('');
        startResendCooldown();
        resetCaptcha();
        setMode(AUTH_MODES.OTP_RESET);
      } catch (err) {
        setError(err.message);
        resetCaptcha();
      } finally {
        setLoadingAction(null);
        lockRef.current = false;
      }
    },
    [busy, captchaToken, clearMsg, email, resetCaptcha, setError, setInfo, startResendCooldown]
  );

  const handleVerifyResetOtp = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (lockRef.current || busy) return;
      if (!otpCode || otpCode.length !== 6) {
        setError('Enter the 6-digit code');
        return;
      }
      lockRef.current = true;
      setLoadingAction('verifyReset');
      clearMsg();
      try {
        // Peek only — do not consume OTP until password is actually updated
        await verifyOtp({ identifier: email, code: otpCode, consume: false });
        setInfo('Verified! Set your new password.');
        setMode(AUTH_MODES.NEW_PASSWORD);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingAction(null);
        lockRef.current = false;
      }
    },
    [busy, clearMsg, email, otpCode, setError, setInfo]
  );

  // Auto-verify reset OTP when 6 digits entered
  useEffect(() => {
    if (mode === AUTH_MODES.OTP_RESET && otpCode.length === 6 && !loadingAction) {
      handleVerifyResetOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode, mode]);

  const handleSetNewPassword = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (lockRef.current || busy) return;
      if (!newPass || !confirmPass) {
        setError('Fill in both fields');
        return;
      }
      const strongErr = validateStrongPassword(newPass);
      if (strongErr) {
        setError(strongErr);
        return;
      }
      if (newPass !== confirmPass) {
        setError('Passwords do not match');
        return;
      }
      lockRef.current = true;
      setLoadingAction('setPassword');
      clearMsg();
      try {
        // Consumes OTP and updates password in one server step
        await verifyOtp({
          identifier: email,
          code: otpCode,
          newPassword: newPass,
          consume: true,
        });
        setInfo('Password updated! You can now sign in.');
        window.setTimeout(() => {
          clearSecrets();
          setMode(AUTH_MODES.LOGIN);
          clearMsg();
        }, 2000);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingAction(null);
        lockRef.current = false;
      }
    },
    [busy, clearMsg, clearSecrets, confirmPass, email, newPass, otpCode, setError, setInfo]
  );

  const handleResendOtp = useCallback(async () => {
    if (busy || resendCooldown > 0 || !email.trim()) return;
    if (isCaptchaRequired() && !captchaToken) {
      setError('Please complete the security check before resending.');
      return;
    }
    setLoadingAction('resend');
    clearMsg();
    try {
      await sendOtp(email, captchaToken);
      setInfo('A new code has been sent to your email.');
      startResendCooldown();
      resetCaptcha();
    } catch (err) {
      setError(err.message);
      resetCaptcha();
    } finally {
      setLoadingAction(null);
    }
  }, [busy, captchaToken, clearMsg, email, resendCooldown, resetCaptcha, setError, setInfo, startResendCooldown]);

  const clearFieldError = useCallback((field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Only validate non-empty fields on blur — empty fields wait for submit
  const onEmailBlur = useCallback(() => {
    if (!email.trim()) {
      // Clear sticky error when field is empty again
      clearFieldError('email');
      setTouched((t) => {
        if (!t.email) return t;
        const next = { ...t };
        delete next.email;
        return next;
      });
      return;
    }
    setTouched((t) => ({ ...t, email: true }));
    const err = validateEmail(email);
    setFieldErrors((prev) => {
      if (!err) {
        if (!prev.email) return prev;
        const next = { ...prev };
        delete next.email;
        return next;
      }
      return { ...prev, email: err };
    });
  }, [clearFieldError, email]);

  const onPasswordBlur = useCallback(() => {
    if (!password) {
      clearFieldError('password');
      setTouched((t) => {
        if (!t.password) return t;
        const next = { ...t };
        delete next.password;
        return next;
      });
      return;
    }
    setTouched((t) => ({ ...t, password: true }));
    const err = validatePassword(password);
    setFieldErrors((prev) => {
      if (!err) {
        if (!prev.password) return prev;
        const next = { ...prev };
        delete next.password;
        return next;
      }
      return { ...prev, password: err };
    });
  }, [clearFieldError, password]);

  const handleEmailChange = useCallback(
    (e) => {
      const value = e.target.value;
      setEmail(value);
      clearMsg();
      // Live-clear error as soon as user types
      clearFieldError('email');
      if (value.trim() && touched.email) {
        const err = validateEmail(value);
        if (err) setFieldErrors((prev) => ({ ...prev, email: err }));
      }
    },
    [clearFieldError, clearMsg, touched.email]
  );

  const handlePasswordChange = useCallback(
    (e) => {
      const value = e.target.value;
      setPassword(value);
      clearMsg();
      clearFieldError('password');
      if (value && touched.password) {
        const err = validatePassword(value);
        if (err) setFieldErrors((prev) => ({ ...prev, password: err }));
      }
    },
    [clearFieldError, clearMsg, touched.password]
  );

  return {
    mode,
    goTo,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    agreedToTerms,
    setAgreedToTerms,
    rememberMe,
    setRememberMe,
    username,
    setUsername,
    otpCode,
    setOtpCode,
    newPass,
    setNewPass,
    confirmPass,
    setConfirmPass,
    showPassword,
    setShowPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    toggleShowPassword,
    fieldErrors,
    touched,
    loadingAction,
    submitStatus,
    resendCooldown,
    message,
    clearMsg,
    busy,
    captchaToken,
    setCaptchaToken,
    captchaKey,
    resetCaptcha,
    captchaRequired: isCaptchaRequired(),
    emailRef,
    passwordRef,
    usernameRef,
    handlers: {
      handleLogin,
      handleOAuth,
      handleSignUpStart,
      handleVerifyAndCreate,
      handleSendResetOtp,
      handleVerifyResetOtp,
      handleSetNewPassword,
      handleResendOtp,
      handleEmailChange,
      handlePasswordChange,
      onEmailBlur,
      onPasswordBlur,
    },
  };
}
