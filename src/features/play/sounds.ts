import type { SoundSettings } from '@/domain'

/**
 * Move sounds, synthesised.
 *
 * **Why there are no audio files.** This repository ships no audio assets, and
 * inventing paths to files that do not exist would give the app a silent failure
 * on every move. The Web Audio API can make the four sounds a chess board needs
 * out of an oscillator and a gain envelope: a short muted knock for a move, a
 * brighter and louder one for a capture, a rising two-note figure for check, and a
 * falling one when the game ends. They are small, they are offline by
 * construction, and they can be tuned by changing numbers rather than by
 * re-recording.
 *
 * Everything is lazy and forgiving: the `AudioContext` is created on the first
 * sound (browsers refuse one before a gesture), a browser without Web Audio simply
 * gets silence, and `enabled: false` never constructs anything at all.
 */

export type PlaySound =
  'move' | 'capture' | 'check' | 'castle' | 'promote' | 'game-end' | 'low-time'

export interface SoundPlayer {
  play: (sound: PlaySound) => void
  /** Call on unmount; an orphaned `AudioContext` keeps the audio hardware awake. */
  close: () => void
}

interface Tone {
  /** Hertz, in order; more than one makes a short figure. */
  readonly notes: readonly number[]
  readonly durationMs: number
  readonly type: OscillatorType
  /** Relative loudness before the user's volume is applied. */
  readonly gain: number
}

const TONES: Readonly<Record<PlaySound, Tone>> = {
  move: { notes: [196], durationMs: 70, type: 'triangle', gain: 0.5 },
  capture: { notes: [130, 98], durationMs: 110, type: 'square', gain: 0.65 },
  check: { notes: [587, 784], durationMs: 130, type: 'triangle', gain: 0.6 },
  castle: { notes: [220, 262], durationMs: 100, type: 'triangle', gain: 0.5 },
  promote: { notes: [523, 659, 784], durationMs: 150, type: 'sine', gain: 0.6 },
  'game-end': { notes: [392, 330, 262], durationMs: 220, type: 'sine', gain: 0.7 },
  'low-time': { notes: [880, 880], durationMs: 90, type: 'square', gain: 0.5 },
}

/** The three styles in settings, as a timbre and a loudness, not three sample packs. */
const STYLE_GAIN: Readonly<Record<SoundSettings['style'], number>> = {
  wood: 1,
  soft: 0.6,
  minimal: 0.35,
}

type AudioContextConstructor = new () => AudioContext

/** Why feature-detected rather than assumed: jsdom has no Web Audio at all, and
 *  older Safari only has the prefixed constructor. */
function audioContextConstructor(): AudioContextConstructor | null {
  const scope = globalThis as {
    AudioContext?: AudioContextConstructor
    webkitAudioContext?: AudioContextConstructor
  }
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}

export interface SoundPlayerOptions {
  /** Read fresh on every sound, so flipping the switch takes effect immediately. */
  readonly settings: () => SoundSettings
}

export function createSoundPlayer(options: SoundPlayerOptions): SoundPlayer {
  let context: AudioContext | null = null

  const ensureContext = (): AudioContext | null => {
    if (context !== null) return context
    const Constructor = audioContextConstructor()
    if (Constructor === null) return null
    try {
      context = new Constructor()
    } catch {
      // An audio device that will not open is not a reason to stop the game.
      context = null
    }
    return context
  }

  return {
    play: (sound) => {
      const settings = options.settings()
      const wanted = sound === 'low-time' ? settings.lowTimeWarning : settings.moveSounds
      if (!wanted || settings.volume <= 0) return
      const audio = ensureContext()
      if (audio === null) return
      if (audio.state === 'suspended') void audio.resume()

      const tone = TONES[sound]
      const level = (settings.volume / 100) * STYLE_GAIN[settings.style] * tone.gain * 0.2
      const step = tone.durationMs / 1000 / tone.notes.length
      tone.notes.forEach((frequency, index) => {
        const startAt = audio.currentTime + index * step
        const oscillator = audio.createOscillator()
        const envelope = audio.createGain()
        oscillator.type = tone.type
        oscillator.frequency.setValueAtTime(frequency, startAt)
        // A percussive envelope: no attack to speak of, then an exponential tail.
        envelope.gain.setValueAtTime(level, startAt)
        envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + step)
        oscillator.connect(envelope)
        envelope.connect(audio.destination)
        oscillator.start(startAt)
        oscillator.stop(startAt + step)
      })
    },

    close: () => {
      const audio = context
      context = null
      if (audio !== null) void audio.close()
    },
  }
}

/** Which sound a completed move deserves. Separate from the player so the mapping
 *  is a value the tests can read rather than a branch inside an effect. */
export function soundForMove(move: {
  readonly isCapture: boolean
  readonly isCastle: boolean
  readonly isCheck: boolean
  readonly promotion?: unknown
}): PlaySound {
  if (move.isCheck) return 'check'
  if (move.promotion !== undefined) return 'promote'
  if (move.isCapture) return 'capture'
  if (move.isCastle) return 'castle'
  return 'move'
}
