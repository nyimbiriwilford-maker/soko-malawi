/**
 * Auth form validation helpers — pure functions, no side effects.
 * Never log or store credential values.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_ERROR = 'Please enter a valid email address.';
export const PASSWORD_ERROR = 'Password must contain at least 8 characters.';
export const PASSWORD_STRONG_ERROR =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.';
export const PASSWORD_MISMATCH_ERROR = 'Passwords do not match.';

const PASSWORD_STRONG_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * @param {string} value
 * @returns {string|null} Error message or null if valid
 */
export function validateEmail(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed || !EMAIL_RE.test(trimmed)) return EMAIL_ERROR;
  return null;
}

/**
 * @param {string} value
 * @param {{ minLength?: number }} [options]
 * @returns {string|null}
 */
export function validatePassword(value, { minLength = 8, maxLength = 128 } = {}) {
  if (!value || value.length < minLength) return PASSWORD_ERROR;
  if (value.length > maxLength) return 'Password is too long.';
  return null;
}

/**
 * Enforce a strong password: 8+ chars with uppercase, lowercase, number and special char.
 * @param {string} value
 * @param {{ maxLength?: number }} [options]
 * @returns {string|null}
 */
export function validateStrongPassword(value, { maxLength = 128 } = {}) {
  if (!value || !PASSWORD_STRONG_RE.test(value)) return PASSWORD_STRONG_ERROR;
  if (value.length > maxLength) return 'Password is too long.';
  return null;
}

/**
 * @param {string} value
 * @param {string} match
 * @returns {string|null}
 */
export function validatePasswordMatch(value, match) {
  if (!value || value !== match) return PASSWORD_MISMATCH_ERROR;
  return null;
}

/**
 * @param {{ email: string, password: string }} values
 * @returns {{ email?: string, password?: string }}
 */
export function validateLoginForm(values) {
  const errors = {};
  const emailError = validateEmail(values.email);
  const passwordError = validatePassword(values.password);
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  return errors;
}

/**
 * @param {Record<string, string|undefined>} errors
 * @returns {boolean}
 */
export function hasErrors(errors) {
  return Object.keys(errors).some((key) => Boolean(errors[key]));
}

/**
 * Real-time password strength analysis.
 * Returns a score (0-4), a label, and per-criterion met flags so the UI
 * can render a live strength meter / checklist as the user types.
 * @param {string} value
 * @returns {{ score: number, label: 'Weak'|'Fair'|'Good'|'Strong', criteria: { length: boolean, uppercase: boolean, lowercase: boolean, number: boolean, special: boolean } }}
 */
export function getPasswordStrength(value = '') {
  const criteria = {
    length: value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /\d/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };

  const met = Object.values(criteria).filter(Boolean).length;

  let score;
  let label;
  if (!value || met === 0) {
    score = 0;
    label = 'Weak';
  } else if (met <= 2) {
    score = 1;
    label = 'Weak';
  } else if (met === 3) {
    score = 2;
    label = 'Fair';
  } else if (met === 4) {
    score = 3;
    label = 'Good';
  } else {
    score = 4;
    label = 'Strong';
  }

  return { score, label, criteria };
}
