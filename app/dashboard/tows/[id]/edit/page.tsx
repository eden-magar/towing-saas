'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function EditTowPage() {
  const params = useParams()
  const router = useRouter()
  const towId = params.id as string

  useEffect(() => {
    router.replace(`/dashboard/tows/new?edit=${towId}`)
  }, [towId, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">טוען...</div>
    </div>
  )
}