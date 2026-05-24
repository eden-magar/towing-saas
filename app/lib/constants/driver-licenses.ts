export const LICENSE_CATEGORIES = [
  { code: '1', name: 'טרקטור' },
  { code: 'A2', name: 'אופנוע עד 14.916 כ"ס' },
  { code: 'A1', name: 'אופנוע עד 47.46 כ"ס' },
  { code: 'A', name: 'אופנוע מעל 47.46 כ"ס' },
  { code: 'B', name: 'רכב פרטי (עד 3,500 ק"ג)' },
  { code: 'C1', name: 'משא קל (עד 12,000 ק"ג)' },
  { code: 'C', name: 'משא כבד (מעל 12,000 ק"ג)' },
  { code: 'D', name: 'אוטובוס' },
  { code: 'D1', name: 'מונית' },
  { code: 'D2', name: 'אוטובוס זעיר ציבורי' },
  { code: 'D3', name: 'אוטובוס זעיר פרטי' },
  { code: 'C+E', name: 'גרור תומך' },
] as const

export const LICENSE_PERMITS = [
  { code: '101', name: 'רכב לכיבוי שריפות' },
  { code: '102', name: 'אמבולנס (עד 4,000 ק"ג)' },
  { code: '103', name: 'רכב גרירה וחילוץ' },
  { code: '109', name: 'נהיגת כלי רכב לצורך בדיקה' },
  { code: '117', name: 'אופנוע להגשת עזרה ראשונה' },
  { code: '124', name: 'אוטובוס לצורך חניה' },
  { code: '125', name: 'מכונה ניידת אופנית' },
  { code: '129', name: 'מלגזה (עד 20,000 ק"ג)' },
  { code: '130', name: 'מלגזה' },
] as const

export type LicenseCategoryCode = (typeof LICENSE_CATEGORIES)[number]['code']
export type LicensePermitCode = (typeof LICENSE_PERMITS)[number]['code']

export function formatLicenseLabel(code: string, name: string): string {
  return `${code} - ${name}`
}

/** Display categories for list/cards; falls back to legacy license_type. */
export function getDriverLicenseCategoriesDisplay(
  categories: string[] | null | undefined,
  legacyLicenseType?: string | null
): string {
  const codes =
    categories && categories.length > 0
      ? categories
      : legacyLicenseType
        ? [legacyLicenseType]
        : []
  if (codes.length === 0) return '---'
  return codes.join(', ')
}

export function toggleLicenseCode(list: string[], code: string): string[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code]
}
