'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { getDriverByUserId } from '@/app/lib/queries/driver-tasks'
import {
  getDriverTasksForDriver,
  updateDriverTaskStatus,
} from '@/app/lib/queries/driver-tasks-admin'
import { DriverTaskWithDetails } from '@/app/lib/types'
import {
  ChevronRight,
  Phone,
  Navigation,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  User,
  MapPin,
  MessageSquare,
  AlertCircle,
} from 'lucide-react'

function openWaze(address: string) {
  const encoded = encodeURIComponent(address)
  window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank')
}

function openPhone(phone: string) {
  window.open(`tel:${phone}`)
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  accepted: 'התקבל',
  in_progress: 'בביצוע',
  done: 'הושלם',
  rejected: 'נדחה',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function DriverTaskItemPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [task, setTask] = useState<DriverTaskWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // reject flow
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // complete flow
  const [showCompleteInput, setShowCompleteInput] = useState(false)
  const [completionNote, setCompletionNote] = useState('')

  useEffect(() => {
    if (user) loadTask()
  }, [user])

  async function loadTask() {
    if (!user) return
    setLoading(true)
    try {
      const driver = await getDriverByUserId(user.id)
      if (!driver) return
      const tasks = await getDriverTasksForDriver(driver.id)
      const found = tasks.find(t => t.id === id)
      setTask(found || null)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!task) return
    setSaving(true)
    try {
      await updateDriverTaskStatus(task.id, 'accepted')
      await loadTask()
    } finally {
      setSaving(false)
    }
  }

  async function handleStart() {
    if (!task) return
    setSaving(true)
    try {
      await updateDriverTaskStatus(task.id, 'in_progress')
      await loadTask()
    } finally {
      setSaving(false)
    }
  }

  async function handleReject() {
    if (!task || !rejectReason.trim()) return
    setSaving(true)
    try {
      await updateDriverTaskStatus(task.id, 'rejected', {
        rejected_reason: rejectReason.trim(),
      })
      router.back()
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete() {
    if (!task) return
    setSaving(true)
    try {
      await updateDriverTaskStatus(task.id, 'done', {
        completion_note: completionNote.trim() || undefined,
        completed_at: new Date().toISOString(),
      })
      router.back()
    } finally {
      setSaving(false)
    }
  }

  function isOverdue(due: string) {
    return new Date(due) < new Date()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">טוען...</div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <AlertCircle className="text-gray-300" size={40} />
        <div className="text-gray-400 text-sm">משימה לא נמצאה</div>
        <button onClick={() => router.back()} className="text-blue-600 text-sm">
          חזור
        </button>
      </div>
    )
  }

  const overdue = isOverdue(task.due_at)

  return (
    <div className="min-h-screen bg-gray-50 pb-32" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500">
          <ChevronRight size={24} />
        </button>
        <div className="flex-1">
          <div className="font-medium text-gray-800">
            {task.task_type?.name || 'משימה'}
            {task.task_subtype && (
              <span className="text-gray-400 font-normal"> · {task.task_subtype.name}</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            נוצר ע"י {task.created_by_user?.full_name || '—'}
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">

        {/* יעד */}
        <div className={`bg-white rounded-2xl p-4 border ${overdue ? 'border-red-200' : 'border-gray-100'}`}>
          <div className={`flex items-center gap-2 ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
            <Clock size={16} />
            <span className="text-sm font-medium">
              {new Date(task.due_at).toLocaleString('he-IL', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {overdue && <span className="text-xs text-red-500">⚠ עבר הזמן</span>}
          </div>
        </div>

        {/* כתובת + ניווט */}
        {task.location_address && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-start gap-2 text-gray-700 mb-3">
              <MapPin size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <span className="text-sm">{task.location_address}</span>
            </div>
            <button
              onClick={() => openWaze(task.location_address!)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium"
            >
              <Navigation size={16} />
              נווט עם Waze
            </button>
          </div>
        )}

        {/* איש קשר */}
        {(task.contact_name || task.contact_phone) && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-700 mb-3">
              <User size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm">{task.contact_name || '—'}</span>
            </div>
            {task.contact_phone && (
              <button
                onClick={() => openPhone(task.contact_phone!)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-600 rounded-xl text-sm font-medium"
              >
                <Phone size={16} />
                {task.contact_phone}
              </button>
            )}
          </div>
        )}

        {/* גרר */}
        {task.truck && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-2 text-gray-700">
            <Truck size={16} className="text-gray-400" />
            <span className="text-sm">גרר {task.truck.plate_number}</span>
          </div>
        )}

        {/* תיאור */}
        {task.description && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-start gap-2 text-gray-700">
              <MessageSquare size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm leading-relaxed">{task.description}</p>
            </div>
          </div>
        )}

        {/* דחייה עם סיבה */}
        {showRejectInput && (
          <div className="bg-white rounded-2xl p-4 border border-red-100 flex flex-col gap-3">
            <div className="text-sm font-medium text-red-700">סיבת דחייה</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="הסבר מדוע אתה דוחה את המשימה..."
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || saving}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'שולח...' : 'אשר דחייה'}
              </button>
              <button
                onClick={() => setShowRejectInput(false)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* סיום עם הערה */}
        {showCompleteInput && (
          <div className="bg-white rounded-2xl p-4 border border-green-100 flex flex-col gap-3">
            <div className="text-sm font-medium text-green-700">סיום משימה</div>
            <textarea
              value={completionNote}
              onChange={e => setCompletionNote(e.target.value)}
              rows={3}
              placeholder="הערות סיום (אופציונלי)..."
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'שומר...' : 'סיים משימה'}
              </button>
              <button
                onClick={() => setShowCompleteInput(false)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600"
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>

      {/* כפתורי פעולה */}
      <div className="fixed bottom-20 right-0 left-0 px-4 flex flex-col gap-2">
        {task.status === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-medium disabled:opacity-40"
            >
              <CheckCircle size={18} />
              קבל משימה
            </button>
            <button
              onClick={() => { setShowRejectInput(true); setShowCompleteInput(false) }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 border border-red-200 text-red-600 rounded-2xl text-sm font-medium bg-white"
            >
              <XCircle size={18} />
              דחה
            </button>
          </div>
        )}

        {task.status === 'accepted' && (
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-medium disabled:opacity-40"
            >
              התחל ביצוע
            </button>
            <button
              onClick={() => { setShowRejectInput(true); setShowCompleteInput(false) }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 border border-red-200 text-red-600 rounded-2xl text-sm font-medium bg-white"
            >
              <XCircle size={18} />
              דחה
            </button>
          </div>
        )}

        {task.status === 'in_progress' && (
          <button
            onClick={() => { setShowCompleteInput(true); setShowRejectInput(false) }}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-500 text-white rounded-2xl text-sm font-medium"
          >
            <CheckCircle size={18} />
            סיים משימה
          </button>
        )}
      </div>
    </div>
  )
}