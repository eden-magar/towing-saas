import { supabase } from '../supabase'
import type { TowInternalNote } from '../types'

type NoteRow = {
  id: string
  company_id: string
  tow_id: string
  author_id: string
  body: string
  created_at: string
  author: { full_name: string } | { full_name: string }[] | null
}

function mapNote(row: NoteRow): TowInternalNote {
  const author = Array.isArray(row.author) ? row.author[0] : row.author
  return {
    id: row.id,
    company_id: row.company_id,
    tow_id: row.tow_id,
    author_id: row.author_id,
    body: row.body,
    created_at: row.created_at,
    author: author ?? undefined,
  }
}

const NOTE_SELECT = `
  id,
  company_id,
  tow_id,
  author_id,
  body,
  created_at,
  author:users!tow_internal_notes_author_id_fkey!inner (
    full_name
  )
`

export async function listTowInternalNotes(towId: string): Promise<TowInternalNote[]> {
  const { data, error } = await supabase
    .from('tow_internal_notes')
    .select(NOTE_SELECT)
    .eq('tow_id', towId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error listing tow internal notes:', error)
    throw error
  }

  return ((data ?? []) as NoteRow[]).map(mapNote)
}

export async function addTowInternalNote(params: {
  towId: string
  companyId: string
  body: string
}): Promise<TowInternalNote> {
  const trimmed = params.body.trim()
  if (!trimmed) {
    throw new Error('תוכן ההערה ריק')
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('Error resolving auth user for internal note:', authError)
    throw authError
  }
  if (!user) {
    throw new Error('לא מחובר')
  }

  const { data, error } = await supabase
    .from('tow_internal_notes')
    .insert({
      tow_id: params.towId,
      company_id: params.companyId,
      author_id: user.id,
      body: trimmed,
    })
    .select(NOTE_SELECT)
    .single()

  if (error) {
    console.error('Error adding tow internal note:', error)
    throw error
  }

  return mapNote(data as NoteRow)
}
