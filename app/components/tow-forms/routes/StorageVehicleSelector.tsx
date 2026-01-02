'use client'

import { Loader2, Package } from 'lucide-react'
import { StoredVehicleWithCustomer } from '../../../lib/queries/storage'

// ==================== Types ====================

interface StorageVehicleSelectorProps {
  storedVehicles: StoredVehicleWithCustomer[]
  onSelect: (vehicle: StoredVehicleWithCustomer) => void
  loading?: boolean
  selectedIds?: string[]
  className?: string
}

// ==================== Component ====================

export function StorageVehicleSelector({
  storedVehicles,
  onSelect,
  loading = false,
  selectedIds = [],
  className = ''
}: StorageVehicleSelectorProps) {
  const availableVehicles = storedVehicles.filter(v => !selectedIds.includes(v.id))
  
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 text-sm py-2 ${className}`}>
        <Loader2 size={16} className="animate-spin" />
        טוען רכבים מאחסנה...
      </div>
    )
  }

  if (availableVehicles.length === 0) {
    return null
  }

  return (
    <div className={`border border-purple-200 rounded-lg p-3 bg-purple-50 ${className}`}>
      <p className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-2">
        <Package size={16} />
        בחר רכב מאחסנה:
      </p>
      <div className="flex flex-wrap gap-2">
        {availableVehicles.map((sv) => (
          <button
            key={sv.id}
            type="button"
            onClick={() => onSelect(sv)}
            className="px-3 py-2 border border-purple-300 rounded-lg bg-white hover:bg-purple-100 transition-colors text-sm flex items-center gap-2"
          >
            <Package size={14} className="text-purple-500" />
            <span className="font-medium">{sv.plate_number}</span>
            {sv.vehicle_data && (
              <span className="text-xs text-gray-500">
                {sv.vehicle_data.manufacturer} {sv.vehicle_data.model}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ==================== Storage Notification ====================

interface StorageNotificationProps {
  count: number
  className?: string
}

export function StorageNotification({ count, className = '' }: StorageNotificationProps) {
  if (count === 0) return null
  
  return (
    <div className={`bg-purple-50 border border-purple-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-2 text-purple-700">
        <Package size={18} />
        <span className="font-medium">יש {count} רכבים באחסנה ללקוח זה</span>
      </div>
    </div>
  )
}