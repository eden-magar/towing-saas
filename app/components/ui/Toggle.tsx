'use client'

import { KeyboardEvent } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  className = '',
}: ToggleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      onChange(!checked)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#33d4ff]/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[#33d4ff] justify-end' : 'bg-gray-200 justify-start'
      } ${className}`}
    >
      <span
        aria-hidden
        className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
      />
    </button>
  )
}

interface ToggleFieldProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function ToggleField({
  label,
  checked,
  onChange,
  disabled = false,
  className = '',
}: ToggleFieldProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${className}`}
      dir="rtl"
    >
      <span className="text-sm text-gray-600 select-none">{label}</span>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  )
}
