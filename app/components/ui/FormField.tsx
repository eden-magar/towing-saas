import { ReactNode } from 'react'

interface FormFieldProps {
  label?: string
  required?: boolean
  /** When true, shows a muted “(אופציונלי)” — preferred over red asterisks. */
  optional?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function FormField({
  label,
  required: _required = false,
  optional,
  hint,
  error,
  children,
  className = ''
}: FormFieldProps) {
  void _required
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-gt-text-secondary">
          {label}
          {optional && (
            <span className="mr-1 text-gt-text-muted font-normal">(אופציונלי)</span>
          )}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-[11px] text-gt-text-tertiary leading-snug">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-gt-danger leading-snug">{error}</p>
      )}
    </div>
  )
}
