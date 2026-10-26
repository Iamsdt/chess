import { now, ok, type Fen, type Result } from '@/domain'

import { newNoteId, runWrite, writeValidated } from '../internal'
import { CoachNoteSchema, type CoachNote } from '../schema'

import type { ChessKingDb } from '../db'

/**
 * Takeaways the user asked Sage to keep.
 *
 * Why a note is written only by a confirmed action card: Sage proposes (`saveNote`), the user
 * confirms, and whoever handles the confirm calls `add`. Nothing in the tool path writes here.
 */
export interface NewCoachNote {
  readonly text: string
  readonly screen?: string
  readonly fen?: Fen
}

export interface CoachNotesRepository {
  add: (note: NewCoachNote) => Promise<Result<CoachNote>>
  /** Newest first. */
  list: (limit?: number) => Promise<CoachNote[]>
  remove: (id: string) => Promise<Result<void>>
  clear: () => Promise<Result<void>>
}

export function createCoachNotesRepository(db: ChessKingDb): CoachNotesRepository {
  return {
    add: (note) =>
      writeValidated(
        CoachNoteSchema,
        { ...note, text: note.text.trim(), id: newNoteId(), createdAt: now() },
        'coachNotes.add',
        async (validated) => {
          await db.coachNotes.put(validated)
          return validated
        },
      ),

    list: async (limit = 200) => {
      const rows = await db.coachNotes.orderBy('createdAt').reverse().limit(limit).toArray()
      return rows.flatMap((row) => {
        const parsed = CoachNoteSchema.safeParse(row)
        return parsed.success ? [parsed.data] : []
      })
    },

    remove: async (id) => {
      const removed = await runWrite('coachNotes.remove', () => db.coachNotes.delete(id))
      return removed.ok ? ok(undefined) : removed
    },

    clear: () => runWrite('coachNotes.clear', () => db.coachNotes.clear()),
  }
}
