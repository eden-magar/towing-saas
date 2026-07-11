/** Customer-portal visibility flags (keys in customers.portal_settings JSONB). */
export const PORTAL_VISIBILITY_FLAGS = [
  'show_photos',
  'show_price',
  'show_driver_info',
  'show_driver_phone',
  'show_status_history',
  'show_vehicles',
  'show_notes',
] as const

export type PortalVisibilityFlag = (typeof PORTAL_VISIBILITY_FLAGS)[number]

export type PortalVisibilityOverrideState = 'default' | 'show' | 'hide'

/** Nullable boolean columns on tows — NULL means inherit customer default. */
export type TowPortalVisibilityOverrides = {
  [K in PortalVisibilityFlag as `${K}_override`]: boolean | null
}

export const PORTAL_VISIBILITY_OVERRIDE_COLUMN: {
  [K in PortalVisibilityFlag]: `${K}_override`
} = {
  show_photos: 'show_photos_override',
  show_price: 'show_price_override',
  show_driver_info: 'show_driver_info_override',
  show_driver_phone: 'show_driver_phone_override',
  show_status_history: 'show_status_history_override',
  show_vehicles: 'show_vehicles_override',
  show_notes: 'show_notes_override',
}

export const PORTAL_VISIBILITY_LABELS: Record<
  PortalVisibilityFlag,
  { label: string; description: string }
> = {
  show_photos: {
    label: 'תמונות',
    description: 'תמונות שצולמו במהלך הגרירה',
  },
  show_price: {
    label: 'מחיר',
    description: 'מחיר הגרירה',
  },
  show_driver_info: {
    label: 'שם נהג',
    description: 'שם הנהג שמבצע את הגרירה',
  },
  show_driver_phone: {
    label: 'טלפון נהג',
    description: 'מספר הטלפון של הנהג',
  },
  show_status_history: {
    label: 'היסטוריית סטטוסים',
    description: 'ציר זמן של שלבי הגרירה',
  },
  show_vehicles: {
    label: 'פרטי רכבים',
    description: 'פרטי הרכבים שנגררו',
  },
  show_notes: {
    label: 'הערות',
    description: 'הערות על הגרירה',
  },
}

/** Customer default is opt-in: visible only when explicitly true. */
export function resolveVisibility(
  customerSetting: boolean | undefined,
  towOverride: boolean | null | undefined,
): boolean {
  if (towOverride !== null && towOverride !== undefined) {
    return towOverride
  }
  return customerSetting === true
}

export type PortalVisibilityTowSource = Partial<TowPortalVisibilityOverrides> & {
  visibility_overrides?: Record<string, boolean> | null
}

/** Read nullable override column for a flag from a tow row. */
export function getTowVisibilityColumnOverride(
  tow: PortalVisibilityTowSource,
  flag: PortalVisibilityFlag,
): boolean | null | undefined {
  return tow[PORTAL_VISIBILITY_OVERRIDE_COLUMN[flag]]
}

/**
 * Full resolution: tow column override → legacy JSONB override → customer default.
 * Legacy JSONB keeps existing overrides working until columns are set.
 * Customer inherit branch is opt-in (must be explicitly true).
 */
export function resolvePortalVisibilityFlag(
  flag: PortalVisibilityFlag,
  portalSettings: Record<string, boolean>,
  tow: PortalVisibilityTowSource,
): boolean {
  const columnOverride = getTowVisibilityColumnOverride(tow, flag)
  if (columnOverride !== null && columnOverride !== undefined) {
    return columnOverride
  }
  const legacyOverride = tow.visibility_overrides?.[flag]
  // Only honor an explicit boolean in legacy JSONB; missing key → customer opt-in default.
  if (legacyOverride === true || legacyOverride === false) {
    return legacyOverride
  }
  return resolveVisibility(portalSettings[flag], null)
}

/** UI state for dispatcher 3-way control (column first, then legacy JSONB). */
export function getPortalVisibilityOverrideState(
  flag: PortalVisibilityFlag,
  tow: PortalVisibilityTowSource,
): PortalVisibilityOverrideState {
  const columnOverride = getTowVisibilityColumnOverride(tow, flag)
  if (columnOverride === true) return 'show'
  if (columnOverride === false) return 'hide'
  const legacyOverride = tow.visibility_overrides?.[flag]
  if (legacyOverride === true) return 'show'
  if (legacyOverride === false) return 'hide'
  return 'default'
}

export function portalVisibilityStateToColumnValue(
  state: PortalVisibilityOverrideState,
): boolean | null {
  if (state === 'default') return null
  return state === 'show'
}

/** Apply an optimistic local patch for dispatcher portal-visibility controls. */
export function applyPortalVisibilityOverrideToTow<T extends PortalVisibilityTowSource>(
  tow: T,
  flag: PortalVisibilityFlag,
  state: PortalVisibilityOverrideState,
): T {
  const column = PORTAL_VISIBILITY_OVERRIDE_COLUMN[flag]
  const next: T = { ...tow, [column]: portalVisibilityStateToColumnValue(state) }
  if (state === 'default' && tow.visibility_overrides?.[flag] !== undefined) {
    const { [flag]: _removed, ...rest } = tow.visibility_overrides
    next.visibility_overrides = Object.keys(rest).length > 0 ? rest : null
  }
  return next
}

/** Server payload for a single portal-visibility override change. */
export function buildPortalVisibilityServerUpdate(
  flag: PortalVisibilityFlag,
  state: PortalVisibilityOverrideState,
  currentVisibilityOverrides: Record<string, boolean> | null | undefined,
): {
  portalVisibilityOverrides: Partial<TowPortalVisibilityOverrides>
  visibilityOverrides?: Record<string, boolean> | null
} {
  const column = PORTAL_VISIBILITY_OVERRIDE_COLUMN[flag]
  const update: {
    portalVisibilityOverrides: Partial<TowPortalVisibilityOverrides>
    visibilityOverrides?: Record<string, boolean> | null
  } = {
    portalVisibilityOverrides: { [column]: portalVisibilityStateToColumnValue(state) },
  }
  if (state === 'default' && currentVisibilityOverrides?.[flag] !== undefined) {
    const { [flag]: _removed, ...rest } = currentVisibilityOverrides
    update.visibilityOverrides = Object.keys(rest).length > 0 ? rest : null
  }
  return update
}
