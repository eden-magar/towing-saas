'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  addTowInternalNote,
  listTowInternalNotes,
} from '../../lib/queries/tow-internal-notes'
import type { TowInternalNote } from '../../lib/types'

function formatNoteTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type TowInternalNotesCardProps = {
  towId: string
}

export function TowInternalNotesCard({ towId }: TowInternalNotesCardProps) {
  const { user, companyId } = useAuth()
  const canAccess =
    user?.role === 'company_admin' || user?.role === 'dispatcher'

  const [notes, setNotes] = useState<TowInternalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    if (!canAccess || !towId) return
    try {
      setError(null)
      const rows = await listTowInternalNotes(towId)
      setNotes(rows)
    } catch (err) {
      console.error(err)
      setError('שגיאה בטעינת הערות פנימיות')
    } finally {
      setLoading(false)
    }
  }, [canAccess, towId])

  useEffect(() => {
    if (!canAccess) return
    setLoading(true)
    void loadNotes()
  }, [canAccess, loadNotes])

  // Realtime: staff-only RLS; refetch on any change for this tow
  useEffect(() => {
    if (!canAccess || !towId) return

    const channel = supabase
      .channel(`tow-internal-notes-${towId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tow_internal_notes',
          filter: `tow_id=eq.${towId}`,
        },
        () => {
          void loadNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [canAccess, towId, loadNotes])

  if (!canAccess) return null

  const handleSubmit = async () => {
    if (!companyId || submitting) return
    const trimmed = draft.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)
    try {
      await addTowInternalNote({
        towId,
        companyId,
        body: trimmed,
      })
      setDraft('')
      await loadNotes()
    } catch (err) {
      console.error(err)
      setError('שגיאה בהוספת הערה')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="font-bold text-gray-800">הערות פנימיות</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          גלוי רק למשתמשי המשרד — לא לנהגים ולא לפורטל הלקוח
        </p>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length > 0 ? (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="border border-gray-100 rounded-xl p-3 text-sm"
                dir="rtl"
              >
                <div className="flex justify-between items-start gap-3">
                  <p className="text-gray-800 whitespace-pre-wrap break-words min-w-0">
                    {note.body}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatNoteTimestamp(note.created_at)}
                  </span>
                </div>
                {note.author?.full_name && (
                  <div className="mt-1 text-xs text-gray-400">
                    על ידי {note.author.full_name}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-2">אין הערות פנימיות</p>
        )}

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="כתוב הערה פנימית..."
            disabled={submitting}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] text-sm"
            dir="rtl"
          />
          <div className="flex items-center justify-between gap-3">
            {error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !draft.trim() || !companyId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#33d4ff] text-white text-sm font-medium hover:bg-[#2bb8e0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              הוסף הערה
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
