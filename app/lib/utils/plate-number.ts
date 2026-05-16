/**
 * Strips all non-digit characters from a license plate string.
 * Used to normalize plate input so that "12-345-67" → "1234567".
 * Returns an empty string if input is falsy.
 */
export function normalizePlate(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}
