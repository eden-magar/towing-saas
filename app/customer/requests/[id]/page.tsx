'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { CustomerTowRequestDetailsPanel } from '@/app/components/tow-forms/CustomerTowRequestDetailsPanel'

/**
 * Read-only view of a pending customer tow request (own requests only via RLS).
 * Mirrors /customer/tows/[id] navigation from the portal home list.
 */
export default function CustomerRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = typeof params.id === 'string' ? params.id : ''

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4 pb-10">
      <button
        type="button"
        onClick={() => router.push('/customer')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowRight size={16} />
        חזרה לרשימה
      </button>

      <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h1 className="text-base font-bold text-gray-900">פרטי בקשה</h1>
          <p className="text-xs text-gray-500 mt-0.5">ממתין לאישור החברה · לצפייה בלבד</p>
        </div>
        {requestId ? (
          <CustomerTowRequestDetailsPanel
            requestId={requestId}
            embedded
            className="bg-white"
          />
        ) : (
          <p className="p-4 text-sm text-gray-500">בקשה לא נמצאה</p>
        )}
      </div>
    </div>
  )
}
