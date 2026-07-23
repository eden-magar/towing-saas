/**
 * Map stored cancellation_reason values to customer-safe portal copy.
 * Unrecognized / empty values return null (do not fall through to raw text).
 */
const CUSTOMER_FACING_CANCELLATION_REASONS: Record<string, string> = {
  'ביטול על ידי הלקוח': 'ביטול על ידי הלקוח',
  'לקוח סירב להצעה': 'לקוח סירב להצעה',
  'סיבה אחרת': 'סיבה אחרת',
  'לא קיבלתי תשובה': 'לא הושלמה יצירת קשר',
  'ביטול גרירה מקושרת': 'בוטל על ידי חברת הגרירה',
  'בוטל מעריכת גרירת אב': 'בוטל על ידי חברת הגרירה',
}

export function getCustomerFacingCancellationReason(
  reason: string | null | undefined
): string | null {
  const key = reason?.trim()
  if (!key) return null
  return CUSTOMER_FACING_CANCELLATION_REASONS[key] ?? null
}
