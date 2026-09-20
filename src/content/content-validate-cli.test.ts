/// <reference types="node" />
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { PUZZLE_BANDS, PUZZLE_CSV_COLUMNS } from '@/domain'

/**
 * `npm run content:validate`, driven the way CI would drive it.
 *
 * Exit codes are the contract: 0 means the content is shippable, 1 means it is
 * not and the reasons are on stderr. The check runs against a temporary content
 * root so it tests the script rather than today's copy of `public/`.
 */

const script = path.resolve(process.cwd(), 'scripts/content-validate.mjs')

const FEN = 'rn2k2r/pQ2nppp/2p5/8/4p1bN/P5P1/P1qP1PBP/R1B1K2R b KQkq - 2 11'

const csvRow = (band: string, index: number, rating = '789') =>
  [
    `lc_${band}_${String(index)}`,
    FEN,
    '"{""c2d1""}"',
    band,
    '1',
    'beginner',
    `${band} ${String(index)}`,
    'mateIn1',
    'Black to move.',
    rating,
    'Novice',
    '"{""mate""}"',
    'Mate in one.',
    'true',
    'lichess',
    `id${String(index)}`,
    '10',
    '90',
    '{}',
  ].join(',')

const tutorial = {
  id: 'first-lesson',
  kind: 'tutorial',
  slug: 'first-lesson',
  title: 'First lesson',
  category: 'tactics',
  difficulty: 'beginner',
  summary: 'Open with the king pawn.',
  description: 'A first look at the centre.',
  defaultOrientation: 'white',
  steps: [
    { actor: 'player', san: 'e4', title: 'Open', instruction: 'Play e4.' },
    { actor: 'opponent', san: 'e5', title: 'Black replies', instruction: 'Black plays e5.' },
  ],
}

async function makeContentRoot(options: { badRow?: boolean } = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'chessking-content-'))
  await mkdir(path.join(root, 'quiz'), { recursive: true })
  await mkdir(path.join(root, 'tutorial'), { recursive: true })

  const bands: Record<string, number> = {}
  for (const band of PUZZLE_BANDS) {
    bands[band] = 1
    const rows = [PUZZLE_CSV_COLUMNS.join(','), csvRow(band, 0)]
    if (options.badRow === true && band === 'pawn') rows.push(csvRow(band, 1, 'not-a-rating'))
    await writeFile(path.join(root, 'quiz', `band_${band}.csv`), `${rows.join('\n')}\n`)
  }
  await writeFile(path.join(root, 'quiz', 'index.json'), JSON.stringify({ version: 1, bands }))

  await writeFile(
    path.join(root, 'tutorial', 'index.json'),
    JSON.stringify({
      version: 1,
      items: [
        { id: tutorial.id, title: tutorial.title, tags: [], file: '/tutorial/first-lesson.json' },
      ],
    }),
  )
  await writeFile(path.join(root, 'tutorial', 'first-lesson.json'), JSON.stringify(tutorial))
  return root
}

interface CliResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

function runCli(args: readonly string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile('node', [script, ...args], (error, stdout, stderr) => {
      const code = error !== null && typeof error.code === 'number' ? error.code : 0
      resolve({ code, stdout, stderr })
    })
  })
}

let cleanRoot = ''

beforeAll(async () => {
  cleanRoot = await makeContentRoot()
}, 60_000)

describe('the content validator CLI', () => {
  it('exits 0 when every row and every lesson is valid', async () => {
    const result = await runCli(['--public', cleanRoot])
    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('6/6 puzzle rows valid')
  }, 120_000)

  it('exits 1 and names the row when a puzzle does not validate', async () => {
    const root = await makeContentRoot({ badRow: true })
    const result = await runCli(['--public', root])
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('band_pawn.csv:3')
    expect(result.stderr).toContain('rating')
  }, 120_000)

  it('exits 1 when a pack file given on the command line is invalid', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'chessking-pack-'))
    const packPath = path.join(root, 'broken.json')
    await writeFile(packPath, JSON.stringify({ id: 'p', formatVersion: 99 }))
    const result = await runCli(['--public', cleanRoot, packPath])
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('broken.json')
  }, 120_000)

  it('validates a good pack file without complaining', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'chessking-pack-'))
    const packPath = path.join(root, 'good.json')
    await writeFile(
      packPath,
      JSON.stringify({
        id: 'extra-pack',
        formatVersion: 1,
        version: '1.0',
        name: 'Extra',
        kind: 'lessons',
        licence: 'CC0-1.0',
        itemCount: 0,
        lessons: [],
        puzzles: [],
      }),
    )
    const result = await runCli(['--public', cleanRoot, packPath])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Extra')
  }, 120_000)
})
