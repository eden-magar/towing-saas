'use client'

import { useState, useMemo } from 'react'
import { Plus, Minus } from 'lucide-react'
import { ServiceSurcharge } from '../../../lib/queries/price-lists'
import { ManualSurchargeSection } from './ManualSurchargeSection'
import { ManualSurcharge, sanitizeManualSurcharges } from '../../../lib/utils/manual-surcharge'

// מייצג בחירת שירות עם כמות/מחיר
export interface SelectedService {
  id: string
  quantity?: number      // עבור per_unit
  manualPrice?: number   // עבור manual
}

interface ServiceSurchargeSelectorProps {
  services: ServiceSurcharge[]
  selectedServices: SelectedService[]
  onChange: (services: SelectedService[]) => void
  label?: string
  isMobile?: boolean
  manualSurcharges?: ManualSurcharge[]
  onManualSurchargesChange?: (lines: ManualSurcharge[]) => void
}

const HEBREW_SORT = 'he' as const

/** Strip invisible bidi marks / normalize so localeCompare matches visible Hebrew order. */
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
    { numeric: true, sensitivity: 'base' }
  )
}

export function ServiceSurchargeSelector({
  services,
  selectedServices,
  onChange,
  label = 'שירותים נוספים',
  isMobile = false,
  manualSurcharges = [],
  onManualSurchargesChange,
}: ServiceSurchargeSelectorProps) {
  const [showModal, setShowModal] = useState(false)
  // Display order only: Hebrew A-Z on visible label text. Copy before sort so the
  // source `services` prop is never mutated.
  const activeServices = useMemo(
    () => [...services].filter((s) => s.is_active).sort(compareServiceLabels),
    [services]
  )

  if (activeServices.length === 0 && !(isMobile && onManualSurchargesChange)) return null

  const manualSurchargeCount = sanitizeManualSurcharges(manualSurcharges).length
  const servicesSelectionCount = selectedServices.length + (isMobile && onManualSurchargesChange ? manualSurchargeCount : 0)

  const isSelected = (id: string) => selectedServices.some(s => s.id === id)
  const getSelected = (id: string) => selectedServices.find(s => s.id === id)

  const toggleService = (service: ServiceSurcharge) => {
    if (isSelected(service.id)) {
      onChange(selectedServices.filter(s => s.id !== service.id))
    } else {
      const newService: SelectedService = { id: service.id }
      if (service.price_type === 'per_unit') {
        newService.quantity = 1
      }
      if (service.price_type === 'manual') {
        newService.manualPrice = 0
      }
      onChange([...selectedServices, newService])
    }
  }

  const updateQuantity = (id: string, quantity: number) => {
    onChange(selectedServices.map(s => 
      s.id === id ? { ...s, quantity: Math.max(1, quantity) } : s
    ))
  }

  const updateManualPrice = (id: string, price: number) => {
    onChange(selectedServices.map(s => 
      s.id === id ? { ...s, manualPrice: Math.max(0, price) } : s
    ))
  }

  // תצוגת מחיר בכפתור
  const getPriceDisplay = (service: ServiceSurcharge) => {
    const selected = getSelected(service.id)
    
    if (service.price_type === 'manual') {
      if (selected && selected.manualPrice) {
        return `₪${selected.manualPrice}`
      }
      return 'להזנה'
    }
    
    if (service.price_type === 'per_unit' && selected) {
      const qty = selected.quantity || 1
      return `₪${service.price * qty}`
    }
    
    return `₪${service.price}`
  }

  return (
    <div>
      {!isMobile && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      
      {/* Compact trigger — opens the shared services modal (mobile + desktop) */}
      {isMobile ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`sm:hidden relative flex items-center justify-center w-full min-h-[48px] rounded-xl border text-sm font-medium transition-colors ${
            servicesSelectionCount > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>שירותים</span>
          {servicesSelectionCount > 0 && (
            <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#33d4ff] text-white text-[11px] font-bold flex items-center justify-center">
              {servicesSelectionCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`w-full p-3 border rounded-xl text-sm text-right flex items-center justify-between transition-colors ${
            servicesSelectionCount > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>
            {servicesSelectionCount > 0
              ? `${servicesSelectionCount} שירותים נבחרים`
              : 'אין שירותים'}
          </span>
          <span className="text-gray-400">▾</span>
        </button>
      )}

      {/* Services modal — shared by mobile + desktop */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white w-full max-w-md sm:max-w-lg max-h-[80vh] overflow-auto rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{label}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-[#33d4ff] font-medium">סיום</button>
            </div>
            <div className="p-4 space-y-4">
              {isMobile && onManualSurchargesChange && (
                <>
                  <ManualSurchargeSection
                    manualSurcharges={manualSurcharges}
                    onChange={onManualSurchargesChange}
                    addButtonLabel="הוספת שירות נוסף"
                    isMobile
                  />
                  {activeServices.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 space-y-2">
                      <p className="text-sm font-medium text-gray-700">שירותים מוגדרים</p>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2">
              {activeServices.map((service) => (
                <div key={`modal-${service.id}`} className={`p-3 rounded-xl border transition-all ${isSelected(service.id) ? 'border-[#33d4ff] bg-[#33d4ff]/5' : 'border-gray-200'}`}>
                  <button
                    type="button"
                    onClick={() => toggleService(service)}
                    className="w-full min-h-[44px] flex items-center justify-between"
                  >
                    <span className={`font-medium ${isSelected(service.id) ? 'text-[#33d4ff]' : 'text-gray-700'}`}>{service.label}</span>
                    <span className="text-sm text-gray-500">{getPriceDisplay(service)}</span>
                  </button>
                  
                  {/* פקדים נוספים בתוך המודל */}
                  {isSelected(service.id) && service.price_type === 'per_unit' && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{service.unit_label && `לכל ${service.unit_label}`}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white rounded-lg border border-gray-200">
                          <button type="button" onClick={() => updateQuantity(service.id, (getSelected(service.id)?.quantity || 1) - 1)} className={isMobile ? 'w-11 h-11 flex items-center justify-center text-gray-500' : 'w-8 h-8 flex items-center justify-center text-gray-500'}>
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{getSelected(service.id)?.quantity || 1}</span>
                          <button type="button" onClick={() => updateQuantity(service.id, (getSelected(service.id)?.quantity || 1) + 1)} className={isMobile ? 'w-11 h-11 flex items-center justify-center text-gray-500' : 'w-8 h-8 flex items-center justify-center text-gray-500'}>
                            <Plus size={14} />
                          </button>
                        </div>
                        <span className="text-sm font-bold w-14 text-left">₪{service.price * (getSelected(service.id)?.quantity || 1)}</span>
                      </div>
                    </div>
                  )}
                  
                  {isSelected(service.id) && service.price_type === 'manual' && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500">הזן מחיר</span>
                      <div className="relative">
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                        <input
                          type="number"
                          value={getSelected(service.id)?.manualPrice || ''}
                          onChange={(e) => updateManualPrice(service.id, Number(e.target.value))}
                          placeholder="0"
                          className="w-20 pr-6 pl-2 py-1.5 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
