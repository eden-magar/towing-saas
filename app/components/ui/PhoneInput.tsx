'use client'

import {
  forwardRef,
  type ChangeEvent,
  type ClipboardEvent,
  type InputHTMLAttributes,
} from 'react'
import { sanitizePhoneInput } from '@/app/lib/utils/phone'

export interface PhoneInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type' | 'inputMode' | 'dir' | 'placeholder' | 'defaultValue'
  > {
  value: string
  /** Called with a sanitized local-format string (digits only, max 10). */
  onChange: (value: string) => void
  placeholder?: string
  dir?: string
}

const baseClassName = `
  w-full px-3 py-2 rounded-lg text-sm
  bg-white text-gt-text-primary
  border border-gt-border-field
  placeholder:text-gt-text-tertiary
  hover:border-gt-border
  focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20
  disabled:bg-gt-surface-subtle disabled:text-gt-text-tertiary disabled:cursor-not-allowed
  transition-colors duration-150
`.replace(/\s+/g, ' ').trim()

/**
 * Controlled Israeli phone field; parent state stays sanitized via {@link sanitizePhoneInput}.
 * @example
 * <PhoneInput value={phone} onChange={setPhone} placeholder="טלפון" />
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      placeholder = '050-1234567',
      disabled,
      className = '',
      dir = 'ltr',
      id,
      name,
      required,
      ...rest
    },
    ref
  ) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange(sanitizePhoneInput(e.target.value))
    }

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text')
      onChange(sanitizePhoneInput(text))
    }

    return (
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        dir={dir}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        className={`${baseClassName} ${className}`.trim()}
        {...rest}
      />
    )
  }
)
PhoneInput.displayName = 'PhoneInput'
