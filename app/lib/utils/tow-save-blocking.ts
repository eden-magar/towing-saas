/**
 * Save-blocking validation messages for the tow create/edit form.
 * UI modals and useTowSave/quote-save must use these exact strings.
 */
import { CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE } from './tow-save-handler'

export const REQUIRED_TRUCK_TYPE_MESSAGE = 'יש לבחור סוג גרר נדרש'

export const MISSING_ROUTE_ADDRESSES_MESSAGE = 'יש להזין כתובת מוצא ויעד לגרירה'

export const MISSING_STORAGE_PLATE_MESSAGE =
  'יש להזין מספר לוחית לרכב המיועד לאחסנה'

/** Exchange: dispatcher chose storage for defective dropoff but left destination empty. */
export const MISSING_STORAGE_DESTINATION_MESSAGE =
  'נבחרה אחסנה ליעד הרכב התקול — יש להזין כתובת יעד'

/**
 * Address text without lat/lng — Distance Matrix would fall back to ambiguous
 * string match. Escape hatch: Places pick, pin drop, or Maps/Waze link paste.
 */
export const MISSING_ADDRESS_COORDINATES_MESSAGE =
  'לא ניתן לשמור כתובת ללא מיקום מדויק. בחרו כתובת מההצעות, סמנו סיכה על המפה, או הדביקו קישור מגוגל מפות / Waze'

export const STORAGE_FOLLOW_UP_LIVE_BLOCK_MESSAGE =
  'גרירת ההמשך כבר שובצה — כדי לבטלה, פתח אותה ישירות'

const SAVE_BLOCKING_MESSAGES = new Set<string>([
  REQUIRED_TRUCK_TYPE_MESSAGE,
  MISSING_ROUTE_ADDRESSES_MESSAGE,
  MISSING_STORAGE_PLATE_MESSAGE,
  MISSING_STORAGE_DESTINATION_MESSAGE,
  MISSING_ADDRESS_COORDINATES_MESSAGE,
  CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE,
  STORAGE_FOLLOW_UP_LIVE_BLOCK_MESSAGE,
])

export function isRequiredTruckTypeError(message: string | null | undefined): boolean {
  return message === REQUIRED_TRUCK_TYPE_MESSAGE
}

export function isMissingAddressCoordinatesError(
  message: string | null | undefined,
): boolean {
  return message === MISSING_ADDRESS_COORDINATES_MESSAGE
}

/** Blocking validation that prevents save — show as modal, not top strip. */
export function isSaveBlockingValidationError(
  message: string | null | undefined,
): boolean {
  return !!message && SAVE_BLOCKING_MESSAGES.has(message)
}

export { CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE }
