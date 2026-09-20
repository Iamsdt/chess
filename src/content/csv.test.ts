import { describe, expect, it } from 'vitest'

import { CsvStreamParser, parseBraceList, parseCsv } from './csv'

describe('CSV reader', () => {
  it('reads a plain record', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      { values: ['a', 'b', 'c'], line: 1 },
      { values: ['1', '2', '3'], line: 2 },
    ])
  })

  it('keeps commas inside a quoted field', () => {
    const [row] = parseCsv('id,title\nlc_1,"Rook 3 · Fork, then mate"\n').slice(1)
    expect(row?.values).toEqual(['lc_1', 'Rook 3 · Fork, then mate'])
  })

  it('reads the brace-list columns the band files use', () => {
    // This is the shape that breaks a naive split: braces, commas and doubled quotes.
    const text = 'solution_ucis,tags\n"{""f6f3"",""g2g1""}","{""mate"",""mateIn2"",""short""}"\n'
    const [row] = parseCsv(text).slice(1)
    expect(row?.values).toEqual(['{"f6f3","g2g1"}', '{"mate","mateIn2","short"}'])
  })

  it('unescapes a doubled quote inside a quoted field', () => {
    const [row] = parseCsv('a\n"He said ""check"""\n').slice(1)
    expect(row?.values).toEqual(['He said "check"'])
  })

  it('keeps a newline inside a quoted field and still numbers the next row', () => {
    const rows = parseCsv('a,b\n"two\nlines",x\nlast,y\n')
    expect(rows[1]?.values).toEqual(['two\nlines', 'x'])
    expect(rows[2]).toEqual({ values: ['last', 'y'], line: 4 })
  })

  it('treats CRLF as one line ending', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      { values: ['a', 'b'], line: 1 },
      { values: ['1', '2'], line: 2 },
    ])
  })

  it('drops a leading byte-order mark', () => {
    expect(parseCsv('﻿id\n1\n')[0]?.values).toEqual(['id'])
  })

  it('emits the last record when the file does not end in a newline', () => {
    expect(parseCsv('a\n1')).toHaveLength(2)
  })

  it('ignores blank lines between records', () => {
    expect(parseCsv('a\n\n1\n')).toEqual([
      { values: ['a'], line: 1 },
      { values: ['1'], line: 3 },
    ])
  })

  it('keeps empty fields rather than collapsing them', () => {
    expect(parseCsv('a,b,c\n1,,3\n')[1]?.values).toEqual(['1', '', '3'])
  })

  it('does not care where a chunk boundary falls', () => {
    const text = 'id,tags\nlc_1,"{""a,b"",""c""}"\nlc_2,"x\ny"\n'
    for (let split = 1; split < text.length; split += 1) {
      const parser = new CsvStreamParser()
      const rows = [
        ...parser.push(text.slice(0, split)),
        ...parser.push(text.slice(split)),
        ...parser.end(),
      ]
      expect(rows, `split at ${String(split)}`).toEqual(parseCsv(text))
    }
  })
})

describe('brace lists', () => {
  it('reads the quoted form the dataset uses', () => {
    expect(parseBraceList('{"f6f3","g2g1","f3e2"}')).toEqual(['f6f3', 'g2g1', 'f3e2'])
  })

  it('reads a single element', () => {
    expect(parseBraceList('{"c2d1"}')).toEqual(['c2d1'])
  })

  it('reads an empty list, however it is spelled', () => {
    expect(parseBraceList('{}')).toEqual([])
    expect(parseBraceList('')).toEqual([])
  })

  it('keeps a comma inside a quoted element', () => {
    expect(parseBraceList('{"Caro-Kann_Defense, Panov"}')).toEqual(['Caro-Kann_Defense, Panov'])
  })

  it('reads unquoted elements', () => {
    expect(parseBraceList('{fork,pin}')).toEqual(['fork', 'pin'])
  })

  it('unescapes a backslash-escaped quote', () => {
    expect(parseBraceList('{"say \\"hi\\""}')).toEqual(['say "hi"'])
  })

  it('returns nothing for a value that is not a brace list, leaving the schema to complain', () => {
    expect(parseBraceList('f6f3')).toEqual([])
  })
})
