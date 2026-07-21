/**
 * Presentation-only: marks that the tow price uses the customer price list
 * (price_mode === 'recommended_customer'). No pricing logic.
 */
export function CustomerPriceListBadge({
  customerName,
  className = '',
}: {
  customerName?: string | null
  className?: string
}) {
  const name = customerName?.trim() || ''

  return (
    <span
      className={`inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 ${className}`}
    >
      <span className="shrink-0">מחיר לקוח</span>
      {name ? (
        <span className="min-w-0 truncate text-purple-600/90">מחירון {name}</span>
      ) : null}
    </span>
  )
}
