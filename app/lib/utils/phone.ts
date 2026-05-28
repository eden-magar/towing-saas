/**
 * Keeps digits only, maps leading 972 to 0, caps at 10 digits.
 * Used for live typing and paste so stored values stay in local format.
 * @example sanitizePhoneInput("972-50-123-4567") → "0501234567"
 */
export function sanitizePhoneInput(raw: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = '0' + digits.slice(3);
  }
  return digits.slice(0, 10);
}

/**
 * Canonical phone value for persistence (same rules as {@link sanitizePhoneInput}).
 * @example normalizePhone("050-123-4567") → "0501234567"
 */
export function normalizePhone(raw: string): string {
  return sanitizePhoneInput(raw);
}

/**
 * Converts a stored local (or digit) number to WhatsApp international format.
 * @example toWhatsApp("0501234567") → "+972501234567"
 */
export function toWhatsApp(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `+972${digits.slice(1)}`;
  }
  if (digits.startsWith('972')) {
    return `+${digits}`;
  }
  return `+972${digits}`;
}
