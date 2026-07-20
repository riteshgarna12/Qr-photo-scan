/**
 * Input validation & sanitization utilities.
 * All user-facing input should pass through these helpers
 * before being persisted or used in logic.
 */

// ─── Sanitization ──────────────────────────────────────────────────

/** Trim whitespace, strip HTML tags, and enforce a max length. */
export function sanitizeString(input: unknown, maxLength = 255): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/<[^>]*>/g, '')   // strip HTML tags
    .replace(/&[a-z]+;/gi, '') // strip HTML entities like &lt;
    .substring(0, maxLength);
}

/** Sanitize an event name (alphanumeric, spaces, basic punctuation). */
export function sanitizeEventName(input: unknown): string {
  const cleaned = sanitizeString(input, 100);
  // Allow letters, digits, spaces, hyphens, apostrophes, periods, commas
  return cleaned.replace(/[^\w\s\-'.,!&()]/g, '').trim();
}

/** Sanitize a slug — only lowercase letters, digits, and hyphens. */
export function sanitizeSlug(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 80);
}

/** Normalise an email address — trim, lowercase. */
export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().toLowerCase().substring(0, 254);
}

// ─── Validation ─────────────────────────────────────────────────────

/** RFC-style email validation (good enough for 99 % of real addresses). */
export function isValidEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email) && email.length <= 254;
}

/**
 * Password strength check.
 * Rules: >= 8 chars, at least 1 uppercase, 1 lowercase, 1 digit.
 */
export function isStrongPassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) return { valid: false, reason: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, reason: 'Password must include at least one uppercase letter' };
  if (!/[a-z]/.test(password)) return { valid: false, reason: 'Password must include at least one lowercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, reason: 'Password must include at least one digit' };
  return { valid: true };
}

/** Check whether a string looks like a valid UUID v4. */
export function isValidUUID(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}
