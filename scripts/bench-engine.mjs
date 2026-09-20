/**
 * `npm run bench:engine` — node rate and startup time for both vendored builds.
 *
 * What this measures: the WASM engines in `public/engine/`, driven over UCI from
 * Node. That is the same binary the browser runs, so the *ratio* between the
 * multi-threaded and single-threaded builds is meaningful, but the absolute nps
 * is Node's, not Chrome's — on the reference machine Chrome was the faster of the
 * two. Browser figures are measured separately and recorded in
 * `docs/engine-benchmarks.md`.
 *
 * Why the copy into a temp directory: the loaders are CommonJS, this package is
 * `"type": "module"`, and each loader finds its `.wasm` by its own filename — so
 * both files are copied side by side under a `.cjs` name.
 *
 * Usage: node scripts/bench-engine.mjs [--movetime 3000] [--threads 4] [--json]
 */
import { spawn } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { arch, availableParallelism, cpus, platform, tmpdir, totalmem } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createInterface } from 'node:readline'

const ENGINE_DIR = path.resolve('public/engine')

const BUILDS = [
  { id: 'mt', label: 'stockfish-19-lite (multi-threaded)', file: 'stockfish-19-lite' },
  { id: 'st', label: 'stockfish-19-lite-single (fallback)', file: 'stockfish-19-lite-single' },
]

/** One opening, one middlegame, one endgame: nps varies a lot between them. */
const POSITIONS = [
  { name: 'opening', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  {
    name: 'middlegame',
    fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7',
  },
  { name: 'endgame', fen: '8/2k5/8/3K4/8/8/5P2/8 w - - 0 1' },
]

const HANDSHAKE_TIMEOUT_MS = 60_000

function parseArgs(argv) {
  const args = {
    movetime: 3000,
    threads: Math.min(Math.max(availableParallelism() - 1, 1), 4),
    json: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--json') args.json = true
    else if (flag === '--movetime') args.movetime = Number(argv[++index])
    else if (flag === '--threads') args.threads = Number(argv[++index])
    else if (flag === '--help' || flag === '-h') args.help = true
  }
  return args
}

function startEngine(scriptPath) {
  const child = spawn(process.execPath, [scriptPath], { stdio: ['pipe', 'pipe', 'inherit'] })
  const listeners = new Set()
  createInterface({ input: child.stdout }).on('line', (line) => {
    for (const listener of [...listeners]) listener(line)
  })

  return {
    send(command) {
      child.stdin.write(`${command}\n`)
    },
    /** Resolve when `match` returns a value for a line; collect every line meanwhile. */
    await(match, timeoutMs) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.delete(listener)
          reject(new Error(`engine timed out after ${timeoutMs} ms`))
        }, timeoutMs)
        const listener = (line) => {
          const value = match(line)
          if (value === undefined) return
          clearTimeout(timer)
          listeners.delete(listener)
          resolve(value)
        }
        listeners.add(listener)
      })
    },
    kill() {
      child.kill('SIGKILL')
    },
  }
}

/** `info … nodes N … nps M … time T` — the last one before `bestmove` is the total. */
function readSearchInfo(line) {
  if (!line.startsWith('info ') || !line.includes(' nps ')) return undefined
  const tokens = line.split(/\s+/)
  const read = (key) => {
    const at = tokens.indexOf(key)
    return at === -1 ? undefined : Number(tokens[at + 1])
  }
  return { nodes: read('nodes'), nps: read('nps'), time: read('time'), depth: read('depth') }
}

async function benchmarkBuild(build, workDir, args) {
  const scriptPath = path.join(workDir, `${build.file}.cjs`)
  copyFileSync(path.join(ENGINE_DIR, `${build.file}.js`), scriptPath)
  copyFileSync(
    path.join(ENGINE_DIR, `${build.file}.wasm`),
    path.join(workDir, `${build.file}.wasm`),
  )

  const engine = startEngine(scriptPath)
  const startedAt = performance.now()
  try {
    engine.send('uci')
    const options = []
    let name = build.label
    await engine.await((line) => {
      if (line.startsWith('id name ')) name = line.slice('id name '.length)
      if (line.startsWith('option name ')) options.push(line)
      return line === 'uciok' ? true : undefined
    }, HANDSHAKE_TIMEOUT_MS)

    engine.send('isready')
    await engine.await((line) => (line === 'readyok' ? true : undefined), HANDSHAKE_TIMEOUT_MS)
    const startupMs = performance.now() - startedAt

    const threadsOption = options.find((line) => line.startsWith('option name Threads '))
    const maxThreads = Number(threadsOption?.split(' max ')[1] ?? 1)
    const threads = Math.max(1, Math.min(args.threads, maxThreads))

    engine.send(`setoption name Threads value ${threads}`)
    engine.send('setoption name Hash value 64')
    engine.send('ucinewgame')
    engine.send('isready')
    await engine.await((line) => (line === 'readyok' ? true : undefined), HANDSHAKE_TIMEOUT_MS)

    const positions = []
    for (const position of POSITIONS) {
      let last
      engine.send(`position fen ${position.fen}`)
      engine.send(`go movetime ${args.movetime}`)
      await engine.await((line) => {
        const info = readSearchInfo(line)
        if (info !== undefined) last = info
        return line.startsWith('bestmove') ? true : undefined
      }, args.movetime + HANDSHAKE_TIMEOUT_MS)

      const nodes = last?.nodes ?? 0
      const timeMs = last?.time ?? args.movetime
      positions.push({
        name: position.name,
        depth: last?.depth ?? 0,
        nodes,
        timeMs,
        nps: timeMs > 0 ? Math.round((nodes / timeMs) * 1000) : 0,
      })
    }

    const meanNps = Math.round(
      positions.reduce((total, position) => total + position.nps, 0) / positions.length,
    )
    return {
      ...build,
      name,
      threads,
      maxThreads,
      startupMs: Math.round(startupMs),
      positions,
      meanNps,
    }
  } finally {
    engine.kill()
  }
}

function formatRow(cells, widths) {
  return `| ${cells.map((cell, index) => String(cell).padEnd(widths[index])).join(' | ')} |`
}

function report(results, args) {
  const widths = [38, 7, 9, 14, 14, 14]
  const header = ['build', 'threads', 'startup', 'opening', 'middlegame', 'endgame']
  console.log(`\nStockfish benchmark — Node ${process.version} on ${platform()} ${arch()}`)
  console.log(
    `${cpus()[0]?.model ?? 'unknown CPU'} · ${availableParallelism()} logical cores · ${Math.round(totalmem() / 2 ** 30)} GB RAM`,
  )
  console.log(`movetime ${args.movetime} ms per position, Hash 64 MB\n`)
  console.log(formatRow(header, widths))
  console.log(`|${widths.map((width) => '-'.repeat(width + 2)).join('|')}|`)
  for (const result of results) {
    console.log(
      formatRow(
        [
          result.label,
          result.threads,
          `${result.startupMs} ms`,
          ...result.positions.map((position) => `${position.nps.toLocaleString('en-US')} nps`),
        ],
        widths,
      ),
    )
  }

  const mt = results.find((result) => result.id === 'mt')
  const st = results.find((result) => result.id === 'st')
  if (mt && st && st.meanNps > 0) {
    console.log(
      `\nmean nps: ${mt.meanNps.toLocaleString('en-US')} (mt, ${mt.threads} threads) vs ${st.meanNps.toLocaleString('en-US')} (st) — ×${(mt.meanNps / st.meanNps).toFixed(2)}`,
    )
  }
  console.log('\nThese are Node figures. Browser nps differs; see docs/engine-benchmarks.md.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: node scripts/bench-engine.mjs [--movetime 3000] [--threads 4] [--json]')
    return
  }

  const workDir = mkdtempSync(path.join(tmpdir(), 'chessking-bench-'))
  const results = []
  try {
    for (const build of BUILDS) {
      try {
        results.push(await benchmarkBuild(build, workDir, args))
      } catch (error) {
        console.error(`${build.label}: ${error instanceof Error ? error.message : 'failed'}`)
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }

  if (results.length === 0) {
    console.error('No build could be benchmarked.')
    process.exitCode = 1
    return
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          node: process.version,
          platform: `${platform()} ${arch()}`,
          cpu: cpus()[0]?.model ?? null,
          cores: availableParallelism(),
          movetimeMs: args.movetime,
          results,
        },
        null,
        2,
      ),
    )
    return
  }

  report(results, args)
}

await main()
