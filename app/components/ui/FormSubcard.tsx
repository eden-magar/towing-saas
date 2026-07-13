import { ReactNode } from 'react'

interface FormSubcardProps {
  title: ReactNode
  children: ReactNode
  className?: string
  /** Optional controls rendered on the leading side of the header (RTL: left of title). */
  actions?: ReactNode
}

export function FormSubcard({ title, children, className = '', actions }: FormSubcardProps) {
  return (
    <div
      className={`border border-gt-border-subtle rounded-lg overflow-hidden mb-3 last:mb-0 flex flex-col ${className}`}
      dir="rtl"
    >
      <div className="px-3.5 py-2.5 sm:py-2 bg-gt-surface-subtle border-b border-gt-border-subtle flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-gt-text-secondary inline-flex items-center gap-1.5 flex-wrap min-w-0">
          {title}
        </h4>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="p-3.5 sm:p-3 bg-white flex-1 flex flex-col">{children}</div>
    </div>
  )
}
