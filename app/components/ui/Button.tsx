import { forwardRef, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className = '', children, ...props }, ref) => {
    const variants = {
      primary: 'bg-gt-brand text-white border-gt-brand hover:bg-gt-brand-hover hover:border-gt-brand-hover',
      secondary: 'bg-white text-gt-text-secondary border-gt-border-subtle hover:bg-gt-surface-hover hover:border-gt-border',
      ghost: 'bg-transparent text-gt-text-secondary border-transparent hover:bg-gt-surface-hover',
      danger: 'bg-gt-danger text-white border-gt-danger hover:opacity-90'
    }
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-sm',
      xl: 'px-8 py-3 text-base font-semibold'
    }

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-1.5
          font-medium rounded-lg border
          transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]} ${sizes[size]} ${className}
        `.replace(/\s+/g, ' ').trim()}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
