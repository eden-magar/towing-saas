import { ReactNode } from 'react'

interface FormSubcardProps {
  title: string
  children: ReactNode
  className?: string
}

export function FormSubcard({ title, children, className = '' }: FormSubcardProps) {
  return (
    <div
      className={`border border-gt-border-subtle rounded-lg overflow-hidden mb-3 last:mb-0 ${className}`}
      dir="rtl"
    >
      <div className="px-3.5 py-2.5 bg-gt-surface-subtle border-b border-gt-border-subtle">
        <h4 className="text-xs font-semibold text-gt-text-secondary">{title}</h4>
      </div>
      <div className="p-3.5 bg-white">{children}</div>
    </div>
  )
}
