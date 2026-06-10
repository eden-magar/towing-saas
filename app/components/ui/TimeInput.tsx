'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react'
import {
  extractTimeDigits,
  formatNowTimeHHmm,
  formatTimeDigitsLive,
  normalizeTimeInput,
} from '../../lib/utils/time-input-normalize'

export interface TimeInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  onChange: (value: string) => void
  hasError?: boolean
  showNow?: boolean
  nowLabel?: string
}

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(
  (
    {
      value,
      onChange,
      hasError: hasErrorProp,
      showNow = false,
      nowLabel = 'עכשיו',
      className = '',
      disabled,
      id: idProp,
      placeholder = 'HH:mm',
      onBlur,
      onKeyDown,
      onPaste,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const innerRef = useRef<HTMLInputElement | null>(null)
    const [focused, setFocused] = useState(false)
    const [draft, setDraft] = useState(value)
    const [internalError, setInternalError] = useState(false)

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )

    useEffect(() => {
      if (!focused) setDraft(value)
    }, [value, focused])

    const hasError = hasErrorProp || internalError

    const setCaretToEnd = useCallback(() => {
      requestAnimationFrame(() => {
        const el = innerRef.current
        if (!el) return
        const len = el.value.length
        el.setSelectionRange(len, len)
      })
    }, [])

    const applyDigits = useCallback(
      (digits: string) => {
        const display = formatTimeDigitsLive(digits)
        setInternalError(false)
        setDraft(display)
        setCaretToEnd()
      },
      [setCaretToEnd],
    )

    const applyFromRaw = useCallback(
      (raw: string) => {
        applyDigits(extractTimeDigits(raw))
      },
      [applyDigits],
    )

    const commit = useCallback((): boolean => {
      const result = normalizeTimeInput(draft)
      if (!result.ok) {
        setInternalError(true)
        innerRef.current?.focus()
        return false
      }
      setInternalError(false)
      if (result.value !== value) onChange(result.value)
      setDraft(result.value)
      return true
    }, [draft, onChange, value])

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (!commit()) {
        e.preventDefault()
        requestAnimationFrame(() => innerRef.current?.focus())
        return
      }
      setFocused(false)
      onBlur?.(e)
    }

    const removeLastDigit = useCallback(() => {
      const digits = extractTimeDigits(draft).slice(0, -1)
      applyDigits(digits)
    }, [applyDigits, draft])

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (commit()) innerRef.current?.blur()
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        removeLastDigit()
        return
      }

      onKeyDown?.(e)
    }

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      applyFromRaw(e.clipboardData.getData('text'))
      onPaste?.(e)
    }

    const handleNow = () => {
      const now = formatNowTimeHHmm()
      setInternalError(false)
      setDraft(now)
      onChange(now)
      innerRef.current?.focus()
      setCaretToEnd()
    }

    const field = (
      <input
        ref={setRefs}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        disabled={disabled}
        placeholder={placeholder}
        value={focused ? draft : value}
        onChange={(e) => applyFromRaw(e.target.value)}
        onFocus={() => {
          setFocused(true)
          const digits = extractTimeDigits(value)
          setDraft(digits ? formatTimeDigitsLive(digits) : '')
          setCaretToEnd()
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`
          w-full px-3 py-2 rounded-lg text-sm tabular-nums
          bg-white text-gt-text-primary text-left
          border ${hasError ? 'border-gt-danger ring-1 ring-gt-danger/30' : 'border-gt-border'}
          placeholder:text-gt-text-tertiary
          hover:border-gt-border-strong
          focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15
          disabled:bg-gt-surface-subtle disabled:text-gt-text-tertiary disabled:cursor-not-allowed
          transition-colors duration-150
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        aria-invalid={hasError || undefined}
        {...props}
      />
    )

    if (!showNow) return field

    return (
      <div className="flex items-center gap-2 min-w-0" dir="rtl">
        <button
          type="button"
          disabled={disabled}
          onClick={handleNow}
          className="shrink-0 px-2.5 py-2 rounded-lg text-xs font-medium border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {nowLabel}
        </button>
        <div className="flex-1 min-w-0">{field}</div>
      </div>
    )
  },
)
TimeInput.displayName = 'TimeInput'
