'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import { ServiceWorkerCleanup } from '../components/ServiceWorkerCleanup'
import { useAuth } from '../lib/AuthContext'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!session?.user || !user) {
      router.push('/login')
    }
  }, [loading, session, user, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען...</p>
        </div>
      </div>
    )
  }

  if (!session?.user || !user) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <ServiceWorkerCleanup />
      <Sidebar />
      <main className="flex-1 min-w-0 bg-gray-100 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardContent>{children}</DashboardContent>
  )
}
