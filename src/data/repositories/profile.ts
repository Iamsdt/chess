import {
  domainError,
  err,
  now,
  ok,
  parseValid,
  ProfileSchema,
  type Profile,
  type Result,
} from '@/domain'

import { runWrite, writeValidated } from '../internal'

import type { ChessKingDb } from '../db'

/**
 * The single local user.
 *
 * There is one row and no account. `get` returns `undefined` before onboarding
 * has run, which is exactly the signal the first-run flow needs, so unlike
 * settings this one is not defaulted for you.
 */
export interface ProfileRepository {
  get: () => Promise<Profile | undefined>
  save: (profile: Profile) => Promise<Result<Profile>>
  update: (patch: Partial<Profile>) => Promise<Result<Profile>>
  /** S23's "clear all"; onboarding runs again afterwards. */
  clear: () => Promise<Result<void>>
}

export function createProfileRepository(db: ChessKingDb): ProfileRepository {
  const read = (): Promise<Profile | undefined> => db.profile.orderBy('id').first()

  return {
    get: read,

    save: (profile) =>
      writeValidated(ProfileSchema, profile, 'profile.save', async (validated) => {
        await db.profile.put(validated)
        return validated
      }),

    update: async (patch) => {
      const outcome = await runWrite('profile.update', () =>
        db.transaction('rw', db.profile, async (): Promise<Result<Profile>> => {
          const existing = await db.profile.orderBy('id').first()
          if (existing === undefined) {
            return err(
              domainError('not-found', 'No profile yet; onboarding writes it first', {
                where: 'profile.update',
              }),
            )
          }
          const parsed = parseValid(
            ProfileSchema,
            { ...existing, ...patch, updatedAt: patch.updatedAt ?? now() },
            'profile.update',
          )
          if (!parsed.ok) return parsed
          await db.profile.put(parsed.value)
          return ok(parsed.value)
        }),
      )
      return outcome.ok ? outcome.value : outcome
    },

    clear: () =>
      runWrite('profile.clear', async () => {
        await db.profile.clear()
      }),
  }
}
