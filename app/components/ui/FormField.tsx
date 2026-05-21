import { ReactNode } from 'react'

interface FormFieldProps {
  label?: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className = ''
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-gt-text-secondary">
          {label}
          {required && <span className="text-gt-danger mr-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-[11px] text-gt-text-tertiary">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-gt-danger">{error}</p>
      )}
    </div>
  )
}
