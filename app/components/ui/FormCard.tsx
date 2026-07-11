import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface FormCardProps {
  icon?: LucideIcon
  title: string
  description?: string
  /** Quiet step cue for workflow hierarchy (e.g. 1, 2, 3). */
  step?: number | string
  /** Compact padding for dense desktop intake (portal forms). */
  density?: 'default' | 'compact'
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function FormCard({
  icon: Icon,
  title,
  description,
  step,
  density = 'default',
  actions,
  children,
  className = ''
}: FormCardProps) {
  const compact = density === 'compact'

  return (
    <section
      className={`flex flex-col bg-gt-surface rounded-xl shadow-[var(--gt-shadow-sm)] overflow-hidden mb-3 ${className}`}
      dir="rtl"
    >
      <div
        className={
          compact
            ? 'flex shrink-0 items-start gap-2 px-3.5 pt-2.5 pb-0.5'
            : 'flex shrink-0 items-start gap-2.5 px-5 pt-5 pb-1'
        }
      >
        {step != null && (
          <span
            className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gt-surface-subtle px-1.5 text-[11px] font-semibold tabular-nums text-gt-text-secondary"
            aria-hidden
          >
            {step}
          </span>
        )}
        {Icon && (
          <Icon
            size={compact ? 14 : 16}
            className="mt-0.5 text-gt-text-tertiary flex-shrink-0"
            strokeWidth={1.75}
          />
        )}
        <div className="flex-1 min-w-0">
          <h3
            className={
              compact
                ? 'text-sm font-semibold text-gt-text-primary leading-snug tracking-tight'
                : 'text-base font-semibold text-gt-text-primary leading-snug tracking-tight'
            }
          >
            {title}
          </h3>
          {description && !compact && (
            <p className="text-xs text-gt-text-tertiary mt-1 leading-relaxed">
              {description}
            </p>
          )}
          {description && compact && (
            <p className="text-[11px] text-gt-text-tertiary mt-0.5 leading-snug line-clamp-1">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      <div
        className={
          compact
            ? 'flex-1 min-h-0 px-3.5 pt-2 pb-3'
            : 'flex-1 min-h-0 px-5 pt-3 pb-5'
        }
      >
        {children}
      </div>
    </section>
  )
}
