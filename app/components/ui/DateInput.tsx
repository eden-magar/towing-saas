'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { he } from 'react-day-picker/locale'
import { Calendar } from 'lucide-react'
import 'react-day-picker/style.css'
import {
  dateToYyyyMmDd,
  extractDateDigits,
  extractDateDigitsFromYyyyMmDd,
  formatDateDigitsLive,
  formatTodayYyyyMmDd,
  normalizeDateInput,
  yyyyMmDdToDate,
  yyyyMmDdToDisplay,
} from '../../lib/utils/date-input-normalize'

export interface DateInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  value: string
  onChange: (value: string) => void
  hasError?: boolean
  showToday?: boolean
  todayLabel?: string
  min?: string
  max?: string
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      value,
      onChange,
      hasError: hasErrorProp,
      showToday = false,
      todayLabel = 'היום',
      min,
      max,
      className = '',
      disabled,
      id: idProp,
      placeholder = 'DD/MM/YYYY',
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
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const calendarRef = useRef<HTMLDivElement | null>(null)
    const calendarOpenRef = useRef(false)
    const [focused, setFocused] = useState(false)
    const [draft, setDraft] = useState('')
    const [internalError, setInternalError] = useState(false)
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )

    useEffect(() => {
      setMounted(true)
    }, [])

    const setCalendarOpenState = useCallback((open: boolean) => {
      calendarOpenRef.current = open
      setCalendarOpen(open)
    }, [])

    useEffect(() => {
      if (!focused) setDraft(yyyyMmDdToDisplay(value))
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

    const isWithinBounds = useCallback(
      (yyyyMmDd: string): boolean => {
        if (!yyyyMmDd) return true
        if (min && yyyyMmDd < min) return false
        if (max && yyyyMmDd > max) return false
        return true
      },
      [min, max],
    )

    const applyDigits = useCallback(
      (digits: string) => {
        const display = formatDateDigitsLive(digits)
        setInternalError(false)
        setDraft(display)
        setCaretToEnd()
      },
      [setCaretToEnd],
    )

    const applyFromRaw = useCallback(
      (raw: string) => {
        applyDigits(extractDateDigits(raw))
      },
      [applyDigits],
    )

    const commit = useCallback((): boolean => {
      const result = normalizeDateInput(draft)
      if (!result.ok) {
        setInternalError(true)
        innerRef.current?.focus()
        return false
      }
      if (result.value && !isWithinBounds(result.value)) {
        setInternalError(true)
        innerRef.current?.focus()
        return false
      }
      setInternalError(false)
      if (result.value !== value) onChange(result.value)
      setDraft(result.value ? yyyyMmDdToDisplay(result.value) : '')
      return true
    }, [draft, isWithinBounds, onChange, value])

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (calendarOpenRef.current) return
      if (!commit()) {
        e.preventDefault()
        requestAnimationFrame(() => innerRef.current?.focus())
        return
      }
      setFocused(false)
      onBlur?.(e)
    }

    const removeLastDigit = useCallback(() => {
      const digits = extractDateDigits(draft).slice(0, -1)
      applyDigits(digits)
    }, [applyDigits, draft])

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (commit()) innerRef.current?.blur()
        return
      }

      if (e.key === 'Escape' && calendarOpenRef.current) {
        e.preventDefault()
        setCalendarOpenState(false)
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

    const handleToday = () => {
      const today = formatTodayYyyyMmDd()
      if (!isWithinBounds(today)) {
        setInternalError(true)
        return
      }
      setInternalError(false)
      setDraft(yyyyMmDdToDisplay(today))
      onChange(today)
      innerRef.current?.focus()
      setCaretToEnd()
    }

    const handleCalendarSelect = (date: Date | undefined) => {
      if (!date) return
      const next = dateToYyyyMmDd(date)
      if (!isWithinBounds(next)) {
        setInternalError(true)
        return
      }
      setInternalError(false)
      setDraft(yyyyMmDdToDisplay(next))
      onChange(next)
      setCalendarOpenState(false)
      innerRef.current?.focus()
    }

    const updatePopoverPosition = useCallback(() => {
      const el = wrapperRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const popoverWidth = 280
      let left = rect.left
      if (left + popoverWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - popoverWidth - 8)
      }
      setPopoverPos({ top: rect.bottom + 4, left })
    }, [])

    useLayoutEffect(() => {
      if (!calendarOpen) {
        setPopoverPos(null)
        return
      }
      updatePopoverPosition()
      window.addEventListener('scroll', updatePopoverPosition, true)
      window.addEventListener('resize', updatePopoverPosition)
      return () => {
        window.removeEventListener('scroll', updatePopoverPosition, true)
        window.removeEventListener('resize', updatePopoverPosition)
      }
    }, [calendarOpen, updatePopoverPosition])

    useEffect(() => {
      if (!calendarOpen) return

      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node
        if (wrapperRef.current?.contains(target)) return
        if (calendarRef.current?.contains(target)) return
        setCalendarOpenState(false)
      }

      document.addEventListener('mousedown', handlePointerDown)
      return () => document.removeEventListener('mousedown', handlePointerDown)
    }, [calendarOpen])

    const displayValue = focused ? draft : yyyyMmDdToDisplay(value)

    const selectedDate = yyyyMmDdToDate(value)
    const minDate = min ? yyyyMmDdToDate(min) : undefined
    const maxDate = max ? yyyyMmDdToDate(max) : undefined

    const fieldRow = (
      <div
        ref={wrapperRef}
        className={`flex items-center gap-1 min-w-0 ${showToday ? 'flex-1' : className}`.trim()}
      >
        <input
          ref={setRefs}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => applyFromRaw(e.target.value)}
          onFocus={() => {
            setFocused(true)
            const digits = extractDateDigitsFromYyyyMmDd(value)
            setDraft(digits ? formatDateDigitsLive(digits) : '')
            setCaretToEnd()
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={`
            w-full min-w-0 px-3 py-2 rounded-lg text-sm tabular-nums
            bg-white text-gt-text-primary text-left
            border ${hasError ? 'border-gt-danger ring-1 ring-gt-danger/30' : 'border-gt-border'}
            placeholder:text-gt-text-tertiary
            hover:border-gt-border-strong
            focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15
            disabled:bg-gt-surface-subtle disabled:text-gt-text-tertiary disabled:cursor-not-allowed
            transition-colors duration-150
          `.replace(/\s+/g, ' ').trim()}
          aria-invalid={hasError || undefined}
          {...props}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="פתח לוח שנה"
          aria-expanded={calendarOpen}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (disabled) return
            setCalendarOpenState(!calendarOpenRef.current)
          }}
          className="shrink-0 p-2 rounded-lg border border-gt-border text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Calendar size={16} aria-hidden />
        </button>
      </div>
    )

    const calendarPopover =
      calendarOpen && mounted && popoverPos
        ? createPortal(
            <div
              ref={calendarRef}
              role="dialog"
              aria-label="בחירת תאריך"
              dir="rtl"
              className="fixed z-[9999] rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
              style={{ top: popoverPos.top, left: popoverPos.left }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <DayPicker
                mode="single"
                locale={he}
                dir="rtl"
                weekStartsOn={0}
                selected={selectedDate}
                onSelect={handleCalendarSelect}
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
                defaultMonth={selectedDate ?? new Date()}
                classNames={{
                  root: 'rdp-root text-sm',
                  month_caption: 'font-medium text-gray-800 mb-2 text-center',
                  weekday: 'text-gray-500 text-xs font-normal w-9',
                  day: 'w-9 h-9 rounded-lg text-sm hover:bg-[#33d4ff]/10',
                  day_button: 'w-full h-full rounded-lg',
                  selected: '[&>button]:bg-[#33d4ff] [&>button]:text-white [&>button]:font-medium',
                  today: '[&>button]:ring-1 [&>button]:ring-[#33d4ff]/40',
                  outside: 'text-gray-300',
                  disabled: 'text-gray-300 opacity-50',
                }}
              />
            </div>,
            document.body,
          )
        : null

    if (!showToday) {
      return (
        <>
          {fieldRow}
          {calendarPopover}
        </>
      )
    }

    return (
      <>
        <div className={`flex items-center gap-2 min-w-0 ${className}`.trim()} dir="rtl">
          <button
            type="button"
            disabled={disabled}
            onClick={handleToday}
            className="shrink-0 px-2.5 py-2 rounded-lg text-xs font-medium border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {todayLabel}
          </button>
          {fieldRow}
        </div>
        {calendarPopover}
      </>
    )
  },
)
DateInput.displayName = 'DateInput'
