'use client'

import { useMemo, useState } from 'react'
import { Check, Lock, Plus, Search } from 'lucide-react'
import type { LocationSurcharge, ServiceSurcharge } from '../../../lib/queries/price-lists'
import {
  newManualSurchargeId,
  sanitizeManualSurcharges,
  type ManualSurcharge,
} from '../../../lib/utils/manual-surcharge'
import { SelectorModalShell } from './SelectorModalShell'
import type { SelectedService } from './ServiceSurchargeSelector'

const HEBREW_SORT = 'he' as const

function serviceLabelSortKey(label: string): string {
  return label
    .normalize('NFKC')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
}

function compareServiceLabels(a: ServiceSurcharge, b: ServiceSurcharge): number {
  return serviceLabelSortKey(a.label).localeCompare(
    serviceLabelSortKey(b.label),
    HEBREW_SORT,
    { numeric: true, sensitivity: 'base' },
  )
}

/** Display-only amount for a selected catalog service (matches existing selector math). */
export function selectedServiceDisplayAmount(
  service: ServiceSurcharge,
  selected: SelectedService,
): number {
  if (service.price_type === 'manual') return Math.max(0, selected.manualPrice || 0)
  if (service.price_type === 'per_unit') {
    return service.price * Math.max(1, selected.quantity || 1)
  }
  return service.price
}

function servicePriceLabel(
  service: ServiceSurcharge,
  selected?: SelectedService,
): string {
  if (service.price_type === 'manual') {
    if (selected?.manualPrice) return `₪${Number(selected.manualPrice).toFixed(2)}`
    return 'להזנה'
  }
  if (service.price_type === 'per_unit' && selected) {
    return `₪${(service.price * (selected.quantity || 1)).toFixed(2)}`
  }
  return `₪${Number(service.price).toFixed(2)}`
}

export interface SurchargesSectionProps {
  locationSurchargesData?: LocationSurcharge[]
  selectedLocationSurcharges?: string[]
  onLocationSurchargesChange?: (ids: string[]) => void
  services: ServiceSurcharge[]
  selectedServices: SelectedService[]
  onSelectedServicesChange: (services: SelectedService[]) => void
  manualSurcharges?: ManualSurcharge[]
  onManualSurchargesChange?: (lines: ManualSurcharge[]) => void
  /**
   * `pill` — compact footer trigger (default).
   * `triggerOnly` — full-width toolbar button (e.g. ColumnLayout vehicle row).
   * `embedded` — modal body only (no trigger); parent owns open/close chrome.
   */
  variant?: 'pill' | 'triggerOnly' | 'embedded'
  triggerLabel?: string
  className?: string
  /** Controlled open for `embedded` / optional external control. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Unified "תוספות" entry: footer pill with running total + one modal
 * (locked location % + searchable catalog + one-off row).
 * Presentation only — does not change pricing calculation.
 */
export function SurchargesSection({
  locationSurchargesData = [],
  selectedLocationSurcharges = [],
  onLocationSurchargesChange,
  services,
  selectedServices,
  onSelectedServicesChange,
  manualSurcharges = [],
  onManualSurchargesChange,
  variant = 'pill',
  triggerLabel = 'שירותים',
  className = '',
  open: openProp,
  onOpenChange,
}: SurchargesSectionProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [oneOffLabel, setOneOffLabel] = useState('')
  const [oneOffAmount, setOneOffAmount] = useState('')
  const [oneOffVatExempt, setOneOffVatExempt] = useState(false)

  const showModal = openProp ?? internalOpen
  const setShowModal = (next: boolean) => {
    onOpenChange?.(next)
    if (openProp === undefined) setInternalOpen(next)
  }

  const activeServices = useMemo(
    () => [...services].filter((s) => s.is_active).sort(compareServiceLabels),
    [services],
  )

  const activeLocations = useMemo(
    () => locationSurchargesData.filter((s) => s.is_active),
    [locationSurchargesData],
  )

  const selectedLocationItems = activeLocations.filter((s) =>
    selectedLocationSurcharges.includes(s.id),
  )

  const committedManual = sanitizeManualSurcharges(manualSurcharges)

  const locationPercentTotal = selectedLocationItems.reduce(
    (sum, s) => sum + (Number(s.surcharge_percent) || 0),
    0,
  )

  const servicesShekelTotal = selectedServices.reduce((sum, sel) => {
    const svc = activeServices.find((s) => s.id === sel.id)
    if (!svc) return sum
    return sum + selectedServiceDisplayAmount(svc, sel)
  }, 0)

  const manualShekelTotal = committedManual.reduce((sum, m) => sum + m.amount, 0)
  const shekelTotal = servicesShekelTotal + manualShekelTotal

  const headerTotalParts: string[] = []
  if (locationPercentTotal > 0) headerTotalParts.push(`+${locationPercentTotal}%`)
  if (shekelTotal > 0) headerTotalParts.push(`${shekelTotal} ₪`)
  const headerTotal = headerTotalParts.join(' · ')

  const pillLabel = headerTotal ? `+ תוספות · ${headerTotal}` : '+ תוספות'
  const hasActiveSurcharges =
    selectedLocationItems.length > 0 ||
    selectedServices.length > 0 ||
    committedManual.length > 0

  const searchNorm = search.trim().toLowerCase()
  const filteredServices = searchNorm
    ? activeServices.filter((s) => s.label.toLowerCase().includes(searchNorm))
    : activeServices
  const filteredLocations = searchNorm
    ? activeLocations.filter((s) => s.label.toLowerCase().includes(searchNorm))
    : activeLocations

  const selectionCount =
    selectedServices.length +
    committedManual.length +
    (variant === 'triggerOnly' ? selectedLocationSurcharges.length : 0)

  const isServiceSelected = (id: string) => selectedServices.some((s) => s.id === id)
  const getSelected = (id: string) => selectedServices.find((s) => s.id === id)

  const toggleService = (service: ServiceSurcharge) => {
    if (isServiceSelected(service.id)) {
      onSelectedServicesChange(selectedServices.filter((s) => s.id !== service.id))
      return
    }
    const next: SelectedService = { id: service.id }
    if (service.price_type === 'per_unit') next.quantity = 1
    if (service.price_type === 'manual') next.manualPrice = 0
    onSelectedServicesChange([...selectedServices, next])
  }

  const updateQuantity = (id: string, quantity: number) => {
    onSelectedServicesChange(
      selectedServices.map((s) =>
        s.id === id ? { ...s, quantity: Math.max(1, quantity) } : s,
      ),
    )
  }

  const updateManualPrice = (id: string, price: number) => {
    onSelectedServicesChange(
      selectedServices.map((s) =>
        s.id === id ? { ...s, manualPrice: Math.max(0, price) } : s,
      ),
    )
  }

  const toggleLocation = (id: string) => {
    if (!onLocationSurchargesChange) return
    if (selectedLocationSurcharges.includes(id)) {
      onLocationSurchargesChange(selectedLocationSurcharges.filter((x) => x !== id))
    } else {
      onLocationSurchargesChange([...selectedLocationSurcharges, id])
    }
  }

  const addOneOff = () => {
    if (!onManualSurchargesChange) return
    const label = oneOffLabel.trim()
    const amount = Math.max(0, Number(oneOffAmount) || 0)
    if (!label || amount <= 0) return
    onManualSurchargesChange([
      ...manualSurcharges,
      {
        id: newManualSurchargeId(),
        label,
        amount,
        ...(oneOffVatExempt ? { isVatExempt: true as const } : {}),
      },
    ])
    setOneOffLabel('')
    setOneOffAmount('')
    setOneOffVatExempt(false)
  }

  const openModal = () => {
    setSearch('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSearch('')
    setOneOffLabel('')
    setOneOffAmount('')
    setOneOffVatExempt(false)
  }

  const canAddOneOff =
    oneOffLabel.trim().length > 0 && (Number(oneOffAmount) || 0) > 0

  const hasAnythingToShow =
    activeServices.length > 0 ||
    activeLocations.length > 0 ||
    !!onManualSurchargesChange ||
    committedManual.length > 0 ||
    selectedServices.length > 0

  if (!hasAnythingToShow && variant !== 'embedded') return null

  const modalBody = (
    <div className="flex flex-col gap-3 p-4" dir="rtl">
      {selectedLocationItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-gt-text-tertiary">אוטומטיות</p>
          <div className="flex flex-wrap gap-2">
            {selectedLocationItems.map((loc) => (
              <span
                key={loc.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-gt-border bg-gt-surface-subtle px-2.5 py-1.5 text-xs font-medium text-gt-text-secondary"
                title="תוספת מיקום"
              >
                <Lock size={12} className="shrink-0 text-gt-text-tertiary" aria-hidden />
                {loc.label} +{loc.surcharge_percent}%
              </span>
            ))}
          </div>
          <div className="border-t border-gt-border-subtle" />
        </div>
      )}

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gt-text-tertiary"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש שירות…"
          className="h-11 w-full rounded-xl border border-gt-border bg-white pr-10 pl-3 text-sm text-gt-text-primary placeholder:text-gt-text-tertiary focus:border-gt-brand focus:outline-none focus:ring-[3px] focus:ring-gt-brand/15"
        />
      </div>

      <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
        {filteredLocations.length > 0 && onLocationSurchargesChange && (
          <>
            {filteredLocations.map((loc) => {
              const selected = selectedLocationSurcharges.includes(loc.id)
              return (
                <button
                  key={`loc-${loc.id}`}
                  type="button"
                  onClick={() => toggleLocation(loc.id)}
                  className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors ${
                    selected
                      ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
                      : 'border-gt-border bg-white text-gt-text-primary hover:border-gt-border-strong'
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {selected ? (
                      <Check size={16} className="shrink-0 text-gt-brand" />
                    ) : null}
                    {loc.label}
                  </span>
                  <span className="tabular-nums text-gt-text-secondary">
                    +{loc.surcharge_percent}%
                  </span>
                </button>
              )
            })}
            {filteredServices.length > 0 ? (
              <div className="my-2 border-t border-gt-border-subtle" />
            ) : null}
          </>
        )}

        {filteredServices.map((service) => {
          const selected = isServiceSelected(service.id)
          const sel = getSelected(service.id)
          return (
            <div
              key={service.id}
              className={`rounded-xl border transition-colors ${
                selected
                  ? 'border-gt-brand bg-gt-brand-subtle'
                  : 'border-gt-border bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleService(service)}
                className="flex min-h-[48px] w-full items-center justify-between px-3 py-2 text-sm"
              >
                <span
                  className={`flex items-center gap-2 font-medium ${
                    selected ? 'text-gt-brand-text' : 'text-gt-text-primary'
                  }`}
                >
                  {selected ? (
                    <Check size={16} className="shrink-0 text-gt-brand" />
                  ) : null}
                  {service.label}
                  {service.is_vat_exempt ? (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      פטור ממע״מ
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-gt-text-secondary">
                  {servicePriceLabel(service, sel)}
                </span>
              </button>
              {selected && service.price_type === 'per_unit' && (
                <div className="flex items-center justify-between border-t border-gt-brand/20 px-3 py-2">
                  <span className="text-xs text-gt-text-tertiary">
                    {service.unit_label ? `לכל ${service.unit_label}` : 'כמות'}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-gt-border bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(service.id, (sel?.quantity || 1) - 1)
                        }
                        className="flex h-8 w-8 items-center justify-center text-gt-text-secondary"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-medium tabular-nums">
                        {sel?.quantity || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(service.id, (sel?.quantity || 1) + 1)
                        }
                        className="flex h-8 w-8 items-center justify-center text-gt-text-secondary"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-14 text-left text-sm font-bold tabular-nums">
                      ₪{(service.price * (sel?.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              {selected && service.price_type === 'manual' && (
                <div className="flex items-center justify-between border-t border-gt-brand/20 px-3 py-2">
                  <span className="text-xs text-gt-text-tertiary">הזן מחיר</span>
                  <div className="relative">
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gt-text-tertiary">
                      ₪
                    </span>
                    <input
                      type="number"
                      value={sel?.manualPrice || ''}
                      onChange={(e) =>
                        updateManualPrice(service.id, Number(e.target.value))
                      }
                      placeholder="0"
                      className="w-24 rounded-lg border border-gt-border py-1.5 pl-2 pr-6 text-left text-sm focus:border-gt-brand focus:outline-none focus:ring-[3px] focus:ring-gt-brand/15"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {committedManual.length > 0 && onManualSurchargesChange && (
          <>
            <div className="my-2 border-t border-gt-border-subtle" />
            {committedManual.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  onManualSurchargesChange(manualSurcharges.filter((x) => x.id !== m.id))
                }
                className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-gt-brand bg-gt-brand-subtle px-3 py-2 text-sm"
                title="לחץ להסרה"
              >
                <span className="flex items-center gap-2 font-medium text-gt-brand-text">
                  <Check size={16} className="shrink-0 text-gt-brand" />
                  {m.label}
                  {m.isVatExempt ? (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      פטור ממע״מ
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-gt-text-secondary">{m.amount} ₪</span>
              </button>
            ))}
          </>
        )}

        {filteredServices.length === 0 &&
          filteredLocations.length === 0 &&
          searchNorm && (
            <p className="py-6 text-center text-sm text-gt-text-tertiary">
              לא נמצאו שירותים
            </p>
          )}
      </div>

      {onManualSurchargesChange && (
        <div className="space-y-2 border-t border-gt-border-subtle pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={oneOffLabel}
              onChange={(e) => setOneOffLabel(e.target.value)}
              placeholder="שירות אחר…"
              className="min-w-0 flex-1 rounded-xl border border-gt-border px-3 h-10 text-sm focus:border-gt-brand focus:outline-none focus:ring-[3px] focus:ring-gt-brand/15"
            />
            <div className="relative w-24 shrink-0">
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gt-text-tertiary">
                ₪
              </span>
              <input
                type="number"
                min={0}
                value={oneOffAmount}
                onChange={(e) => setOneOffAmount(e.target.value)}
                placeholder="0"
                className="h-10 w-full rounded-xl border border-gt-border py-2 pl-2 pr-7 text-left text-sm focus:border-gt-brand focus:outline-none focus:ring-[3px] focus:ring-gt-brand/15"
              />
            </div>
            <button
              type="button"
              onClick={addOneOff}
              disabled={!canAddOneOff}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-gt-brand px-3 text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Plus size={14} />
              הוסף
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-gt-text-secondary">
            <input
              type="checkbox"
              checked={oneOffVatExempt}
              onChange={(e) => setOneOffVatExempt(e.target.checked)}
              className="rounded accent-[#33d4ff]"
            />
            פטור ממע״מ (לא ממוסה / לא מונחה)
          </label>
        </div>
      )}
    </div>
  )

  const modal = (
    <SelectorModalShell
      open={showModal}
      onClose={closeModal}
      title={
        <div className="flex items-center justify-between gap-3">
          <span>תוספות</span>
          {headerTotal ? (
            <span className="text-sm font-semibold tabular-nums text-gt-brand-text">
              {headerTotal}
            </span>
          ) : null}
        </div>
      }
      panelClassName="max-w-md sm:max-w-lg"
    >
      {modalBody}
    </SelectorModalShell>
  )

  if (variant === 'embedded') {
    return <div className={className}>{modalBody}</div>
  }

  if (variant === 'triggerOnly') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={openModal}
          className={`relative flex min-h-[36px] w-full items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
            selectionCount > 0
              ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
              : 'border-gray-200 text-gt-text-secondary hover:border-gt-border-strong hover:bg-gt-surface-hover'
          }`}
        >
          <span>{triggerLabel}</span>
          {selectionCount > 0 && (
            <span className="absolute top-1 left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gt-brand px-1 text-[11px] font-bold text-white">
              {selectionCount}
            </span>
          )}
        </button>
        {modal}
      </div>
    )
  }

  return (
    <div className={`inline-flex ${className}`} dir="rtl">
      <button
        type="button"
        onClick={openModal}
        className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          hasActiveSurcharges
            ? 'border-gt-brand/40 bg-gt-brand/10 text-gt-brand-text'
            : 'border-gt-border bg-white text-gt-text-secondary hover:border-gt-border-strong'
        }`}
        aria-label={pillLabel}
      >
        <span className="tabular-nums">{pillLabel}</span>
      </button>
      {modal}
    </div>
  )
}
