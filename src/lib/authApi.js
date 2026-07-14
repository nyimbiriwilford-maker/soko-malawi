/**
 * SokoMw auth API — Supabase + OTP edge functions.
 * Security: allowlists, sanitized errors, no credential logging.
 */
import { supabase } from './supabase';
import { validateEmail, validatePassword } from '../utils/validation';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Only these edge functions may be invoked from the client. */
const ALLOWED_EDGE_FUNCTIONS = new Set(['send-otp', 'verify-otp']);

/** Only these OAuth providers are permitted. */
const ALLOWED_OAUTH_PROVIDERS = new Set(['google', 'facebook']);

/**
 * Allowed app origins for OAuth redirect (prevents open redirects).
 * Production + local dev.
 */
const ALLOWED_ORIGINS = new Set([
  'https://soko-malawi.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]);

export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;

export const DISABLED_MESSAGE = `Thank you for being one of our early testers. Your feedback has been incredibly valuable to us.\n\nWe are currently working on significant improvements to SokoMW based on what you and other testers shared with us. As a result, access has been temporarily paused while we build these new features.\n\nWe will notify you as soon as the updated version is ready — we think you'll love what's coming. Thank you for your patience and continued support.`;

/**
 * Safe OAuth / email redirect URL for the current environment.
 */
export function getAuthRedirectUrl() {
  if (typeof window === 'undefined') {
    return 'https://soko-malawi.vercel.app/auth/callback';
  }
  const origin = window.location.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    return `${origin}/auth/callback`;
  }
  // Fail closed to production callback — never redirect to an unknown origin
  return 'https://soko-malawi.vercel.app/auth/callback';
}

/** @deprecated use getAuthRedirectUrl() */
export const REDIRECT_URL = 'https://soko-malawi.vercel.app/auth/callback';

/**
 * Map raw provider/network errors to safe user-facing messages.
 * Avoids leaking whether an email exists, stack traces, or internal codes.
 */
export function sanitizeAuthError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const raw = typeof err === 'string' ? err : err.message || '';
  const lower = raw.toLowerCase();

  if (err.code === 'ACCOUNT_DISABLED' || err.isInfo) {
    return raw || DISABLED_MESSAGE;
  }
  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
    return 'Please verify your email before signing in.';
  }
  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('email/password')
  ) {
    return 'Invalid email or password.';
  }
  if (lower.includes('rate') || lower.includes('too many') || lower.includes('429')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (lower.includes('invalid or expired') || lower.includes('verification code')) {
    return 'Invalid or expired code. Please request a new one.';
  }
  if (lower.includes('password') && lower.includes('character')) {
    return 'Password must be at least 8 characters.';
  }
  // Never surface raw Supabase/edge internals
  if (
    lower.includes('jwt') ||
    lower.includes('permission') ||
    lower.includes('row-level') ||
    lower.includes('service role') ||
    lower.includes('supabase') ||
    lower.includes('postgres') ||
    lower.includes('stack')
  ) {
    return fallback;
  }
  // Allow short, already-safe product messages
  if (raw.length > 0 && raw.length < 160 && !lower.includes('error:')) {
    return raw;
  }
  return fallback;
}

/**
 * Call a Supabase Edge Function (allowlisted only).
 */
export async function callEdgeFunction(name, body) {
  if (!ALLOWED_EDGE_FUNCTIONS.has(name)) {
    throw new Error('Invalid request.');
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Authentication is temporarily unavailable. Please try again later.');
  }

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error('Unexpected response from the server. Please try again.');
  }

  if (!res.ok || data?.error) {
    throw new Error(sanitizeAuthError(data?.error, 'Something went wrong. Please try again.'));
  }
  return data;
}

/**
 * Email/password sign-in with profile checks (disabled, admin role).
 * Login only requires a non-empty password (existing accounts may predate min-length rules).
 * @returns {{ redirectTo: string }}
 */
export async function signInWithEmailPassword(email, password) {
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (validateEmail(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password) {
    throw new Error('Enter your email and password.');
  }

  const { data, error: signInErr } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (signInErr) {
    throw new Error(sanitizeAuthError(signInErr, 'Invalid email or password.'));
  }

  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    throw new Error('Please verify your email before signing in.');
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, is_disabled')
    .eq('id', data.user.id)
    .single();

  // Fail closed
  if (profileErr) {
    await supabase.auth.signOut();
    throw new Error('Could not verify your account right now. Please try again.');
  }

  if (profile?.is_disabled) {
    await supabase.auth.signOut();
    const err = new Error(DISABLED_MESSAGE);
    err.code = 'ACCOUNT_DISABLED';
    err.isInfo = true;
    throw err;
  }

  // Only allow known safe paths
  const redirectTo = profile?.role === 'admin' ? '/admin' : '/';

  return { redirectTo, userId: data.user.id };
}

/**
 * Google / Facebook OAuth. Browser navigates away on success.
 */
export async function signInWithOAuth(provider) {
  const p = String(provider || '').toLowerCase();
  if (!ALLOWED_OAUTH_PROVIDERS.has(p)) {
    throw new Error('This sign-in method is not available.');
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: p,
    options: {
      redirectTo: getAuthRedirectUrl(),
      // Skip browser prompt when already consented (still PKCE under the hood)
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw new Error(sanitizeAuthError(error));
}

/** Captcha required only when a production site key is configured. */
export function isCaptchaRequired() {
  return Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
}

/**
 * Start signup / reset — send email OTP.
 * @param {string} identifier
 * @param {string} [captchaToken] Cloudflare Turnstile token (required in production)
 */
export async function sendOtp(identifier, captchaToken = '') {
  const id = (identifier ?? '').trim().toLowerCase();
  if (validateEmail(id)) {
    throw new Error('Please enter a valid email address.');
  }
  if (isCaptchaRequired() && !captchaToken) {
    throw new Error('Please complete the security check.');
  }
  return callEdgeFunction('send-otp', {
    identifier: id,
    captchaToken: captchaToken || '',
  });
}

/**
 * Verify OTP.
 * @param {{ identifier: string, code: string, newPassword?: string, consume?: boolean }} opts
 */
export async function verifyOtp({ identifier, code, newPassword, consume = true }) {
  const id = (identifier ?? '').trim().toLowerCase();
  const cleanCode = String(code ?? '').replace(/\D/g, '');

  if (validateEmail(id)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Enter the 6-digit code.');
  }
  if (newPassword != null && validatePassword(newPassword)) {
    throw new Error('Password must be at least 8 characters.');
  }

  const body = {
    identifier: id,
    code: cleanCode,
    consume: Boolean(consume),
  };
  if (newPassword) body.newPassword = newPassword;

  return callEdgeFunction('verify-otp', body);
}

/**
 * After user enters OTP + username: verify OTP server-side, create confirmed
 * auth user (service role), then sign in and upsert profile rows.
 * Matches provided Login logic while surviving Supabase "Confirm email" settings.
 *
 * @returns {{ redirectTo: string } | { needsLogin: true, message: string }}
 */
export async function createAccountAfterOtp({ email, password, username, otpCode }) {
  const cleanEmail = (email ?? '').trim().toLowerCase();
  const trimmedUsername = (username ?? '').trim();
  const code = String(otpCode ?? '').replace(/\D/g, '');

  if (validateEmail(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (validatePassword(password)) {
    throw new Error('Password must be at least 8 characters.');
  }
  if (!USERNAME_RE.test(trimmedUsername)) {
    throw new Error('Username must be 3-20 characters (letters, numbers, . or _ only)');
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Enter the 6-digit code.');
  }

  // 1) Verify OTP + create email-confirmed user (edge / service role)
  let edgeCreated = false;
  try {
    await callEdgeFunction('verify-otp', {
      identifier: cleanEmail,
      code,
      action: 'signup',
      password,
      username: trimmedUsername,
    });
    edgeCreated = true;
  } catch (err) {
    // If user already exists, continue to sign-in / classic signUp below
    const msg = (err?.message || '').toLowerCase();
    if (!msg.includes('already') && !msg.includes('registered') && !msg.includes('exists')) {
      // Still try classic path if edge function missing/old
      if (!msg.includes('invalid request') && !msg.includes('method')) {
        // rethrow real OTP failures
        if (msg.includes('invalid') || msg.includes('expired') || msg.includes('code')) {
          throw err;
        }
      }
    }
  }

  // 2) Classic client signUp if edge path did not create the user
  if (!edgeCreated) {
    // Verify OTP alone first (original flow)
    await verifyOtp({ identifier: cleanEmail, code, consume: true });

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: trimmedUsername },
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (signUpErr) {
      throw new Error(sanitizeAuthError(signUpErr, 'Could not create account. Please try again.'));
    }
    if (signUpData?.session?.user) {
      await upsertProfileAndUser(signUpData.session.user.id, trimmedUsername, cleanEmail);
      return { redirectTo: '/' };
    }
  }

  // 3) Sign in
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (signInErr || !signInData?.user) {
    return {
      needsLogin: true,
      message: 'Account created! Sign in with your new password to continue.',
    };
  }

  await upsertProfileAndUser(signInData.user.id, trimmedUsername, cleanEmail);
  return { redirectTo: '/' };
}

async function upsertProfileAndUser(userId, fullName, email) {
  const [{ error: profileErr }, { error: userErr }] = await Promise.all([
    supabase.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      email,
      updated_at: new Date().toISOString(),
    }),
    supabase.from('users').upsert(
      { id: userId, name: fullName },
      { onConflict: 'id' }
    ),
  ]);

  if (profileErr || userErr) {
    throw new Error(
      'Account created, but we could not finish setting up your profile. Please sign in again to retry.'
    );
  }
}
