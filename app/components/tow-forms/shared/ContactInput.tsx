'use client'

interface ContactInputProps {
  title: string
  name: string
  phone: string
  onNameChange: (name: string) => void
  onPhoneChange: (phone: string) => void
  onCopyFromCustomer?: () => void
  showCopyButton?: boolean
}

export function ContactInput({
  title,
  name,
  phone,
  onNameChange,
  onPhoneChange,
  onCopyFromCustomer,
  showCopyButton = true
}: ContactInputProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <h4 className="font-medium text-gray-700 mb-3 text-sm">{title}</h4>
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="שם"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
        />
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="טלפון"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
          />
          {showCopyButton && onCopyFromCustomer && (
            <button
              type="button"
              onClick={onCopyFromCustomer}
              className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-100 whitespace-nowrap"
            >
              זהה ללקוח
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
