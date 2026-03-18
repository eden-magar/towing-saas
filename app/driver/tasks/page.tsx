'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { getDriverByUserId } from '@/app/lib/queries/driver-tasks'
import { getDriverTasksForDriver } from '@/app/lib/queries/driver-tasks-admin'
import { DriverTaskWithDetails } from '@/app/lib/types'
import { ClipboardList, Clock, MapPin, ChevronLeft } from 'lucide-react'

export default function DriverTasksPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [tasks, setTasks] = useState<DriverTaskWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadTasks()
  }, [user])

  async function loadTasks() {
    if (!user) return
    setLoading(true)
    try {
      const driver = await getDriverByUserId(user.id)
      if (!driver) return
      const t = await getDriverTasksForDriver(driver.id)
      setTasks(t)
    } finally {
      setLoading(false)
    }
  }

  const activeTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'rejected')
  const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'rejected')

  function isOverdue(due: string, status: string) {
    if (status === 'done' || status === 'rejected') return false
    return new Date(due) < new Date()
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 pt-6 pb-8">
        <h1 className="text-white text-xl font-bold">המשימות שלי</h1>
        <p className="text-blue-100 text-sm mt-1">
          {activeTasks.length} משימות פעילות
        </p>
      </div>

      <div className="px-4 -mt-4 flex flex-col gap-3">

        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm shadow-sm">
            טוען...
          </div>
        ) : activeTasks.length === 0 && doneTasks.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-3 shadow-sm">
            <ClipboardList size={40} className="text-gray-200" />
            <div className="text-gray-400 text-sm font-medium">אין משימות פעילות</div>
            <div className="text-gray-300 text-xs">תיהנה מההפסקה!</div>
          </div>
        ) : (
          <>
            {activeTasks.length > 0 && (
              <div className="flex flex-col gap-3">
                {activeTasks.map(task => {
                  const overdue = isOverdue(task.due_at, task.status)
                  return (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/driver/task-item/${task.id}`)}
                      className={`bg-white rounded-2xl p-4 shadow-sm border cursor-pointer active:scale-[0.98] transition-transform ${
                        overdue ? 'border-red-200' : 'border-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {task.task_type && (
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: task.task_type.color }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 text-sm">
                              {task.task_type?.name || 'משימה'}
                              {task.task_subtype && (
                                <span className="text-gray-400 font-normal"> · {task.task_subtype.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                          <ChevronLeft size={16} className="text-gray-300" />
                        </div>
                      </div>

                      <div className={`flex items-center gap-1.5 mt-2 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                        <Clock size={12} />
                        {new Date(task.due_at).toLocaleString('he-IL', {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {overdue && ' ⚠ עבר הזמן'}
                      </div>

                      {task.location_address && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                          <MapPin size={12} />
                          <span className="truncate">{task.location_address}</span>
                        </div>
                      )}

                      {task.description && (
                        <div className="mt-2 text-xs text-gray-400 line-clamp-1">
                          {task.description}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {doneTasks.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="text-xs text-gray-400 px-1">הושלמו / נדחו</div>
                {doneTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {task.task_type && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: task.task_type.color }}
                          />
                        )}
                        <span className="text-sm text-gray-600">
                          {task.task_type?.name || 'משימה'}
                          {task.task_subtype && ` · ${task.task_subtype.name}`}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </div>
                    {task.completed_at && (
                      <div className="text-xs text-gray-400 mt-1.5">
                        {new Date(task.completed_at).toLocaleString('he-IL', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}