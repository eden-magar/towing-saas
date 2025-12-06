'use client'

import { useState } from 'react'
import { ArrowRight, Search, MapPin, User, Calculator, Truck, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function NewTowPage() {
  const [step, setStep] = useState(1)
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleData, setVehicleData] = useState<any>(null)
  const [loadingVehicle, setLoadingVehicle] = useState(false)
  
  const [towType, setTowType] = useState('simple')
  const [isToTerritories, setIsToTerritories] = useState(false)
  
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  
  const [customerType, setCustomerType] = useState('private')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  
  const [notes, setNotes] = useState('')

  const searchVehicle = async () => {
    if (!vehiclePlate) return
    setLoadingVehicle(true)
    
    setTimeout(() => {
      setVehicleData({
        plate: vehiclePlate,
        manufacturer: 'טויוטה',
        model: 'קורולה',
        year: 2020,
        color: 'לבן',
        type: 'פרטי'
      })
      setLoadingVehicle(false)
    }, 1000)
  }

  const towTypes = [
    { value: 'simple', label: 'גרירה פשוטה', desc: 'מנקודה A לנקודה B' },
    { value: 'with_base', label: 'עם יציאה מבסיס', desc: 'הגרר יוצא מהבסיס' },
    { value: 'transfer', label: 'העברה', desc: 'רכב תקין + רכב מקולקל' },
    { value: 'multi_vehicle', label: 'מרובה רכבים', desc: 'יותר מרכב אחד' },
  ]

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/tows"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowRight size={24} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">גרירה חדשה</h1>
          <p className="text-gray-500 mt-1">מלאו את פרטי הגרירה</p>
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        {['פרטי רכב', 'כתובות', 'לקוח', 'סיכום'].map((label, index) => (
          <div
            key={label}
            className={`flex-1 py-2 px-4 rounded-lg text-center text-sm font-medium transition-colors ${
              step === index + 1
                ? 'bg-[#33d4ff] text-white'
                : step > index + 1
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">מספר רכב</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="הזן מספר רכב"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#33d4ff]"
                  />
                </div>
                <button
                  onClick={searchVehicle}
                  disabled={loadingVehicle || !vehiclePlate}
                  className="px-6 py-3 bg-[#33d4ff] hover:bg-[#21b8e6] disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Search size={20} />
                  <span>{loadingVehicle ? 'מחפש...' : 'חפש'}</span>
                </button>
              </div>
            </div>

            {vehicleData && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-medium text-gray-800 mb-3">פרטי הרכב</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">יצרן:</span>
                    <span className="text-gray-800 mr-2">{vehicleData.manufacturer}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">דגם:</span>
                    <span className="text-gray-800 mr-2">{vehicleData.model}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">שנה:</span>
                    <span className="text-gray-800 mr-2">{vehicleData.year}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">צבע:</span>
                    <span className="text-gray-800 mr-2">{vehicleData.color}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">סוג:</span>
                    <span className="text-gray-800 mr-2">{vehicleData.type}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">סוג גרירה</label>
              <div className="grid grid-cols-2 gap-3">
                {towTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setTowType(type.value)}
                    className={`p-4 rounded-lg border-2 text-right transition-colors ${
                      towType === type.value
                        ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-800">{type.label}</div>
                    <div className="text-sm text-gray-500">{type.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="territories"
                checked={isToTerritories}
                onChange={(e) => setIsToTerritories(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[#33d4ff] focus:ring-[#33d4ff]"
              />
              <label htmlFor="territories" className="flex items-center gap-2 cursor-pointer">
                <AlertTriangle size={20} className="text-amber-600" />
                <span className="text-gray-700">גרירה לשטחים (יו"ש)</span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!vehicleData}
                className="px-6 py-3 bg-[#33d4ff] hover:bg-[#21b8e6] disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                המשך
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={18} className="inline ml-2 text-emerald-500" />
                כתובת איסוף
              </label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="הזן כתובת איסוף"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#33d4ff]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={18} className="inline ml-2 text-red-500" />
                כתובת יעד
              </label>
              <input
                type="text"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                placeholder="הזן כתובת יעד"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#33d4ff]"
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                חזור
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!pickupAddress || !dropoffAddress}
                className="px-6 py-3 bg-[#33d4ff] hover:bg-[#21b8e6] disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                המשך
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">סוג לקוח</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setCustomerType('private')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                    customerType === 'private'
                      ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <User size={24} className="mx-auto mb-2 text-gray-600" />
                  <div className="font-medium text-gray-800">פרטי</div>
                </button>
                <button
                  onClick={() => setCustomerType('business')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                    customerType === 'business'
                      ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Truck size={24} className="mx-auto mb-2 text-gray-600" />
                  <div className="font-medium text-gray-800">עסקי</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">שם לקוח</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="הזן שם לקוח"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#33d4ff]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">טלפון</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="הזן מספר טלפון"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#33d4ff]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">הערות</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הערות נוספות (אופציונלי)"
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#33d4ff] resize-none"
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                חזור
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!customerName || !customerPhone}
                className="px-6 py-3 bg-[#33d4ff] hover:bg-[#21b8e6] disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                המשך
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Calculator size={20} />
              סיכום הזמנה
            </h3>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-500">רכב</span>
                <span className="text-gray-800 font-medium">{vehicleData?.manufacturer} {vehicleData?.model} - {vehiclePlate}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-500">סוג גרירה</span>
                <span className="text-gray-800 font-medium">{towTypes.find(t => t.value === towType)?.label}</span>
              </div>
              {isToTerritories && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">שטחים</span>
                  <span className="text-amber-600 font-medium">כן - יו"ש</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-500">מ</span>
                <span className="text-gray-800 font-medium">{pickupAddress}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-500">אל</span>
                <span className="text-gray-800 font-medium">{dropoffAddress}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-500">לקוח</span>
                <span className="text-gray-800 font-medium">{customerName} ({customerType === 'private' ? 'פרטי' : 'עסקי'})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-500">טלפון</span>
                <span className="text-gray-800 font-medium">{customerPhone}</span>
              </div>
              <div className="flex justify-between py-2 text-lg">
                <span className="text-gray-700 font-medium">מחיר מוערך</span>
                <span className="text-[#33d4ff] font-bold">₪350</span>
              </div>
            </div>

            {notes && (
              <div className="bg-amber-50 rounded-lg p-4">
                <span className="text-gray-600 font-medium">הערות: </span>
                <span className="text-gray-700">{notes}</span>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                חזור
              </button>
              <button
                onClick={() => alert('הגרירה נוצרה בהצלחה!')}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium"
              >
                צור גרירה
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}