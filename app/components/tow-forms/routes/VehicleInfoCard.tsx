'use client'

// ==================== Types ====================

export interface VehicleData {
  manufacturer?: string
  model?: string
  year?: string
  color?: string
  gearType?: string
  driveType?: string
  totalWeight?: string
  fuelType?: string
}

interface VehicleInfoCardProps {
  data: VehicleData | null | undefined
  isWorking?: boolean
  className?: string
}

// ==================== Component ====================

export function VehicleInfoCard({ data, isWorking = true, className = '' }: VehicleInfoCardProps) {
  if (!data) return null
  
  const title = [data.manufacturer, data.model, data.year].filter(Boolean).join(' ')
  const details = [
    data.color && `צבע: ${data.color}`,
    data.gearType && `גיר: ${data.gearType}`,
    data.driveType && `הנעה: ${data.driveType}`,
    data.totalWeight && `משקל: ${data.totalWeight} ק"ג`
  ].filter(Boolean).join(' • ')
  
  if (!title && !details) return null
  
  return (
    <div className={`bg-gray-50 rounded-lg p-3 border border-gray-200 ${className}`}>
      {title && (
        <p className={`font-bold text-sm mb-1 ${isWorking ? 'text-green-700' : 'text-orange-700'}`}>
          {title}
        </p>
      )}
      {details && (
        <>
          <p className="text-xs text-gray-500 mb-1">מידע רכב מהמאגר:</p>
          <p className="text-xs text-gray-600">{details}</p>
        </>
      )}
    </div>
  )
}