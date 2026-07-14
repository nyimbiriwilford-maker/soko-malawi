/**
 * Auth form validation helpers — pure functions, no side effects.
 * Never log or store credential values.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_ERROR = 'Please enter a valid email address.';
export const PASSWORD_ERROR = 'Password must contain at least 8 characters.';

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
