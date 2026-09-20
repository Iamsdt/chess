#!/usr/bin/env node
/**
 * `npm run content:validate` — check the shipped content and any pack file.
 *
 * Why it boots Vite rather than importing the modules directly: the validator has
 * to run *the app's own* parsing, schemas and pack conversion, and those are
 * TypeScript files that import `@/domain` and read `import.meta.env`. Vite's SSR
 * loader gives them exactly the environment they have in the browser, so a pack
 * that passes here cannot fail in the app for a reason this script did not see.
 *
 * Usage:  node scripts/content-validate.mjs [--public <dir>] [pack.json …]
 * Exits:  0 everything valid · 1 content problems found · 2 could not run
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const EXIT_OK = 0
const EXIT_INVALID = 1
const EXIT_FAILED = 2

/** `--public <dir>` points the check at a different content root; tests use it. */
function parseArguments(argv) {
  const packPaths = []
  let publicDir = path.join(rootDir, 'public')
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--public') {
      index += 1
      publicDir = path.resolve(process.cwd(), argv[index] ?? '')
    } else if (argument.startsWith('--public=')) {
      publicDir = path.resolve(process.cwd(), argument.slice('--public='.length))
    } else if (!argument.startsWith('-')) {
      packPaths.push(argument)
    }
  }
  return { packPaths, publicDir }
}

async function main() {
  const { packPaths, publicDir } = parseArguments(process.argv.slice(2))

  // Pack paths given on the command line are file paths, and one of them may well
  // be absolute; only the content URLs the validator builds itself are site-relative.
  const packFiles = new Set(packPaths)

  /** Site-absolute content URLs map onto `public/`; anything else is a real path. */
  const resolveContentPath = (url) =>
    packFiles.has(url) || !url.startsWith('/')
      ? path.resolve(process.cwd(), url)
      : path.join(publicDir, url)

  const server = await createServer({
    configFile: false,
    root: rootDir,
    appType: 'custom',
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null },
    resolve: { alias: { '@': path.join(rootDir, 'src') } },
  })

  try {
    const content = await server.ssrLoadModule('/src/content/index.ts')

    const readText = async (url) => {
      try {
        return { ok: true, value: await readFile(resolveContentPath(url), 'utf8') }
      } catch (cause) {
        return {
          ok: false,
          error: { code: 'io', message: `Could not read ${url}: ${cause.message}`, where: url },
        }
      }
    }

    const report = await content.validateContent({
      readText,
      packPaths,
      onProgress: (line) => {
        console.log(`  ${line}`)
      },
    })

    const failures = content.formatContentFailures(report)
    if (failures.length > 0) {
      console.error('')
      console.error(`${failures.length} content problem(s):`)
      for (const line of failures) console.error(`  ✗ ${line}`)
    }

    console.log('')
    console.log(
      `${report.puzzlesValid}/${report.rowsRead} puzzle rows valid · ` +
        `${report.packs.reduce((total, pack) => total + pack.lessons, 0)} lessons · ` +
        (report.ok ? 'all good' : `${failures.length} problem(s)`),
    )
    return report.ok ? EXIT_OK : EXIT_INVALID
  } finally {
    await server.close()
  }
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error('content:validate could not run')
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
  process.exitCode = EXIT_FAILED
}
