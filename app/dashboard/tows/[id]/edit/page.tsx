'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getTowWithPoints } from '../../../../lib/queries/tows'
import { TowWithDetails } from '../../../../lib/queries/tows'

export default function EditTowPage() {
  const params = useParams()
  const router = useRouter()
  const towId = params.id as string
  const [tow, setTow] = useState<TowWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const data = await getTowWithPoints(towId)
      setTow(data)
      setLoading(false)
    }
    load()
  }, [towId])

  if (loading) return <div className="p-8 text-center text-gray-500">טוען...</div>
  if (!tow) return <div className="p-8 text-center text-red-500">גרירה לא נמצאה</div>

  return (
    <div>
      {/* כאן יבוא הטופס */}
      <p>עריכת גרירה {tow.order_number}</p>
    </div>
  )
}