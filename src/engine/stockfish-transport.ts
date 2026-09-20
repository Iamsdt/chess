import { type UciTransport } from './driver'

/**
 * A `UciTransport` over a vendored Stockfish build.
 *
 * The build in `public/engine/` is written to run *as* a worker: it reads UCI
 * commands from `postMessage`, answers with one string per line, and finds its
 * own `.wasm` (and, in the multi-threaded build, spawns its own pthread workers)
 * from its script URL. So this is a nested worker — our Comlink worker owns it —
 * which is what keeps every engine line off the main thread.
 */
export function createStockfishTransport(
  scriptUrl: string,
  onFatalError: (error: Error) => void,
): UciTransport {
  const worker = new Worker(scriptUrl)
  const handlers = new Set<(line: string) => void>()

  worker.addEventListener('message', (event: MessageEvent<unknown>) => {
    // The loader also posts download-progress objects on a side channel; only its
    // engine output is a string, and only that is UCI.
    if (typeof event.data !== 'string') return
    for (const handler of handlers) handler(event.data)
  })

  worker.addEventListener('error', (event: ErrorEvent) => {
    onFatalError(new Error(`Stockfish worker failed: ${event.message}`))
  })

  return {
    send(command: string): void {
      worker.postMessage(command)
    },
    subscribe(handler: (line: string) => void): () => void {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    terminate(): void {
      handlers.clear()
      // `quit` would let the WASM heap linger until the loader unwinds; terminating
      // the worker frees the hash table and the pthreads immediately.
      worker.terminate()
    },
  }
}
