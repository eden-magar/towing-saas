'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import {
  getInvoices,
  getInvoiceStats,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  InvoiceWithDetails,
  InvoiceStatus
} from '../../lib/queries/invoices'
import { getCustomers, CustomerWithDetails } from '../../lib/queries/customers'
import { 
  FileText, Plus, Search, Filter, Download, Send, CheckCircle, 
  XCircle, Clock, RefreshCw, MoreVertical, Eye, Trash2, X,
  DollarSign, AlertCircle, ChevronDown, Calendar, Building2, Receipt
} from 'lucide-react'
import Link from 'next/link'

const statusConfig: Record<InvoiceStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  draft: { label: 'טיוטה', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: FileText },
  sent: { label: 'נשלחה', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Send },
  paid: { label: 'שולמה', color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: CheckCircle },
  cancelled: { label: 'בוטלה', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle }
}

export default function InvoicesPage() {
  const { companyId, loading: authLoading } = useAuth()
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    paid: 0,
    cancelled: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0
  })

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modals
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  // New invoice form
  const [newInvoice, setNewInvoice] = useState({
    customerId: '',
    description: '',
    amount: '',
    dueDate: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (companyId && !authLoading) {
      loadData()
    }
  }, [companyId, authLoading])

  const loadData = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [invoicesData, statsData, customersData] = await Promise.all([
        getInvoices(companyId, statusFilter !== 'all' ? { status: statusFilter } : undefined),
        getInvoiceStats(companyId),
        getCustomers(companyId)
      ])
      setInvoices(invoicesData)
      setStats(statsData)
      setCustomers(customersData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    try {
      await updateInvoiceStatus(invoiceId, newStatus)
      await loadData()
      setActionMenuId(null)
    } catch (error) {
      console.error('Error updating status:', error)
      alert('שגיאה בעדכון סטטוס')
    }
  }

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('האם למחוק את החשבונית?')) return
    try {
      await deleteInvoice(invoiceId)
      await loadData()
      setActionMenuId(null)
    } catch (error) {
      console.error('Error deleting invoice:', error)
      alert('שגיאה במחיקת החשבונית')
    }
  }

  const handleCreateInvoice = async () => {
    if (!companyId || !newInvoice.amount) return
    setSaving(true)
    try {
      await createInvoice({
        companyId,
        customerId: newInvoice.customerId || undefined,
        amount: parseFloat(newInvoice.amount),
        dueDate: newInvoice.dueDate || undefined,
        items: [{
          description: newInvoice.description || 'שירותי גרירה',
          amount: parseFloat(newInvoice.amount)
        }]
      })
      setShowNewInvoiceModal(false)
      setNewInvoice({ customerId: '', description: '', amount: '', dueDate: '' })
      await loadData()
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('שגיאה ביצירת החשבונית')
    } finally {
      setSaving(false)
    }
  }

  const openInvoiceDetails = (invoice: InvoiceWithDetails) => {
    setSelectedInvoice(invoice)
    setShowInvoiceModal(true)
  }

  // סינון חשבוניות
  const filteredInvoices = invoices.filter(inv => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchNumber = inv.invoice_number?.toLowerCase().includes(query)
      const matchCustomer = inv.customer?.name?.toLowerCase().includes(query)
      if (!matchNumber && !matchCustomer) return false
    }
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    return true
  })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('he-IL')
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '₪0'
    return `₪${amount.toLocaleString()}`
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          <span>טוען...</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">חשבוניות</h1>
          <p className="text-gray-500 mt-1">ניהול חשבוניות ותשלומים</p>
        </div>
        <button
          onClick={() => setShowNewInvoiceModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#33d4ff] hover:bg-[#21b8e6] text-white rounded-xl font-medium transition-colors"
        >
          <Plus size={20} />
          חשבונית חדשה
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Receipt size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">סה״כ חשבוניות</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.pendingAmount)}</p>
              <p className="text-sm text-gray-500">ממתין לתשלום</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.paidAmount)}</p>
              <p className="text-sm text-gray-500">שולם</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalAmount)}</p>
              <p className="text-sm text-gray-500">סה״כ הכנסות</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי מספר חשבונית או לקוח..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="draft">טיוטה</option>
              <option value="sent">נשלחה</option>
              <option value="paid">שולמה</option>
              <option value="cancelled">בוטלה</option>
            </select>
            <button
              onClick={loadData}
              className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={20} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">אין חשבוניות</p>
            <p className="text-sm text-gray-400 mt-1">צור חשבונית חדשה כדי להתחיל</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">מספר</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">לקוח</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">תאריך</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">סכום</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">סטטוס</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map((invoice) => {
                    const status = statusConfig[invoice.status]
                    const StatusIcon = status.icon
                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <span className="font-mono font-medium text-gray-800">
                            {invoice.invoice_number || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-gray-700">
                            {invoice.customer?.name || 'לקוח מזדמן'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-gray-600">
                            {formatDate(invoice.issued_at || invoice.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-medium text-gray-800">
                            {formatCurrency(invoice.total_amount)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium ${status.bgColor} ${status.color}`}>
                            <StatusIcon size={14} />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative">
                            <button
                              onClick={() => setActionMenuId(actionMenuId === invoice.id ? null : invoice.id)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical size={18} className="text-gray-500" />
                            </button>
                            
                            {actionMenuId === invoice.id && (
                              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-10">
                                <button
                                  onClick={() => openInvoiceDetails(invoice)}
                                  className="w-full px-4 py-2 text-right text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Eye size={16} />
                                  צפייה בפרטים
                                </button>
                                {invoice.status === 'draft' && (
                                  <button
                                    onClick={() => handleStatusChange(invoice.id, 'sent')}
                                    className="w-full px-4 py-2 text-right text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                  >
                                    <Send size={16} />
                                    סמן כנשלחה
                                  </button>
                                )}
                                {invoice.status === 'sent' && (
                                  <button
                                    onClick={() => handleStatusChange(invoice.id, 'paid')}
                                    className="w-full px-4 py-2 text-right text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                                  >
                                    <CheckCircle size={16} />
                                    סמן כשולמה
                                  </button>
                                )}
                                {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                                  <button
                                    onClick={() => handleStatusChange(invoice.id, 'cancelled')}
                                    className="w-full px-4 py-2 text-right text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <XCircle size={16} />
                                    בטל חשבונית
                                  </button>
                                )}
                                {invoice.status === 'draft' && (
                                  <button
                                    onClick={() => handleDelete(invoice.id)}
                                    className="w-full px-4 py-2 text-right text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 size={16} />
                                    מחק
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => {
                const status = statusConfig[invoice.status]
                const StatusIcon = status.icon
                return (
                  <div
                    key={invoice.id}
                    onClick={() => openInvoiceDetails(invoice)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-mono font-medium text-gray-800">
                          {invoice.invoice_number || '-'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {invoice.customer?.name || 'לקוח מזדמן'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${status.bgColor} ${status.color}`}>
                        <StatusIcon size={12} />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {formatDate(invoice.issued_at || invoice.created_at)}
                      </span>
                      <span className="font-bold text-gray-800">
                        {formatCurrency(invoice.total_amount)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* New Invoice Modal */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h2 className="font-bold text-lg">חשבונית חדשה</h2>
              <button
                onClick={() => setShowNewInvoiceModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">לקוח</label>
                <select
                  value={newInvoice.customerId}
                  onChange={(e) => setNewInvoice({ ...newInvoice, customerId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                >
                  <option value="">לקוח מזדמן</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                <input
                  type="text"
                  value={newInvoice.description}
                  onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })}
                  placeholder="שירותי גרירה"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סכום (לפני מע״מ) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                  <input
                    type="number"
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                    placeholder="0"
                    className="w-full pr-8 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>
              </div>

              {newInvoice.amount && (
                <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">סכום לפני מע״מ</span>
                    <span className="text-gray-700">₪{parseFloat(newInvoice.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">מע״מ (17%)</span>
                    <span className="text-gray-700">₪{(parseFloat(newInvoice.amount) * 0.17).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-gray-200 pt-2">
                    <span className="text-gray-700">סה״כ לתשלום</span>
                    <span className="text-gray-800">₪{(parseFloat(newInvoice.amount) * 1.17).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תאריך לתשלום</label>
                <input
                  type="date"
                  value={newInvoice.dueDate}
                  onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowNewInvoiceModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!newInvoice.amount || saving}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium disabled:bg-gray-300"
              >
                {saving ? 'יוצר...' : 'צור חשבונית'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-lg text-gray-800">חשבונית {selectedInvoice.invoice_number}</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig[selectedInvoice.status].bgColor} ${statusConfig[selectedInvoice.status].color}`}>
                  {statusConfig[selectedInvoice.status].label}
                </span>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Customer */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Building2 size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    {selectedInvoice.customer?.name || 'לקוח מזדמן'}
                  </p>
                  {selectedInvoice.customer?.phone && (
                    <p className="text-sm text-gray-500">{selectedInvoice.customer.phone}</p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">תאריך הפקה</p>
                  <p className="font-medium text-gray-800">
                    {formatDate(selectedInvoice.issued_at || selectedInvoice.created_at)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">תאריך לתשלום</p>
                  <p className="font-medium text-gray-800">
                    {formatDate(selectedInvoice.due_date)}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="font-medium text-gray-700 mb-2">פריטים</h3>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item) => (
                    <div key={item.id} className="flex justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-gray-700">{item.description}</span>
                      <span className="font-medium text-gray-800">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="p-4 bg-gray-800 rounded-xl text-white space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">סכום לפני מע״מ</span>
                  <span>{formatCurrency(selectedInvoice.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">מע״מ</span>
                  <span>{formatCurrency(selectedInvoice.vat_amount)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t border-gray-600 pt-2">
                  <span>סה״כ לתשלום</span>
                  <span>{formatCurrency(selectedInvoice.total_amount)}</span>
                </div>
              </div>

              {selectedInvoice.paid_at && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle size={18} />
                    <span className="font-medium">שולם בתאריך {formatDate(selectedInvoice.paid_at)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                סגור
              </button>
              {selectedInvoice.status === 'draft' && (
                <button
                  onClick={() => {
                    handleStatusChange(selectedInvoice.id, 'sent')
                    setShowInvoiceModal(false)
                  }}
                  className="flex-1 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  שלח ללקוח
                </button>
              )}
              {selectedInvoice.status === 'sent' && (
                <button
                  onClick={() => {
                    handleStatusChange(selectedInvoice.id, 'paid')
                    setShowInvoiceModal(false)
                  }}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  סמן כשולמה
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close action menu */}
      {actionMenuId && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActionMenuId(null)}
        />
      )}
    </div>
  )
}