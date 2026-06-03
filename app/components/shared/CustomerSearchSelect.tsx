'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '../ui'

export interface CustomerSearchOption {
  id: string
  name: string
  phone: string
  id_number?: string
}

export interface CustomerSearchSelectProps {
  customers: CustomerSearchOption[]
  value: string | null
  onSelect: (customerId: string | null, name: string, phone: string) => void
  placeholder?: string
  allowClear?: boolean
  disabled?: boolean
}

export function CustomerSearchSelect({
  customers,
  value,
  onSelect,
  placeholder = 'חפש לפי שם, טלפון, ת.ז...',
  allowClear = true,
  disabled = false,
}: CustomerSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const selectedCustomer = useMemo(
    () => (value ? customers.find((c) => c.id === value) ?? null : null),
    [customers, value]
  )

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim()
    if (!q) return customers
    return customers.filter((c) => {
      return (
        (c.name?.toLowerCase() ?? '').includes(q.toLowerCase()) ||
        (c.phone?.includes(q) ?? false) ||
        (c.id_number?.includes(q) ?? false)
      )
    })
  }, [customers, searchTerm])

  const showCustomerList = (isFocused || searchTerm.length > 0) && !disabled

  const inputValue =
    searchTerm.length > 0 ? searchTerm : (selectedCustomer?.name ?? '')

  const handleSelect = (customer: CustomerSearchOption) => {
    onSelect(customer.id, customer.name || '', customer.phone || '')
    setSearchTerm('')
    setIsFocused(false)
  }

  const handleClear = () => {
    onSelect(null, '', '')
    setSearchTerm('')
    setIsFocused(false)
  }

  return (
    <div dir="rtl" className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="נקה בחירת לקוח"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-9 text-right ${allowClear && value ? 'pr-9' : 'pr-3'}`}
        />
      </div>

      {showCustomerList && (
        <div className="absolute z-50 right-0 left-0 top-full mt-1 max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white shadow-lg">
          {filteredCustomers.slice(0, 10).map((customer) => (
            <button
              key={customer.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(customer)}
              className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors text-right"
            >
              <span className="text-xs text-gray-400">{customer.phone}</span>
              <span className="text-sm text-gray-800 font-medium">{customer.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
