'use client'

import { useState } from 'react'
import { 
  User,
  Truck,
  Star,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  FileText,
  Wrench,
  AlertTriangle,
  Coffee,
  Car,
  UserX,
  MessageSquare,
  Timer
} from 'lucide-react'

type DriverStatus = 'available' | 'busy' | 'unavailable'
type UnavailabilityReason = 'break' | 'end_of_day' | 'vehicle_issue' | 'personal' | 'other'

interface HistoryItem {
  id: number
  date: string
  customer: string
  from: string
  to: string
  vehicle: string
  status: 'completed' | 'cancelled'
  price: number
}

const unavailabilityReasons: { key: UnavailabilityReason; label: string; icon: React.ReactNode }[] = [
  { key: 'break', label: 'הפסקה', icon: <Coffee size={20} /> },
  { key: 'end_of_day', label: 'סוף יום עבודה', icon: <Clock size={20} /> },
  { key: 'vehicle_issue', label: 'תקלה ברכב', icon: <Wrench size={20} /> },
  { key: 'personal', label: 'סיבה אישית', icon: <UserX size={20} /> },
  { key: 'other', label: 'אחר', icon: <MessageSquare size={20} /> },
]

const returnTimeOptions = [
  { value: 15, label: '15 דקות' },
  { value: 30, label: '30 דקות' },
  { value: 60, label: 'שעה' },
  { value: 120, label: 'שעתיים' },
  { value: 0, label: 'לא ידוע' },
]

export default function DriverProfilePage() {
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'truck'>('stats')
  const [status, setStatus] = useState<DriverStatus>('available')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showUnavailableModal, setShowUnavailableModal] = useState(false)
  const [selectedReason, setSelectedReason] = useState<UnavailabilityReason | null>(null)
  const [selectedReturnTime, setSelectedReturnTime] = useState<number | null>(null)
  const [customNote, setCustomNote] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  // Mock driver data
  const driver = {
    name: 'דוד אברהם',
    phone: '050-1234567',
    email: 'david@example.com',
    license: '12345678',
    rating: 4.8,
    totalTows: 523,
    memberSince: '2022',
  }

  // Mock truck data
  const truck = {
    plate: '12-345-67',
    type: 'גרר מתקפל',
    model: 'איסוזו NQR',
    year: 2021,
    capacity: '3.5 טון',
    maxWeight: '7,000 ק"ג',
    nextService: '15/02/2025',
    insurance: '30/06/2025',
  }

  // Mock history
  const history: HistoryItem[] = [
    { id: 1, date: '05/12/2024', customer: 'יוסי כהן', from: 'תל אביב', to: 'רמת גן', vehicle: '12-345-67', status: 'completed', price: 350 },
    { id: 2, date: '04/12/2024', customer: 'מוסך רמט', from: 'חולון', to: 'בת ים', vehicle: '23-456-78', status: 'completed', price: 280 },
    { id: 3, date: '04/12/2024', customer: 'שרה לוי', from: 'הרצליה', to: 'רעננה', vehicle: '34-567-89', status: 'cancelled', price: 0 },
    { id: 4, date: '03/12/2024', customer: 'אבי ישראלי', from: 'פתח תקווה', to: 'בני ברק', vehicle: '45-678-90', status: 'completed', price: 320 },
    { id: 5, date: '02/12/2024', customer: 'רונית דהן', from: 'ראשל"צ', to: 'נס ציונה', vehicle: '56-789-01', status: 'completed', price: 250 },
    { id: 6, date: '01/12/2024', customer: 'מוסך השרון', from: 'נתניה', to: 'כפר סבא', vehicle: '67-890-12', status: 'completed', price: 400 },
  ]

  const getStatusInfo = (s: DriverStatus) => {
    switch (s) {
      case 'available': return { label: 'זמין', color: 'bg-emerald-500', textColor: 'text-emerald-600', bgLight: 'bg-emerald-100' }
      case 'busy': return { label: 'בגרירה', color: 'bg-amber-500', textColor: 'text-amber-600', bgLight: 'bg-amber-100' }
      case 'unavailable': return { label: 'לא זמין', color: 'bg-red-500', textColor: 'text-red-600', bgLight: 'bg-red-100' }
    }
  }

  const statusInfo = getStatusInfo(status)

  const handleStatusChange = (newStatus: DriverStatus) => {
    if (newStatus === 'unavailable') {
      setShowStatusModal(false)
      setShowUnavailableModal(true)
    } else {
      setStatus(newStatus)
      setShowStatusModal(false)
    }
  }

  const handleConfirmUnavailable = async () => {
    if (!selectedReason) return
    
    setIsUpdating(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // In production: send to server
    console.log('Unavailable:', {
      reason: selectedReason,
      returnTime: selectedReturnTime,
      note: customNote
    })
    
    setStatus('unavailable')
    setShowUnavailableModal(false)
    setSelectedReason(null)
    setSelectedReturnTime(null)
    setCustomNote('')
    setIsUpdating(false)
  }

  const handleCancelUnavailable = () => {
    setShowUnavailableModal(false)
    setShowStatusModal(true)
    setSelectedReason(null)
    setSelectedReturnTime(null)
    setCustomNote('')
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#33d4ff] to-[#21b8e6] text-white p-6 pb-20">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <User size={40} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{driver.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Star size={16} className="fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{driver.rating}</span>
              <span className="text-white/70">•</span>
              <span className="text-white/70">{driver.totalTows} גרירות</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="px-4 -mt-14">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${statusInfo.color}`}></div>
              <div>
                <p className="text-sm text-gray-500">סטטוס נוכחי</p>
                <p className={`font-bold text-lg ${statusInfo.textColor}`}>{statusInfo.label}</p>
              </div>
            </div>
            <button
              onClick={() => setShowStatusModal(true)}
              className={`px-5 py-2.5 rounded-xl font-medium ${statusInfo.bgLight} ${statusInfo.textColor}`}
            >
              שנה סטטוס
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'stats' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            סטטיסטיקות
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            היסטוריה
          </button>
          <button
            onClick={() => setActiveTab('truck')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'truck' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            משאית
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Truck size={18} className="text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-500">השבוע</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">12</p>
                <p className="text-xs text-gray-500">גרירות</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <span className="text-sm text-gray-500">החודש</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">47</p>
                <p className="text-xs text-gray-500">גרירות</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Star size={18} className="text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-500">אחוז השלמה</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">98%</p>
                <p className="text-xs text-gray-500">מוצלח</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <MapPin size={18} className="text-amber-600" />
                  </div>
                  <span className="text-sm text-gray-500">סה"כ</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">1,250</p>
                <p className="text-xs text-gray-500">ק"מ החודש</p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-bold text-gray-800 mb-3">פרטי קשר</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-gray-400" />
                  <span className="text-gray-700 font-mono">{driver.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-gray-400" />
                  <span className="text-gray-700">{driver.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-gray-400" />
                  <span className="text-gray-700">רישיון: {driver.license}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-gray-400" />
                  <span className="text-gray-700">חבר מאז {driver.memberSince}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-800">{item.customer}</p>
                    <p className="text-sm text-gray-500 font-mono">{item.vehicle}</p>
                  </div>
                  <div className="text-left">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      item.status === 'completed' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {item.status === 'completed' ? 'הושלם' : 'בוטל'}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">{item.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={14} className="text-gray-400" />
                  <span>{item.from}</span>
                  <ChevronLeft size={14} className="text-gray-400" />
                  <span>{item.to}</span>
                </div>
                {item.price > 0 && (
                  <p className="text-left font-bold text-emerald-600 mt-2">₪{item.price}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Truck Tab */}
        {activeTab === 'truck' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Truck size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-800">{truck.model}</p>
                  <p className="text-[#33d4ff] font-mono font-bold">{truck.plate}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">סוג</p>
                  <p className="font-medium text-gray-800">{truck.type}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">שנה</p>
                  <p className="font-medium text-gray-800">{truck.year}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">קיבולת</p>
                  <p className="font-medium text-gray-800">{truck.capacity}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">משקל מקסימלי</p>
                  <p className="font-medium text-gray-800">{truck.maxWeight}</p>
                </div>
              </div>
            </div>

            {/* Maintenance */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-bold text-gray-800 mb-3">תחזוקה</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wrench size={18} className="text-amber-600" />
                    <span className="text-amber-800">טיפול הבא</span>
                  </div>
                  <span className="font-bold text-amber-800">{truck.nextService}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" />
                    <span className="text-blue-800">ביטוח בתוקף עד</span>
                  </div>
                  <span className="font-bold text-blue-800">{truck.insurance}</span>
                </div>
              </div>
            </div>

            {/* Report Issue */}
            <button className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl font-medium border border-red-200">
              <AlertTriangle size={20} />
              דווח על תקלה
            </button>
          </div>
        )}
      </div>

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-lg text-gray-800 text-center">שנה סטטוס</h3>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => handleStatusChange('available')}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                  status === 'available' ? 'bg-emerald-100 border-2 border-emerald-500' : 'bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-white" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">זמין</p>
                  <p className="text-sm text-gray-500">מוכן לקבל משימות</p>
                </div>
                {status === 'available' && (
                  <CheckCircle2 size={24} className="mr-auto text-emerald-500" />
                )}
              </button>

              <button
                onClick={() => handleStatusChange('busy')}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                  status === 'busy' ? 'bg-amber-100 border-2 border-amber-500' : 'bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                  <Truck size={24} className="text-white" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">בגרירה</p>
                  <p className="text-sm text-gray-500">כרגע באמצע משימה</p>
                </div>
                {status === 'busy' && (
                  <CheckCircle2 size={24} className="mr-auto text-amber-500" />
                )}
              </button>

              <button
                onClick={() => handleStatusChange('unavailable')}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                  status === 'unavailable' ? 'bg-red-100 border-2 border-red-500' : 'bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                  <XCircle size={24} className="text-white" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">לא זמין</p>
                  <p className="text-sm text-gray-500">לא יכול לקבל משימות כרגע</p>
                </div>
                {status === 'unavailable' && (
                  <CheckCircle2 size={24} className="mr-auto text-red-500" />
                )}
              </button>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowStatusModal(false)}
                className="w-full py-3 text-gray-600 font-medium"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unavailable Reason Modal */}
      {showUnavailableModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-red-500 text-white p-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <XCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">מעבר ללא זמין</h3>
                  <p className="text-white/80 text-sm">בחר סיבה לאי-זמינות</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              {/* Reasons */}
              <div className="space-y-2 mb-5">
                {unavailabilityReasons.map((reason) => (
                  <button
                    key={reason.key}
                    onClick={() => setSelectedReason(reason.key)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                      selectedReason === reason.key
                        ? 'bg-red-50 border-2 border-red-500'
                        : 'bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedReason === reason.key ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {reason.icon}
                    </div>
                    <span className={`font-medium ${
                      selectedReason === reason.key ? 'text-red-700' : 'text-gray-700'
                    }`}>
                      {reason.label}
                    </span>
                    {selectedReason === reason.key && (
                      <CheckCircle2 size={20} className="mr-auto text-red-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Return Time */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Timer size={16} />
                    זמן חזרה משוער (אופציונלי)
                  </div>
                </label>
                <div className="flex flex-wrap gap-2">
                  {returnTimeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedReturnTime(option.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedReturnTime === option.value
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Note */}
              {selectedReason === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    פרט את הסיבה
                  </label>
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="הזן סיבה..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={handleCancelUnavailable}
                  disabled={isUpdating}
                  className="flex-1 py-4 border-2 border-gray-200 bg-white text-gray-600 rounded-xl font-bold text-lg"
                >
                  חזור
                </button>
                <button
                  onClick={handleConfirmUnavailable}
                  disabled={isUpdating || !selectedReason}
                  className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdating ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'אישור'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
