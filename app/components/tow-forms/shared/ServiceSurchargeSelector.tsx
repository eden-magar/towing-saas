'use client'

import { Plus, Minus } from 'lucide-react'
import { ServiceSurcharge } from '../../../lib/queries/price-lists'

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
}

export function ServiceSurchargeSelector({
  services,
  selectedServices,
  onChange,
  label = 'שירותים נוספים'
}: ServiceSurchargeSelectorProps) {
  const activeServices = services.filter(s => s.is_active)
  
  if (activeServices.length === 0) return null

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

  // בדיקה אם יש שירותים שנבחרו עם פקדים נוספים
  const selectedWithControls = selectedServices.filter(s => {
    const service = activeServices.find(srv => srv.id === s.id)
    return service && (service.price_type === 'per_unit' || service.price_type === 'manual')
  })

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {activeServices.map((service) => {
          const selected = isSelected(service.id)
          
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => toggleService(service)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selected
                  ? 'bg-[#33d4ff] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {service.label} ({getPriceDisplay(service)})
            </button>
          )
        })}
      </div>
      
      {/* פקדים נוספים לשירותים שנבחרו - בתיבה אחת */}
      {selectedWithControls.length > 0 && (
        <div className="mt-3 p-4 bg-cyan-50 border border-cyan-200 rounded-xl space-y-3">
          {selectedWithControls.map(selected => {
            const service = activeServices.find(s => s.id === selected.id)
            if (!service) return null
            
            // per_unit - בורר כמות
            if (service.price_type === 'per_unit') {
              return (
                <div key={service.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {service.label}
                    {service.unit_label && (
                      <span className="text-gray-500 mr-1">(לכל {service.unit_label})</span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => updateQuantity(service.id, (selected.quantity || 1) - 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-r-lg border-l border-gray-200"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-10 text-center text-sm font-medium">
                        {selected.quantity || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(service.id, (selected.quantity || 1) + 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-l-lg border-r border-gray-200"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-800 w-16 text-left">
                      ₪{service.price * (selected.quantity || 1)}
                    </span>
                  </div>
                </div>
              )
            }
            
            // manual - הזנת מחיר
            if (service.price_type === 'manual') {
              return (
                <div key={service.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{service.label}</span>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                    <input
                      type="number"
                      value={selected.manualPrice || ''}
                      onChange={(e) => updateManualPrice(service.id, Number(e.target.value))}
                      placeholder="0"
                      className="w-24 pr-7 pl-2 py-1.5 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                    />
                  </div>
                </div>
              )
            }
            
            return null
          })}
        </div>
      )}
    </div>
  )
}