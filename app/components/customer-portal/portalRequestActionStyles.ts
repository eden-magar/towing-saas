/** Shared portal intake design tokens — keep simple + exchange forms identical. */

/** Soft cool-grey canvas — white cards sit clearly on top without glare. */
export const PORTAL_CANVAS_BG_CLASS = 'bg-gt-portal-canvas'

/** Page shell: compact for one-viewport desktop intake. */
export const PORTAL_PAGE_SHELL_CLASS =
  'w-full max-w-[1480px] mx-auto px-1 sm:px-2 space-y-2.5'

export const PORTAL_PAGE_TITLE_CLASS =
  'text-xl font-semibold tracking-tight text-gt-text-primary leading-tight'

export const PORTAL_PAGE_SUBTITLE_CLASS =
  'text-xs text-gt-text-tertiary mt-0.5 leading-snug'

export const PORTAL_FORM_STACK_CLASS = 'space-y-2.5'

/** Soft status / empty-state surfaces (success, blocked). */
export const PORTAL_STATUS_CARD_CLASS =
  'max-w-lg mx-auto bg-gt-surface rounded-xl shadow-[var(--gt-shadow-sm)] p-8 text-center'

/** Section sub-headings (מוצא / יעד / פרטי רכב / …). */
export const PORTAL_SECTION_LABEL_CLASS =
  'text-[11px] font-medium tracking-wide text-gt-text-tertiary'

/** In-card section breaks — whitespace only. */
export const PORTAL_SECTION_DIVIDER_CLASS = 'pt-2 space-y-2'

/** Textareas matching softened Input borders. */
export const PORTAL_TEXTAREA_CLASS =
  'w-full px-2.5 py-1.5 rounded-lg text-sm bg-white text-gt-text-primary border border-gt-border-field placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 transition-colors duration-150 resize-none'

/** Selected-from-storage callout — tint only. */
export const PORTAL_STORAGE_BANNER_CLASS =
  'rounded-lg bg-gt-brand-subtle/60 px-2.5 py-1.5'

/** Inline form submit error — soft fill. */
export const PORTAL_ERROR_BANNER_CLASS =
  'flex items-start gap-2 p-2 rounded-lg bg-gt-danger-subtle text-sm text-gt-danger'

/**
 * Secondary: מאחסנה — brand-tinted, not filled primary.
 */
export const PORTAL_STORAGE_BUTTON_CLASS =
  'inline-flex items-center gap-1 h-8 px-2 shrink-0 rounded-lg bg-gt-brand-subtle text-gt-brand-text text-xs font-medium hover:bg-gt-brand-subtle/80 transition-colors'

/**
 * Secondary: בחר תקלות — soft danger tint.
 */
export const PORTAL_DEFECTS_TRIGGER_CLASS =
  'relative inline-flex h-8 shrink-0 items-center justify-center px-2 rounded-lg bg-gt-danger-subtle text-gt-danger text-xs font-medium hover:bg-gt-danger-subtle/80 transition-colors'

/** Tertiary segmented control (עכשיו / מועד אחר). */
export const PORTAL_SEGMENT_WRAP_CLASS =
  'grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-gt-surface-subtle/90'

export const PORTAL_SEGMENT_ACTIVE_CLASS =
  'min-h-[30px] rounded-md text-xs font-medium bg-gt-surface text-gt-text-primary shadow-[var(--gt-shadow-xs)] transition-colors'

export const PORTAL_SEGMENT_INACTIVE_CLASS =
  'min-h-[30px] rounded-md text-xs font-medium text-gt-text-secondary hover:text-gt-text-primary transition-colors'

/** Footer on portal canvas — CTA visible without extra card height. */
export const PORTAL_FORM_FOOTER_CLASS =
  'sticky bottom-0 z-20 -mx-1 sm:-mx-2 px-1 sm:px-2 py-2 mt-1 bg-gt-portal-canvas/95 backdrop-blur-sm'

export const PORTAL_FORM_FOOTER_INNER_CLASS =
  'flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2 rounded-lg bg-gt-surface shadow-[var(--gt-shadow-xs)] px-3 py-2'

export const PORTAL_CANCEL_LINK_CLASS =
  'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg text-gt-text-secondary hover:bg-gt-surface-hover hover:text-gt-text-primary px-3 py-2 text-sm transition-colors'

export const PORTAL_SUBMIT_CLASS =
  'min-w-[11rem] px-6 py-2 text-sm font-semibold shadow-[var(--gt-shadow-xs)]'

/** Equal-height column cards — hug content tops for denser viewport fit. */
export const PORTAL_COLUMN_CARD_CLASS = 'mb-0 w-full self-start'

/** Shared multi-column gap on intake grids. */
export const PORTAL_GRID_GAP_CLASS = 'gap-3'
