/**
 * A streaming CSV reader, hand-written on purpose.
 *
 * Why not a library: the band files carry two shapes no general parser knows
 * about — brace lists (`{"fork","mateIn2"}`) that must survive the comma and
 * quote rules of RFC 4180 intact, and 3.6 MB of text that has to be consumed in
 * chunks so the import can report progress and be cancelled mid-band. Both need
 * custom handling anyway, and this file is 150 lines with its own tests.
 */

/** One parsed record, plus the 1-based line it started on for error messages. */
export interface CsvRow {
  readonly values: readonly string[]
  /** 1-based, counting the header, so it matches what an editor shows. */
  readonly line: number
}

const QUOTE = '"'
const COMMA = ','
const CR = '\r'
const LF = '\n'
const BOM = '﻿'

/**
 * Feed it text, take rows out.
 *
 * Why a class rather than a generator: a chunk boundary can fall inside a quoted
 * field, inside a CRLF pair or between two rows, and the leftover state has to
 * live somewhere the caller cannot forget to carry.
 */
export class CsvStreamParser {
  #field = ''
  #values: string[] = []
  #inQuotes = false
  /** A quote inside a quoted field: the next character decides escape vs close. */
  #quotePending = false
  /** A `\r` at the end of a chunk: the next chunk decides CRLF vs bare CR. */
  #carriageReturnPending = false
  /** True until the first character is seen, so a leading BOM can be dropped. */
  #atStart = true
  /** True once any character of the current record has been seen. */
  #rowStarted = false
  #line = 1
  /** Newlines swallowed inside a quoted field; a record still spans them. */
  #embeddedNewlines = 0

  /** Rows completed by this chunk. A chunk may complete none, or thousands. */
  push(chunk: string): CsvRow[] {
    const rows: CsvRow[] = []
    let text = chunk
    if (this.#atStart) {
      this.#atStart = false
      if (text.startsWith(BOM)) text = text.slice(BOM.length)
    }

    for (const char of text) {
      if (this.#carriageReturnPending) {
        this.#carriageReturnPending = false
        // A bare CR is a line ending too; a CRLF must not end two records.
        if (char === LF) continue
      }

      if (this.#quotePending) {
        this.#quotePending = false
        if (char === QUOTE) {
          // `""` inside a quoted field is one literal quote.
          this.#field += QUOTE
          continue
        }
        this.#inQuotes = false
      }

      if (this.#inQuotes) {
        if (char === QUOTE) this.#quotePending = true
        else {
          if (char === LF) this.#embeddedNewlines += 1
          this.#field += char
        }
        continue
      }

      if (char === QUOTE) {
        this.#inQuotes = true
        this.#rowStarted = true
        continue
      }
      if (char === COMMA) {
        this.#endField()
        continue
      }
      if (char === LF || char === CR) {
        if (char === CR) this.#carriageReturnPending = true
        const row = this.#endRow()
        if (row !== null) rows.push(row)
        continue
      }
      this.#field += char
      this.#rowStarted = true
    }

    return rows
  }

  /** Flush the last record when the file does not end in a newline. */
  end(): CsvRow[] {
    const row = this.#endRow()
    return row === null ? [] : [row]
  }

  #endField(): void {
    this.#values.push(this.#field)
    this.#field = ''
    this.#rowStarted = true
  }

  /** Returns `null` for a blank line, which is not a record. */
  #endRow(): CsvRow | null {
    const startedLine = this.#line
    this.#line += 1 + this.#embeddedNewlines
    this.#embeddedNewlines = 0
    if (!this.#rowStarted && this.#values.length === 0 && this.#field === '') return null
    this.#endField()
    const values = this.#values
    this.#values = []
    this.#rowStarted = false
    return { values, line: startedLine }
  }
}

/** Why: tests, the CLI and small fixtures have the whole document in hand already. */
export function parseCsv(text: string): CsvRow[] {
  const parser = new CsvStreamParser()
  return [...parser.push(text), ...parser.end()]
}

/**
 * Read a Postgres-style array literal: `{"fork","mateIn2"}` → `['fork','mateIn2']`.
 *
 * Why it is not just `JSON.parse` with square brackets: unquoted elements are
 * legal in the shipped data, `{}` and the empty string both mean "no elements",
 * and a `\"` escape appears inside opening names. Anything unparseable comes back
 * as an empty list so the row's own schema — not this helper — decides the row is
 * bad.
 */
export function parseBraceList(raw: string): string[] {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '{}') return []
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return []

  const body = trimmed.slice(1, -1)
  const items: string[] = []
  let current = ''
  let inQuotes = false
  let escaped = false
  let sawValue = false

  for (const char of body) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (inQuotes) {
      if (char === '\\') escaped = true
      else if (char === QUOTE) inQuotes = false
      else current += char
      continue
    }
    if (char === QUOTE) {
      inQuotes = true
      sawValue = true
      continue
    }
    if (char === COMMA) {
      items.push(current.trim())
      current = ''
      sawValue = false
      continue
    }
    current += char
    sawValue = true
  }
  if (sawValue || current !== '' || items.length > 0) items.push(current.trim())
  return items.filter((item) => item !== '')
}
