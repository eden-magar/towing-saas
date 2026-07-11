import { forwardRef, InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          w-full px-3 py-2 rounded-lg text-sm
          bg-white text-gt-text-primary
          border ${hasError ? 'border-gt-danger/60' : 'border-gt-border-field'}
          placeholder:text-gt-text-tertiary
          hover:border-gt-border
          focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20
          disabled:bg-gt-surface-subtle disabled:text-gt-text-tertiary disabled:cursor-not-allowed
          transition-colors duration-150
          text-right
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
