'use client'

/**
 * Shared storage-vehicle picker modal (search + list).
 * Intended to replace:
 * - the customer portal’s inline SelectorModalShell storage picker
 * - the dashboard’s one-off “בחר רכב מאחסנה” overlays (create/page.tsx, etc.)
 * Callers own data fetching and selection side effects; this component is presentational only.
 */

import { useEffect, useMemo, useState } from 'react'
import { SelectorModalShell } from '@/app/components/tow-forms/shared/SelectorModalShell'
import { TimeInStoragePill } from '@/app/components/storage/TimeInStoragePill'
import { normalizePlate } from '@/app/lib/utils/plate-number'

/** Minimal shape needed to render/filter a stored-vehicle row (portal or dashboard). */
export type StorageVehiclePickerItem = {
  id: string
  plate_number: string
  vehicle_data: {
    manufacturer?: string
    model?: string
  } | null
  vehicle_condition: 'operational' | 'faulty'
  current_status: 'stored' | 'reserved_for_tow' | 'released' | string
  last_stored_at: string
}

export type StorageVehiclePickerModalProps<T extends StorageVehiclePickerItem = StorageVehiclePickerItem> = {
  isOpen: boolean
  onClose: () => void
  vehicles: T[]
  onSelect: (vehicle: T) => void
  /**
   * When true (default), `reserved_for_tow` rows are listed but disabled.
   * When false, only `stored` vehicles are shown.
   */
  showReservedDisabled?: boolean
  title?: string
}

function makeModelLabel(vehicle: StorageVehiclePickerItem): string {
  return [vehicle.vehicle_data?.manufacturer, vehicle.vehicle_data?.model]
    .filter(Boolean)
    .join(' ')
}

export function StorageVehiclePickerModal<T extends StorageVehiclePickerItem>({
  isOpen,
  onClose,
  vehicles,
  onSelect,
  showReservedDisabled = true,
  title = 'בחר רכב מאחסנה',
}: StorageVehiclePickerModalProps<T>) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const visibleVehicles = useMemo(() => {
    const base = showReservedDisabled
      ? vehicles.filter((v) => v.current_status === 'stored' || v.current_status === 'reserved_for_tow')
      : vehicles.filter((v) => v.current_status === 'stored')

    const q = search.trim().toLowerCase()
    if (!q) return base

    const plateQuery = normalizePlate(search)
    return base.filter((vehicle) => {
      const makeModel = makeModelLabel(vehicle).toLowerCase()
      const matchesPlate =
        plateQuery.length > 0 &&
        normalizePlate(vehicle.plate_number).includes(plateQuery)
      return matchesPlate || makeModel.includes(q)
    })
  }, [vehicles, search, showReservedDisabled])

  const handleClose = () => {
    setSearch('')
    onClose()
  }

  return (
    <SelectorModalShell
      open={isOpen}
      onClose={handleClose}
      title={title}
      panelClassName="max-w-lg"
    >
      <div className="space-y-3 p-4" dir="rtl">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי מספר רכב או דגם"
          className="w-full rounded-xl border border-gt-border bg-white px-3 py-2.5 text-sm text-gt-text-primary placeholder:text-gt-text-tertiary focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15"
          autoFocus
        />
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {visibleVehicles.length === 0 ? (
            <p className="py-6 text-center text-sm text-gt-text-tertiary">
              לא נמצאו רכבים תואמים
            </p>
          ) : (
            visibleVehicles.map((vehicle) => {
              const isReserved = vehicle.current_status === 'reserved_for_tow'
              const isFaulty = vehicle.vehicle_condition === 'faulty'
              const makeModel = makeModelLabel(vehicle)
              const selectable = vehicle.current_status === 'stored'

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  disabled={!selectable}
                  onClick={() => {
                    if (!selectable) return
                    onSelect(vehicle)
                    handleClose()
                  }}
                  className={
                    !selectable
                      ? 'flex w-full flex-col items-start gap-1 rounded-xl border border-gt-border bg-gt-surface-subtle px-3 py-2.5 text-right text-sm text-gt-text-tertiary cursor-not-allowed opacity-70'
                      : 'flex w-full flex-col items-start gap-1 rounded-xl border border-gt-border bg-white px-3 py-2.5 text-right text-sm transition-colors hover:border-gt-brand hover:bg-gt-surface-hover'
                  }
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gt-text-primary">
                      {vehicle.plate_number}
                    </span>
                    {makeModel && (
                      <span className="text-xs text-gt-text-tertiary">{makeModel}</span>
                    )}
                    <span
                      className={
                        isFaulty
                          ? 'px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700'
                          : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700'
                      }
                    >
                      {isFaulty ? 'תקול' : 'תקין'}
                    </span>
                  </span>
                  <TimeInStoragePill lastStoredAt={vehicle.last_stored_at} />
                  {isReserved && (
                    <span className="text-xs text-amber-700">ממתין לגרירה</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </SelectorModalShell>
  )
}
