'use client'

import { useEffect, useState, useRef } from 'react'
import { loadGoogleMaps } from '@/app/lib/google-maps'
import { TimeInput } from '@/app/components/ui/TimeInput'
import { useAuth } from '@/app/lib/AuthContext'
import {
  getDriverTasks,
  createDriverTask,
  updateDriverTask,
  deleteDriverTask,
  getTaskTypes,
  createTaskType,
  getTaskSubtypes,
  createTaskSubtype,
} from '@/app/lib/queries/driver-tasks-admin'
import { getDrivers } from '@/app/lib/queries/drivers'
import { PhoneInput } from '@/app/components/ui/PhoneInput'
import { getTrucks } from '@/app/lib/queries/trucks'
import {
  DriverTaskWithDetails,
  TaskType,
  TaskSubtype,
  DriverWithDetails,
  TruckWithDetails,
} from '@/app/lib/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  accepted: 'התקבל',
  in_progress: 'בביצוע',
  done: 'הושלם',
  rejected: 'נדחה',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  accepted: 'bg-blue-50 text-blue-800',
  in_progress: 'bg-purple-50 text-purple-800',
  done: 'bg-green-50 text-green-800',
  rejected: 'bg-red-50 text-red-800',
}

function isOverdue(due: string, status: string) {
  if (status === 'done' || status === 'rejected') return false
  return new Date(due) < new Date()
}

export default function TasksPage() {
  const { user, companyId } = useAuth()
  const [tasks, setTasks] = useState<DriverTaskWithDetails[]>([])
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [subtypes, setSubtypes] = useState<TaskSubtype[]>([])
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTask, setSelectedTask] = useState<DriverTaskWithDetails | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // form state
  const [fTypeId, setFTypeId] = useState('')
  const [fSubtypeId, setFSubtypeId] = useState('')
  const [fDriverId, setFDriverId] = useState('')
  const [fTruckId, setFTruckId] = useState('')
  const [fDescription, setFDescription] = useState('')
  const [fAddress, setFAddress] = useState('')
  const [fLat, setFLat] = useState<number | null>(null)
  const [fLng, setFLng] = useState<number | null>(null)
  const [fContactName, setFContactName] = useState('')
  const [fContactPhone, setFContactPhone] = useState('')
  const [fDueDate, setFDueDate] = useState('')
  const [fDueTime, setFDueTime] = useState('')

  // new type/subtype
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeColor, setNewTypeColor] = useState('#378ADD')
  const [newSubtypeName, setNewSubtypeName] = useState('')
  const [showNewType, setShowNewType] = useState(false)

  const addressInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (!companyId) return
    loadAll()
  }, [companyId])

  useEffect(() => {
    if (!fTypeId) return
    loadSubtypes(fTypeId)
    setFSubtypeId('')
  }, [fTypeId])

  useEffect(() => {
  if (!panelOpen) return
  autocompleteRef.current = null

  const initAutocomplete = async () => {
    await loadGoogleMaps()
    if (!addressInputRef.current || !window.google?.maps?.places || autocompleteRef.current) return

    const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      componentRestrictions: { country: 'il' },
      fields: ['formatted_address', 'geometry'],
      types: ['establishment', 'geocode'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.formatted_address) return
      setFAddress(place.formatted_address)
      setFLat(place.geometry?.location?.lat() ?? null)
      setFLng(place.geometry?.location?.lng() ?? null)
    })

    autocompleteRef.current = autocomplete
  }

  initAutocomplete()
}, [panelOpen])

  async function loadAll() {
    if (!companyId) return
    setLoading(true)
    try {
      const [t, tt, d, tr] = await Promise.all([
        getDriverTasks(companyId),
        getTaskTypes(companyId),
        getDrivers(companyId),
        getTrucks(companyId),
      ])
      setTasks(t)
      setTaskTypes(tt)
      setDrivers(d)
      setTrucks(tr)
    } finally {
      setLoading(false)
    }
  }

  async function loadSubtypes(typeId: string) {
    if (!companyId) return
    const s = await getTaskSubtypes(companyId, typeId)
    setSubtypes(s)
  }

  function openNew() {
    setSelectedTask(null)
    setFTypeId('')
    setFSubtypeId('')
    setFDriverId('')
    setFTruckId('')
    setFDescription('')
    setFAddress('')
    setFLat(null)
    setFLng(null)
    setFContactName('')
    setFContactPhone('')
    setFDueDate('')
    setFDueTime('')
    setSubtypes([])
    autocompleteRef.current = null
    setPanelOpen(true)
  }

  function openEdit(task: DriverTaskWithDetails) {
    setSelectedTask(task)
    setFTypeId(task.task_type_id || '')
    setFSubtypeId(task.task_subtype_id || '')
    setFDriverId(task.driver_id || '')
    setFTruckId(task.truck_id || '')
    setFDescription(task.description || '')
    setFAddress(task.location_address || '')
    setFLat(task.location_lat)
    setFLng(task.location_lng)
    setFContactName(task.contact_name || '')
    setFContactPhone(task.contact_phone || '')
    if (task.due_at) {
      const d = new Date(task.due_at)
      setFDueDate(d.toISOString().split('T')[0])
      setFDueTime(d.toTimeString().slice(0, 5))
    }
    if (task.task_type_id) loadSubtypes(task.task_type_id)
    autocompleteRef.current = null
    setPanelOpen(true)
  }

  async function handleSave() {
    if (!companyId || !user) return
    if (!fDueDate || !fDueTime) return alert('יש למלא תאריך ושעת יעד')
    setSaving(true)
    try {
      const due_at = new Date(`${fDueDate}T${fDueTime}:00`).toISOString()
      const payload = {
        task_type_id: fTypeId || null,
        task_subtype_id: fSubtypeId || null,
        driver_id: fDriverId || null,
        truck_id: fTruckId || null,
        description: fDescription || null,
        location_address: fAddress || null,
        location_lat: fLat,
        location_lng: fLng,
        contact_name: fContactName || null,
        contact_phone: fContactPhone || null,
        due_at,
      }
      if (selectedTask) {
        await updateDriverTask(selectedTask.id, payload)
      } else {
        await createDriverTask({
          company_id: companyId,
          created_by: user.id,
          title: null,
          ...payload,
        })
      }
      await loadAll()
      setPanelOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedTask) return
    if (!confirm('למחוק את המשימה?')) return
    await deleteDriverTask(selectedTask.id)
    await loadAll()
    setPanelOpen(false)
  }

  async function handleAddType() {
    if (!companyId || !newTypeName.trim()) return
    const t = await createTaskType(companyId, newTypeName.trim(), newTypeColor)
    setTaskTypes(prev => [...prev, t])
    setFTypeId(t.id)
    setNewTypeName('')
    setShowNewType(false)
  }

  async function handleAddSubtype() {
    if (!companyId || !fTypeId || !newSubtypeName.trim()) return
    const s = await createTaskSubtype(companyId, fTypeId, newSubtypeName.trim())
    setSubtypes(prev => [...prev, s])
    setFSubtypeId(s.id)
    setNewSubtypeName('')
  }

  const createdByName = selectedTask?.created_by_user?.full_name || user?.full_name || ''

  return (
    <div className="p-6 flex gap-6 h-full" dir="rtl">
      {/* טבלה */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-medium">משימות נהגים</h1>
            <p className="text-sm text-gray-500 mt-0.5">לחץ על שורה לצפייה ועריכה</p>
          </div>
          <button
            onClick={openNew}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            + משימה חדשה
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">טוען...</div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">אין משימות עדיין</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">משימה ראשית</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">תת-משימה</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">משובץ ל</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">יעד</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">נוצר ע"י</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const overdue = isOverdue(task.due_at, task.status)
                  const isSelected = selectedTask?.id === task.id
                  return (
                    <tr
                      key={task.id}
                      onClick={() => openEdit(task)}
                      className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {task.task_type && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: task.task_type.color }}
                            />
                          )}
                          <span className="font-medium">{task.task_type?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{task.task_subtype?.name || '—'}</td>
                      <td className="px-4 py-3">{task.driver?.user?.full_name || '—'}</td>
                      <td className={`px-4 py-3 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {new Date(task.due_at).toLocaleString('he-IL', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                        {overdue && ' ⚠'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {task.created_by_user?.full_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                          {STATUS_LABELS[task.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* פאנל צד */}
      {panelOpen && (
        <div className="w-80 flex-shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col max-h-[calc(100vh-7rem)] sticky top-6">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {selectedTask ? 'עריכת משימה' : 'משימה חדשה'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                selectedTask ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'
              }`}>
                {selectedTask ? 'עריכה' : 'חדשה'}
              </span>
            </div>
            <button onClick={() => setPanelOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

            {/* סוג משימה */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">סוג משימה ראשי</label>
              <select
                value={fTypeId}
                onChange={e => { setFTypeId(e.target.value); setShowNewType(false) }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">בחר סוג...</option>
                {taskTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {!showNewType ? (
                <button
                  onClick={() => setShowNewType(true)}
                  className="text-xs text-blue-600 text-right hover:underline w-fit"
                >
                  + הוסף סוג חדש
                </button>
              ) : (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    placeholder="שם הסוג..."
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 focus:outline-none"
                  />
                  <input
                    type="color"
                    value={newTypeColor}
                    onChange={e => setNewTypeColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                  />
                  <button
                    onClick={handleAddType}
                    className="text-xs bg-gray-900 text-white px-2 py-1.5 rounded-lg"
                  >
                    שמור
                  </button>
                </div>
              )}
            </div>

            {/* תת-סוג */}
            {fTypeId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">תת-משימה</label>
                <select
                  value={fSubtypeId}
                  onChange={e => setFSubtypeId(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">בחר תת-משימה...</option>
                  {subtypes.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtypeName}
                    onChange={e => setNewSubtypeName(e.target.value)}
                    placeholder="הוסף תת-משימה חדשה..."
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 focus:outline-none"
                  />
                  <button
                    onClick={handleAddSubtype}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-200"
                  >
                    + שמור
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-gray-100" />

            {/* נהג */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">שייך לנהג</label>
              <select
                value={fDriverId}
                onChange={e => setFDriverId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">בחר נהג...</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.user?.full_name}</option>
                ))}
              </select>
            </div>

            {/* תאריך ושעה */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">תאריך יעד</label>
                <input
                  type="date"
                  value={fDueDate}
                  onChange={e => setFDueDate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">שעת יעד</label>
                <TimeInput
                  value={fDueTime}
                  onChange={setFDueTime}
                  className="border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* תיאור */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">תיאור / הוראות לנהג</label>
              <textarea
                value={fDescription}
                onChange={e => setFDescription(e.target.value)}
                rows={3}
                placeholder="פרטים, הוראות מיוחדות..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              />
              {createdByName && (
                <p className="text-xs text-gray-400">נוצר ע"י: {createdByName}</p>
              )}
            </div>

            {/* כתובת */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">כתובת (לניווט)</label>
              <input
                ref={addressInputRef}
                type="text"
                value={fAddress}
                onChange={e => { setFAddress(e.target.value); setFLat(null); setFLng(null) }}
                placeholder="הכנס כתובת..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            {/* איש קשר */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">שם איש קשר</label>
                <input
                  type="text"
                  value={fContactName}
                  onChange={e => setFContactName(e.target.value)}
                  placeholder="שם..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">טלפון</label>
                <PhoneInput
                  value={fContactPhone}
                  onChange={(phone) => setFContactPhone(phone)}
                  placeholder="050-..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* גרר */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">גרר (אופציונלי)</label>
              <select
                value={fTruckId}
                onChange={e => setFTruckId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">— ללא —</option>
                {trucks.map(t => (
                  <option key={t.id} value={t.id}>{t.plate_number}</option>
                ))}
              </select>
            </div>

          </div>

          <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'שומר...' : selectedTask ? 'שמור שינויים' : 'צור משימה'}
            </button>
            {selectedTask && (
              <button
                onClick={handleDelete}
                className="px-3 py-2 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50"
              >
                מחק
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}