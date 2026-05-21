import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface FormCardProps {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function FormCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className = ''
}: FormCardProps) {
  return (
    <section
      className={`bg-white border border-gt-border rounded-xl shadow-sm overflow-hidden mb-3 ${className}`}
      dir="rtl"
    >
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-gt-surface-subtle border-b border-gt-border">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-gt-brand-subtle text-gt-brand-text flex items-center justify-center flex-shrink-0">
            <Icon size={14} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gt-text-primary leading-tight">
            {title}
          </h3>
          {description && (
            <p className="text-[11px] text-gt-text-tertiary mt-0.5">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}
