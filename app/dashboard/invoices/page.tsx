'use client'

import { useState } from 'react'
import { 
  Search, 
  Plus, 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Download, 
  Mail, 
  ChevronRight,
  Building2,
  User,
  Printer,
  MoreVertical,
  X,
  Send,
  CreditCard,
  Calendar
} from 'lucide-react'

interface InvoiceCustomer {
  name: string
  type: 'private' | 'business'
  contact?: string
  businessId?: string
  address?: string
  email?: string
}

interface InvoiceItem {
  date: string
  orderNumber: string
  vehicle: string
  route: string
  amount: number
}

interface Invoice {
  id: string
  date: string
  dueDate: string
  customer: InvoiceCustomer
  towsCount: number
  amount: number
  vat: number
  total: number
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  paymentTerms?: string
  paidDate?: string
  paymentMethod?: string
  items: InvoiceItem[]
}

interface BusinessCustomer {
  id: number
  name: string
  contact: string
  email: string
  businessId: string
  openBalance: number
  pendingTows: number
  paymentTerms: string
  creditLimit: number
}

interface PendingTow {
  id: string
  date: string
  vehicle: string
  route: string
  amount: number
  selected: boolean
}

export default function InvoicesPage() {
  const [activeView, setActiveView] = useState<'list' | 'detail'>('list')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  
  // Consolidated invoice wizard state
  const [showConsolidatedWizard, setShowConsolidatedWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [selectedCustomer, setSelectedCustomer] = useState<BusinessCustomer | null>(null)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [pendingTows, setPendingTows] = useState<PendingTow[]>([])
  const [discount, setDiscount] = useState({ type: 'percent' as 'percent' | 'fixed', value: 0 })
  const [addition, setAddition] = useState({ label: '', amount: 0 })
  const [paymentTerms, setPaymentTerms] = useState('net30')
  const [sendMethod, setSendMethod] = useState<'email' | 'sms' | 'whatsapp'>('email')

  // Mock business customers
  const businessCustomers: BusinessCustomer[] = [
    { id: 1, name: 'מוסך רמט', contact: 'רמי טל', email: 'info@ramat-garage.co.il', businessId: '512345678', openBalance: 3200, pendingTows: 5, paymentTerms: 'שוטף + 30', creditLimit: 10000 },
    { id: 2, name: 'ליסינג ישיר', contact: 'דנה כהן', email: 'orders@leasing-yashir.co.il', businessId: '523456789', openBalance: 8750, pendingTows: 8, paymentTerms: 'שוטף + 45', creditLimit: 20000 },
    { id: 3, name: 'השכרת רכב אופק', contact: 'מיכאל אופק', email: 'info@ofek-rental.co.il', businessId: '545678901', openBalance: 4200, pendingTows: 12, paymentTerms: 'שוטף + 60', creditLimit: 15000 },
  ]

  // Load pending tows when customer selected
  const loadPendingTows = (customerId: number) => {
    // Mock data - in real app this would fetch from API
    const mockTows: PendingTow[] = [
      { id: 'T-1001', date: '01/12/2024', vehicle: '12-345-67', route: 'ת"א → רמת גן', amount: 380, selected: true },
      { id: 'T-1005', date: '02/12/2024', vehicle: '23-456-78', route: 'חולון → יפו', amount: 420, selected: true },
      { id: 'T-1008', date: '03/12/2024', vehicle: '34-567-89', route: 'ב"ב → ת"א', amount: 350, selected: true },
      { id: 'T-1012', date: '04/12/2024', vehicle: '45-678-90', route: 'ראשל"צ → חולון', amount: 480, selected: true },
      { id: 'T-1015', date: '05/12/2024', vehicle: '56-789-01', route: 'גבעתיים → ת"א', amount: 520, selected: true },
    ]
    setPendingTows(mockTows)
  }

  const toggleTowSelection = (towId: string) => {
    setPendingTows(pendingTows.map(t => 
      t.id === towId ? { ...t, selected: !t.selected } : t
    ))
  }

  const selectAllTows = (selected: boolean) => {
    setPendingTows(pendingTows.map(t => ({ ...t, selected })))
  }

  const getSelectedTowsTotal = () => {
    return pendingTows.filter(t => t.selected).reduce((sum, t) => sum + t.amount, 0)
  }

  const getDiscountAmount = () => {
    const subtotal = getSelectedTowsTotal()
    if (discount.type === 'percent') {
      return subtotal * (discount.value / 100)
    }
    return discount.value
  }

  const getFinalTotal = () => {
    const subtotal = getSelectedTowsTotal()
    const discountAmount = getDiscountAmount()
    const additionAmount = addition.amount || 0
    const beforeVat = subtotal - discountAmount + additionAmount
    const vat = beforeVat * 0.17
    return { subtotal, discountAmount, additionAmount, beforeVat, vat, total: beforeVat + vat }
  }

  const resetWizard = () => {
    setWizardStep(1)
    setSelectedCustomer(null)
    setDateRange({ from: '', to: '' })
    setPendingTows([])
    setDiscount({ type: 'percent', value: 0 })
    setAddition({ label: '', amount: 0 })
    setPaymentTerms('net30')
    setSendMethod('email')
  }

  const openConsolidatedWizard = () => {
    resetWizard()
    setShowCreateModal(false)
    setShowConsolidatedWizard(true)
  }

  const [invoices] = useState<Invoice[]>([
    {
      id: 'INV-2024-0156',
      date: '05/12/2024',
      dueDate: '05/01/2025',
      customer: { 
        name: 'מוסך רמט', 
        type: 'business', 
        contact: 'רמי טל',
        businessId: '512345678',
        address: 'רמת גן, רח׳ ביאליק 67',
        email: 'info@ramat-garage.co.il'
      },
      towsCount: 5,
      amount: 2450,
      vat: 416.5,
      total: 2866.5,
      status: 'pending',
      paymentTerms: 'שוטף + 30',
      items: [
        { date: '01/12', orderNumber: 'T-0981', vehicle: '12-345-67', route: 'ת"א → רמת גן', amount: 380 },
        { date: '02/12', orderNumber: 'T-0987', vehicle: '23-456-78', route: 'חולון → יפו', amount: 420 },
        { date: '03/12', orderNumber: 'T-0991', vehicle: '34-567-89', route: 'ב"ב → ת"א', amount: 350 },
        { date: '04/12', orderNumber: 'T-0998', vehicle: '45-678-90', route: 'ראשל"צ → חולון', amount: 480 },
        { date: '05/12', orderNumber: 'T-1002', vehicle: '56-789-01', route: 'גבעתיים → ת"א', amount: 820 },
      ]
    },
    {
      id: 'INV-2024-0155',
      date: '04/12/2024',
      dueDate: '04/01/2025',
      customer: { 
        name: 'ליסינג ישיר', 
        type: 'business', 
        contact: 'דנה כהן',
        businessId: '523456789',
        email: 'orders@leasing-yashir.co.il'
      },
      towsCount: 8,
      amount: 4200,
      vat: 714,
      total: 4914,
      status: 'pending',
      paymentTerms: 'שוטף + 30',
      items: [
        { date: '01/12', orderNumber: 'T-0980', vehicle: '11-222-33', route: 'ת"א → הרצליה', amount: 450 },
        { date: '01/12', orderNumber: 'T-0982', vehicle: '22-333-44', route: 'נתניה → ת"א', amount: 520 },
        { date: '02/12', orderNumber: 'T-0985', vehicle: '33-444-55', route: 'ראשל"צ → ב"ש', amount: 780 },
        { date: '02/12', orderNumber: 'T-0988', vehicle: '44-555-66', route: 'אשדוד → ת"א', amount: 620 },
        { date: '03/12', orderNumber: 'T-0992', vehicle: '55-666-77', route: 'חיפה → ת"א', amount: 850 },
        { date: '03/12', orderNumber: 'T-0994', vehicle: '66-777-88', route: 'ת"א → חולון', amount: 280 },
        { date: '04/12', orderNumber: 'T-0997', vehicle: '77-888-99', route: 'גבעתיים → ראשל"צ', amount: 380 },
        { date: '04/12', orderNumber: 'T-0999', vehicle: '88-999-00', route: 'ב"ב → פ"ת', amount: 320 },
      ]
    },
    {
      id: 'INV-2024-0154',
      date: '03/12/2024',
      dueDate: '03/12/2024',
      customer: { 
        name: 'יוסי כהן', 
        type: 'private',
        email: 'yossi.cohen@gmail.com'
      },
      towsCount: 1,
      amount: 380,
      vat: 64.6,
      total: 444.6,
      status: 'paid',
      paidDate: '03/12/2024',
      paymentMethod: 'אשראי',
      items: [
        { date: '03/12', orderNumber: 'T-0990', vehicle: '12-345-67', route: 'ת"א → רמת גן', amount: 380 },
      ]
    },
    {
      id: 'INV-2024-0153',
      date: '02/12/2024',
      dueDate: '02/01/2025',
      customer: { 
        name: 'השכרת רכב אופק', 
        type: 'business', 
        contact: 'מיכאל אופק',
        businessId: '545678901',
        email: 'info@ofek-rental.co.il'
      },
      towsCount: 12,
      amount: 6800,
      vat: 1156,
      total: 7956,
      status: 'overdue',
      paymentTerms: 'שוטף + 30',
      items: [
        { date: '25/11', orderNumber: 'T-0950', vehicle: '11-111-11', route: 'חיפה → ת"א', amount: 850 },
        { date: '26/11', orderNumber: 'T-0955', vehicle: '22-222-22', route: 'אילת → ב"ש', amount: 1200 },
        { date: '27/11', orderNumber: 'T-0960', vehicle: '33-333-33', route: 'ת"א → ירושלים', amount: 680 },
        { date: '28/11', orderNumber: 'T-0965', vehicle: '44-444-44', route: 'נתניה → חיפה', amount: 520 },
        { date: '29/11', orderNumber: 'T-0968', vehicle: '55-555-55', route: 'ראשל"צ → ת"א', amount: 320 },
        { date: '29/11', orderNumber: 'T-0970', vehicle: '66-666-66', route: 'ב"ב → גבעתיים', amount: 280 },
        { date: '30/11', orderNumber: 'T-0972', vehicle: '77-777-77', route: 'חולון → יפו', amount: 350 },
        { date: '30/11', orderNumber: 'T-0975', vehicle: '88-888-88', route: 'ת"א → רמת גן', amount: 380 },
        { date: '01/12', orderNumber: 'T-0978', vehicle: '99-999-99', route: 'פ"ת → ב"ב', amount: 420 },
        { date: '01/12', orderNumber: 'T-0983', vehicle: '10-101-01', route: 'הרצליה → ת"א', amount: 480 },
        { date: '02/12', orderNumber: 'T-0986', vehicle: '20-202-02', route: 'אשקלון → אשדוד', amount: 520 },
        { date: '02/12', orderNumber: 'T-0989', vehicle: '30-303-03', route: 'ת"א → חולון', amount: 800 },
      ]
    },
    {
      id: 'INV-2024-0152',
      date: '01/12/2024',
      dueDate: '01/12/2024',
      customer: { 
        name: 'שרה לוי', 
        type: 'private',
        email: 'sara.levi@gmail.com'
      },
      towsCount: 1,
      amount: 280,
      vat: 47.6,
      total: 327.6,
      status: 'paid',
      paidDate: '01/12/2024',
      paymentMethod: 'מזומן',
      items: [
        { date: '01/12', orderNumber: 'T-0979', vehicle: '23-456-78', route: 'גבעתיים → ת"א', amount: 280 },
      ]
    },
    {
      id: 'INV-2024-0151',
      date: '30/11/2024',
      dueDate: '30/12/2024',
      customer: { 
        name: 'מוסך רמט', 
        type: 'business', 
        contact: 'רמי טל',
        businessId: '512345678'
      },
      towsCount: 7,
      amount: 3150,
      vat: 535.5,
      total: 3685.5,
      status: 'paid',
      paidDate: '28/12/2024',
      paymentMethod: 'העברה בנקאית',
      items: [
        { date: '24/11', orderNumber: 'T-0920', vehicle: '12-345-67', route: 'ת"א → רמת גן', amount: 380 },
        { date: '25/11', orderNumber: 'T-0925', vehicle: '23-456-78', route: 'חולון → יפו', amount: 420 },
        { date: '26/11', orderNumber: 'T-0930', vehicle: '34-567-89', route: 'ב"ב → ת"א', amount: 350 },
        { date: '27/11', orderNumber: 'T-0935', vehicle: '45-678-90', route: 'ראשל"צ → חולון', amount: 480 },
        { date: '28/11', orderNumber: 'T-0940', vehicle: '56-789-01', route: 'גבעתיים → ת"א', amount: 520 },
        { date: '29/11', orderNumber: 'T-0945', vehicle: '67-890-12', route: 'ת"א → הרצליה', amount: 450 },
        { date: '30/11', orderNumber: 'T-0948', vehicle: '78-901-23', route: 'נתניה → ת"א', amount: 550 },
      ]
    },
  ])

  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => i.status === 'pending').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    pendingAmount: invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.total, 0),
    overdueAmount: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total, 0),
    paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
    totalAmount: invoices.reduce((sum, i) => sum + i.total, 0),
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700'
      case 'pending': return 'bg-amber-100 text-amber-700'
      case 'overdue': return 'bg-red-100 text-red-700'
      case 'cancelled': return 'bg-gray-100 text-gray-500'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusText = (status: string) => {
    switch(status) {
      case 'paid': return 'שולם'
      case 'pending': return 'ממתין'
      case 'overdue': return 'באיחור'
      case 'cancelled': return 'בוטל'
      default: return status
    }
  }

  const filteredInvoices = invoices.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!i.id.toLowerCase().includes(query) && 
          !i.customer.name.toLowerCase().includes(query)) {
        return false
      }
    }
    return true
  })

  const openInvoiceDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setActiveView('detail')
  }

  const closeDetail = () => {
    setActiveView('list')
    setSelectedInvoice(null)
  }

  // Invoice Detail View
  if (activeView === 'detail' && selectedInvoice) {
    return (
      <div>
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={closeDetail}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight size={20} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">חשבונית {selectedInvoice.id}</h1>
                <p className="text-gray-500 text-sm mt-1">תאריך: {selectedInvoice.date}</p>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">
                <Download size={18} />
                הורד PDF
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">
                <Mail size={18} />
                שלח במייל
              </button>
              {selectedInvoice.status !== 'paid' && (
                <button 
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
                >
                  <CheckCircle size={18} />
                  סמן כשולם
                </button>
              )}
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="lg:hidden grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-2 px-4 py-3 text-gray-600 border border-gray-200 rounded-xl font-medium">
              <Download size={18} />
              הורד PDF
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-3 text-gray-600 border border-gray-200 rounded-xl font-medium">
              <Mail size={18} />
              שלח במייל
            </button>
            {selectedInvoice.status !== 'paid' && (
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
              >
                <CheckCircle size={18} />
                סמן כשולם
              </button>
            )}
          </div>
        </div>

        {/* Invoice Preview */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          {/* Invoice Header */}
          <div className="p-6 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <div className="w-14 h-14 bg-gradient-to-br from-[#33d4ff] to-[#21b8e6] rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-white font-bold text-xl">ג</span>
                </div>
                <h2 className="text-xl font-bold text-gray-800">גרירות ישראל בע"מ</h2>
                <p className="text-gray-500 mt-1">ח.פ: 512345678</p>
                <p className="text-gray-500">רח' הברזל 15, תל אביב</p>
                <p className="text-gray-500">טל: 03-1234567</p>
              </div>
              <div className="sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">חשבונית מס</h1>
                <p className="text-lg text-gray-600">{selectedInvoice.id}</p>
                <div className="mt-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedInvoice.status)}`}>
                    {getStatusText(selectedInvoice.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Dates */}
          <div className="p-6 sm:p-8 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">לכבוד</h3>
              <p className="font-bold text-gray-800 text-lg">{selectedInvoice.customer.name}</p>
              {selectedInvoice.customer.contact && (
                <p className="text-gray-600">לידי: {selectedInvoice.customer.contact}</p>
              )}
              {selectedInvoice.customer.type === 'business' && selectedInvoice.customer.businessId && (
                <p className="text-gray-500 text-sm">ח.פ: {selectedInvoice.customer.businessId}</p>
              )}
              {selectedInvoice.customer.address && (
                <p className="text-gray-500 text-sm">{selectedInvoice.customer.address}</p>
              )}
            </div>
            <div className="sm:text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">תאריך הפקה</p>
                  <p className="font-medium text-gray-800">{selectedInvoice.date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">תאריך לתשלום</p>
                  <p className={`font-medium ${selectedInvoice.status === 'overdue' ? 'text-red-600' : 'text-gray-800'}`}>
                    {selectedInvoice.dueDate}
                  </p>
                </div>
                {selectedInvoice.paymentTerms && (
                  <div>
                    <p className="text-sm text-gray-500">תנאי תשלום</p>
                    <p className="font-medium text-gray-800">{selectedInvoice.paymentTerms}</p>
                  </div>
                )}
                {selectedInvoice.status === 'paid' && selectedInvoice.paidDate && (
                  <div>
                    <p className="text-sm text-gray-500">תאריך תשלום</p>
                    <p className="font-medium text-emerald-600">{selectedInvoice.paidDate}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-6 sm:p-8">
            <h3 className="font-bold text-gray-800 mb-4">פירוט גרירות</h3>
            
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-3 text-sm font-medium text-gray-500">תאריך</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">מס' הזמנה</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">רכב</th>
                    <th className="text-right py-3 text-sm font-medium text-gray-500">מסלול</th>
                    <th className="text-left py-3 text-sm font-medium text-gray-500">סכום</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 text-sm text-gray-600">{item.date}</td>
                      <td className="py-3 text-sm font-mono text-[#33d4ff]">{item.orderNumber}</td>
                      <td className="py-3 text-sm font-mono text-gray-600">{item.vehicle}</td>
                      <td className="py-3 text-sm text-gray-600">{item.route}</td>
                      <td className="py-3 text-sm text-gray-800 text-left font-medium">₪{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile List */}
            <div className="sm:hidden space-y-3">
              {selectedInvoice.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-[#33d4ff] text-sm">{item.orderNumber}</span>
                    <span className="font-medium text-gray-800">₪{item.amount}</span>
                  </div>
                  <p className="text-sm text-gray-600">{item.route}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.date} • {item.vehicle}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="p-6 sm:p-8 bg-gray-50 border-t border-gray-200">
            <div className="max-w-xs mr-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">סה"כ לפני מע"מ</span>
                <span className="text-gray-800">₪{selectedInvoice.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">מע"מ (17%)</span>
                <span className="text-gray-800">₪{selectedInvoice.vat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span className="text-gray-800">סה"כ לתשלום</span>
                <span className="text-gray-800">₪{selectedInvoice.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 sm:p-8 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>תודה על שיתוף הפעולה!</p>
            <p className="mt-2">לתשלום בהעברה בנקאית: בנק הפועלים, סניף 123, חשבון 456789</p>
          </div>
        </div>

        {/* Payment History (if paid) */}
        {selectedInvoice.status === 'paid' && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">היסטוריית תשלום</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-emerald-800">שולם במלואו</p>
                  <p className="text-sm text-emerald-600">{selectedInvoice.paidDate} • {selectedInvoice.paymentMethod}</p>
                </div>
                <span className="font-bold text-emerald-700">₪{selectedInvoice.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-emerald-600 text-white">
                <h2 className="font-bold text-lg">סימון כשולם</h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <p className="text-gray-500">סכום לתשלום</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">₪{selectedInvoice.total.toLocaleString()}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">תאריך תשלום</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">אמצעי תשלום</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['מזומן', 'אשראי', 'העברה'].map((method) => (
                      <button
                        key={method}
                        className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 focus:bg-[#33d4ff] focus:text-white focus:border-[#33d4ff]"
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">הערות (אופציונלי)</label>
                  <textarea
                    rows={2}
                    placeholder="הערות לתשלום..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                >
                  ביטול
                </button>
                <button
                  onClick={() => {
                    setShowPaymentModal(false)
                    alert('התשלום נרשם בהצלחה')
                  }}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
                >
                  אשר תשלום
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Invoices List View
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">חשבוניות</h1>
            <p className="text-gray-500 mt-1">ניהול חשבוניות ותשלומים</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="hidden lg:flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap"
          >
            <Plus size={20} />
            הפק חשבונית
          </button>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="lg:hidden flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-5 py-3 rounded-xl font-medium transition-colors w-full"
        >
          <Plus size={20} />
          הפק חשבונית
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">ממתינות לתשלום</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
              <p className="text-sm text-gray-500 mt-1">₪{stats.pendingAmount.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock size={24} className="text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">באיחור</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.overdue}</p>
              <p className="text-sm text-gray-500 mt-1">₪{stats.overdueAmount.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">שולמו החודש</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.paid}</p>
              <p className="text-sm text-gray-500 mt-1">₪{stats.paidAmount.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">סה"כ החודש</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
              <p className="text-sm text-gray-500 mt-1">₪{stats.totalAmount.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <FileText size={24} className="text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי מספר חשבונית או לקוח..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'הכל' },
              { id: 'pending', label: 'ממתין' },
              { id: 'overdue', label: 'באיחור' },
              { id: 'paid', label: 'שולם' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  statusFilter === filter.id
                    ? 'bg-[#33d4ff] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="hidden lg:flex items-center gap-2">
            <input type="date" className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
            <span className="text-gray-400">-</span>
            <input type="date" className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Header - Desktop */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500">
          <div className="col-span-2">מספר חשבונית</div>
          <div className="col-span-3">לקוח</div>
          <div className="col-span-1">גרירות</div>
          <div className="col-span-2">סכום</div>
          <div className="col-span-2">תאריך לתשלום</div>
          <div className="col-span-1">סטטוס</div>
          <div className="col-span-1">פעולות</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-100">
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => openInvoiceDetail(invoice)}
            >
              {/* Desktop View */}
              <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center">
                <div className="col-span-2">
                  <p className="font-mono font-medium text-[#33d4ff]">{invoice.id}</p>
                  <p className="text-xs text-gray-500">{invoice.date}</p>
                </div>

                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      invoice.customer.type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {invoice.customer.type === 'business' ? (
                        <Building2 size={18} className="text-purple-600" />
                      ) : (
                        <User size={18} className="text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{invoice.customer.name}</p>
                      {invoice.customer.contact && (
                        <p className="text-xs text-gray-500 truncate">{invoice.customer.contact}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-span-1">
                  <span className="text-sm text-gray-600">{invoice.towsCount}</span>
                </div>

                <div className="col-span-2">
                  <p className="font-bold text-gray-800">₪{invoice.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">לפני מע"מ: ₪{invoice.amount.toLocaleString()}</p>
                </div>

                <div className="col-span-2">
                  <p className={`text-sm ${invoice.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                    {invoice.dueDate}
                  </p>
                  {invoice.paymentTerms && (
                    <p className="text-xs text-gray-500">{invoice.paymentTerms}</p>
                  )}
                </div>

                <div className="col-span-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getStatusBadge(invoice.status)}`}>
                    {getStatusText(invoice.status)}
                  </span>
                </div>

                <div className="col-span-1">
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button className="p-2 text-gray-400 hover:text-[#33d4ff] hover:bg-blue-50 rounded-lg transition-colors" title="הורד PDF">
                      <Download size={16} />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="עוד">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile View */}
              <div className="lg:hidden">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono font-medium text-[#33d4ff]">{invoice.id}</p>
                    <p className="font-medium text-gray-800">{invoice.customer.name}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getStatusBadge(invoice.status)}`}>
                    {getStatusText(invoice.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{invoice.date} • {invoice.towsCount} גרירות</span>
                  <span className="font-bold text-gray-800">₪{invoice.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredInvoices.length === 0 && (
          <div className="p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">לא נמצאו חשבוניות</p>
          </div>
        )}

        {/* Pagination */}
        {filteredInvoices.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              מציג 1-{filteredInvoices.length} מתוך {invoices.length} חשבוניות
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50" disabled>
                הקודם
              </button>
              <button className="px-3 py-1.5 text-sm bg-[#33d4ff] text-white rounded-lg">1</button>
              <button className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">2</button>
              <button className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
                הבא
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Invoice Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h2 className="font-bold text-lg">הפקת חשבונית</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <button className="flex-1 p-4 border-2 border-[#33d4ff] bg-[#33d4ff]/10 rounded-xl text-center">
                  <FileText size={32} className="mx-auto text-[#33d4ff] mb-2" />
                  <p className="font-medium text-gray-800">חשבונית רגילה</p>
                  <p className="text-sm text-gray-500">לגרירה בודדת</p>
                </button>
                <button 
                  onClick={openConsolidatedWizard}
                  className="flex-1 p-4 border-2 border-gray-200 hover:border-[#33d4ff] rounded-xl text-center transition-colors"
                >
                  <Building2 size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="font-medium text-gray-800">חשבונית מרוכזת</p>
                  <p className="text-sm text-gray-500">ללקוח עסקי</p>
                </button>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                  <strong>טיפ:</strong> להפקת חשבונית לגרירה בודדת, ניתן גם ללחוץ על "הפק חשבונית" מתוך מסך פרטי הגרירה.
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  alert('יפתח מסך הפקת חשבונית')
                }}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]"
              >
                המשך
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Invoice Wizard */}
      {showConsolidatedWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl sm:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <div>
                <h2 className="font-bold text-lg">חשבונית מרוכזת</h2>
                <p className="text-white/80 text-sm">שלב {wizardStep} מתוך 5</p>
              </div>
              <button
                onClick={() => setShowConsolidatedWizard(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex-1 flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step < wizardStep ? 'bg-emerald-500 text-white' :
                      step === wizardStep ? 'bg-[#33d4ff] text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {step < wizardStep ? <CheckCircle size={16} /> : step}
                    </div>
                    {step < 5 && (
                      <div className={`flex-1 h-1 rounded ${step < wizardStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>לקוח</span>
                <span>גרירות</span>
                <span>תנאים</span>
                <span>תצוגה</span>
                <span>שליחה</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              {/* Step 1: Select Customer */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 text-lg">בחירת לקוח עסקי</h3>
                  <p className="text-gray-500">בחר לקוח להפקת חשבונית מרוכזת</p>
                  
                  <div className="space-y-3">
                    {businessCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer)
                          loadPendingTows(customer.id)
                        }}
                        className={`w-full p-4 border-2 rounded-xl text-right transition-colors ${
                          selectedCustomer?.id === customer.id 
                            ? 'border-[#33d4ff] bg-[#33d4ff]/10' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Building2 size={24} className="text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800">{customer.name}</p>
                            <p className="text-sm text-gray-500">{customer.contact} • {customer.email}</p>
                          </div>
                          <div className="text-left">
                            <p className="text-sm text-gray-500">{customer.pendingTows} גרירות ממתינות</p>
                            {customer.openBalance > 0 && (
                              <p className="text-sm text-amber-600">יתרה פתוחה: ₪{customer.openBalance.toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedCustomer && selectedCustomer.openBalance > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-amber-800">ללקוח יתרה פתוחה</p>
                          <p className="text-sm text-amber-700">₪{selectedCustomer.openBalance.toLocaleString()} - האם להמשיך בכל זאת?</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Select Tows */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">בחירת גרירות</h3>
                      <p className="text-gray-500">בחר את הגרירות לחשבונית</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-500">נבחרו {pendingTows.filter(t => t.selected).length} מתוך {pendingTows.length}</p>
                      <p className="font-bold text-[#33d4ff]">₪{getSelectedTowsTotal().toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Date Range Filter */}
                  <div className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">מתאריך</label>
                      <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">עד תאריך</label>
                      <input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>

                  {/* Select All */}
                  <div className="flex items-center justify-between p-3 bg-gray-100 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pendingTows.every(t => t.selected)}
                        onChange={(e) => selectAllTows(e.target.checked)}
                        className="w-5 h-5 text-[#33d4ff] rounded"
                      />
                      <span className="font-medium text-gray-700">בחר הכל</span>
                    </label>
                  </div>

                  {/* Tows List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {pendingTows.map((tow) => (
                      <div
                        key={tow.id}
                        onClick={() => toggleTowSelection(tow.id)}
                        className={`p-3 border-2 rounded-xl cursor-pointer transition-colors ${
                          tow.selected ? 'border-[#33d4ff] bg-[#33d4ff]/5' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={tow.selected}
                            onChange={() => toggleTowSelection(tow.id)}
                            className="w-5 h-5 text-[#33d4ff] rounded"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[#33d4ff] text-sm">{tow.id}</span>
                              <span className="text-gray-400">•</span>
                              <span className="text-sm text-gray-600">{tow.date}</span>
                            </div>
                            <p className="text-sm text-gray-600">{tow.route}</p>
                            <p className="text-xs text-gray-400 font-mono">{tow.vehicle}</p>
                          </div>
                          <span className="font-bold text-gray-800">₪{tow.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {pendingTows.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                      <p>אין גרירות ממתינות לחשבונית</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Discount & Terms */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 text-lg">הנחות ותנאים</h3>
                  <p className="text-gray-500">הוסף הנחה או תוספת והגדר תנאי תשלום</p>

                  {/* Discount */}
                  <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h4 className="font-medium text-gray-700">הנחה</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDiscount({ ...discount, type: 'percent' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          discount.type === 'percent' ? 'bg-[#33d4ff] text-white' : 'bg-white border border-gray-200 text-gray-600'
                        }`}
                      >
                        אחוז %
                      </button>
                      <button
                        onClick={() => setDiscount({ ...discount, type: 'fixed' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          discount.type === 'fixed' ? 'bg-[#33d4ff] text-white' : 'bg-white border border-gray-200 text-gray-600'
                        }`}
                      >
                        סכום קבוע ₪
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={discount.value || ''}
                        onChange={(e) => setDiscount({ ...discount, value: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] text-left"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        {discount.type === 'percent' ? '%' : '₪'}
                      </span>
                    </div>
                  </div>

                  {/* Addition */}
                  <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h4 className="font-medium text-gray-700">תוספת (אופציונלי)</h4>
                    <input
                      type="text"
                      value={addition.label}
                      onChange={(e) => setAddition({ ...addition, label: e.target.value })}
                      placeholder="תיאור התוספת (לדוגמה: דמי טיפול)"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        value={addition.amount || ''}
                        onChange={(e) => setAddition({ ...addition, amount: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] text-left"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    </div>
                  </div>

                  {/* Payment Terms */}
                  <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h4 className="font-medium text-gray-700">תנאי תשלום</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'immediate', label: 'מיידי' },
                        { id: 'net30', label: 'שוטף + 30' },
                        { id: 'net45', label: 'שוטף + 45' },
                        { id: 'net60', label: 'שוטף + 60' },
                      ].map((term) => (
                        <button
                          key={term.id}
                          onClick={() => setPaymentTerms(term.id)}
                          className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            paymentTerms === term.id ? 'bg-[#33d4ff] text-white' : 'bg-white border border-gray-200 text-gray-600'
                          }`}
                        >
                          {term.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Credit Limit Warning */}
                  {selectedCustomer && getFinalTotal().total > selectedCustomer.creditLimit && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-red-800">חריגה מתקרת אשראי</p>
                          <p className="text-sm text-red-700">
                            סה"כ: ₪{getFinalTotal().total.toLocaleString()} | תקרה: ₪{selectedCustomer.creditLimit.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Preview */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 text-lg">תצוגה מקדימה</h3>
                  <p className="text-gray-500">בדוק את פרטי החשבונית לפני הפקה</p>

                  {/* Customer Info */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 size={20} className="text-purple-600" />
                      <span className="font-bold text-gray-800">{selectedCustomer?.name}</span>
                    </div>
                    <p className="text-sm text-gray-600">{selectedCustomer?.contact} • {selectedCustomer?.email}</p>
                    <p className="text-sm text-gray-500">ח.פ: {selectedCustomer?.businessId}</p>
                  </div>

                  {/* Tows Summary */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="font-medium text-gray-700 mb-2">גרירות בחשבונית</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {pendingTows.filter(t => t.selected).map((tow) => (
                        <div key={tow.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">{tow.date} • {tow.route}</span>
                          <span className="font-medium">₪{tow.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="p-4 bg-gray-800 text-white rounded-xl">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-300">סה"כ גרירות ({pendingTows.filter(t => t.selected).length})</span>
                        <span>₪{getFinalTotal().subtotal.toLocaleString()}</span>
                      </div>
                      {getFinalTotal().discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>הנחה {discount.type === 'percent' ? `(${discount.value}%)` : ''}</span>
                          <span>-₪{getFinalTotal().discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {getFinalTotal().additionAmount > 0 && (
                        <div className="flex justify-between text-amber-400">
                          <span>{addition.label || 'תוספת'}</span>
                          <span>+₪{getFinalTotal().additionAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-600 pt-2">
                        <span className="text-gray-300">לפני מע"מ</span>
                        <span>₪{getFinalTotal().beforeVat.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">מע"מ (17%)</span>
                        <span>₪{getFinalTotal().vat.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-600">
                        <span>סה"כ לתשלום</span>
                        <span>₪{getFinalTotal().total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Terms */}
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                    <Calendar size={20} className="text-blue-600" />
                    <span className="text-blue-800">
                      תנאי תשלום: {
                        paymentTerms === 'immediate' ? 'מיידי' :
                        paymentTerms === 'net30' ? 'שוטף + 30' :
                        paymentTerms === 'net45' ? 'שוטף + 45' : 'שוטף + 60'
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Step 5: Send */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-xl">החשבונית מוכנה!</h3>
                    <p className="text-gray-500 mt-1">נשלחה בהצלחה לחשבשבת</p>
                  </div>

                  {/* Invoice Number */}
                  <div className="p-4 bg-gray-100 rounded-xl text-center">
                    <p className="text-sm text-gray-500">מספר חשבונית</p>
                    <p className="text-2xl font-mono font-bold text-[#33d4ff]">INV-2024-0157</p>
                  </div>

                  {/* Send to Customer */}
                  <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h4 className="font-medium text-gray-700">שליחה ללקוח</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setSendMethod('email')}
                        className={`p-3 rounded-xl text-center transition-colors ${
                          sendMethod === 'email' ? 'bg-[#33d4ff] text-white' : 'bg-white border border-gray-200'
                        }`}
                      >
                        <Mail size={24} className="mx-auto mb-1" />
                        <span className="text-sm">אימייל</span>
                      </button>
                      <button
                        onClick={() => setSendMethod('sms')}
                        className={`p-3 rounded-xl text-center transition-colors ${
                          sendMethod === 'sms' ? 'bg-[#33d4ff] text-white' : 'bg-white border border-gray-200'
                        }`}
                      >
                        <Send size={24} className="mx-auto mb-1" />
                        <span className="text-sm">SMS</span>
                      </button>
                      <button
                        onClick={() => setSendMethod('whatsapp')}
                        className={`p-3 rounded-xl text-center transition-colors ${
                          sendMethod === 'whatsapp' ? 'bg-[#33d4ff] text-white' : 'bg-white border border-gray-200'
                        }`}
                      >
                        <Send size={24} className="mx-auto mb-1" />
                        <span className="text-sm">וואטסאפ</span>
                      </button>
                    </div>
                    {sendMethod === 'email' && (
                      <input
                        type="email"
                        defaultValue={selectedCustomer?.email}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                      <Download size={18} />
                      הורד PDF
                    </button>
                    <button className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                      <Printer size={18} />
                      הדפס
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              {wizardStep > 1 && wizardStep < 5 && (
                <button
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                >
                  חזור
                </button>
              )}
              {wizardStep < 4 && (
                <button
                  onClick={() => setWizardStep(wizardStep + 1)}
                  disabled={wizardStep === 1 && !selectedCustomer}
                  className={`flex-1 py-3 rounded-xl font-medium ${
                    (wizardStep === 1 && !selectedCustomer)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-[#33d4ff] text-white hover:bg-[#21b8e6]'
                  }`}
                >
                  המשך
                </button>
              )}
              {wizardStep === 4 && (
                <button
                  onClick={() => setWizardStep(5)}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
                >
                  שלח לחשבשבת והפק חשבונית
                </button>
              )}
              {wizardStep === 5 && (
                <>
                  <button
                    onClick={() => {
                      setShowConsolidatedWizard(false)
                      resetWizard()
                    }}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                  >
                    סגור
                  </button>
                  <button
                    onClick={() => alert('נשלח ללקוח!')}
                    className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]"
                  >
                    שלח ללקוח
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
