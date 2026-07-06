import { ReactNode } from 'react'

interface FormSubcardProps {
  title: ReactNode
  children: ReactNode
  className?: string
}

export function FormSubcard({ title, children, className = '' }: FormSubcardProps) {
  return (
    <div
      className={`border border-gt-border-subtle rounded-lg overflow-hidden mb-3 last:mb-0 ${className}`}
      dir="rtl"
    >
      <div className="px-3.5 py-2.5 sm:py-2 bg-gt-surface-subtle border-b border-gt-border-subtle">
        <h4 className="text-xs font-semibold text-gt-text-secondary inline-flex items-center gap-1.5 flex-wrap">
          {title}
        </h4>
      </div>
      <div className="p-3.5 sm:p-3 bg-white">{children}</div>
    </div>
  )
}
