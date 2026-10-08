import { useState } from 'react'

import { Board } from '@/board'
import { Button, Input } from '@/design'
import type { Color } from '@/domain'

import { parseTyped, type Answer, type Question } from './questions'

export interface AnswerPanelProps {
  readonly question: Question
  readonly orientation: Color
  /** The typed text lives in the parent so tapping squares on the board can fill it too. */
  readonly text: string
  readonly onText: (text: string) => void
  readonly onSubmit: (answer: Answer) => void
}

/** The question and the ways to answer it. It never holds the answer key. */
export function AnswerPanel({ question, orientation, text, onText, onSubmit }: AnswerPanelProps) {
  const [problem, setProblem] = useState<string | null>(null)

  if (question.input === 'choice') {
    return (
      <div data-slot="viz-answer" className="space-y-2">
        <p className="text-sm font-medium">{question.prompt}</p>
        <div role="group" aria-label="Answers" className="grid gap-2">
          {(question.options ?? []).map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              className="h-auto justify-start py-2 text-left whitespace-normal"
              onClick={() => {
                onSubmit({ choice: option.id })
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  if (question.input === 'picture') {
    return (
      <div data-slot="viz-answer" className="space-y-2">
        <p className="text-sm font-medium">{question.prompt}</p>
        <div role="group" aria-label="Boards" className="grid grid-cols-3 gap-2">
          {(question.pictures ?? []).map((picture) => (
            <button
              key={picture.id}
              type="button"
              aria-label={`Board ${picture.id.toUpperCase()}`}
              className="rounded-lg border bg-card p-1 text-center text-xs font-medium hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => {
                onSubmit({ choice: picture.id })
              }}
            >
              <span aria-hidden="true" className="pointer-events-none block">
                <Board
                  fen={picture.fen}
                  orientation={orientation}
                  coordinates={false}
                  label={`Board ${picture.id.toUpperCase()}`}
                />
              </span>
              <span aria-hidden="true" className="mt-1 block">
                {picture.id.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // An empty list is a real answer for "which pieces hang" and "which moves check".
  const mayBeEmpty = question.input === 'squares' || question.input === 'moves'
  const submit = () => {
    const parsed = parseTyped(question.input, text)
    if (parsed === null || (!mayBeEmpty && (parsed.squares ?? []).length === 0)) {
      setProblem(
        question.input === 'moves'
          ? 'I could not read that.'
          : 'I could not read that. Try a square such as e4.',
      )
      return
    }
    setProblem(null)
    onSubmit(parsed)
  }
  return (
    <form
      data-slot="viz-answer"
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor="viz-answer-input" className="block text-sm font-medium">
        {question.prompt}
      </label>
      {question.hint === undefined ? null : (
        <p id="viz-answer-hint" className="text-xs text-muted-foreground">
          {question.hint}
        </p>
      )}
      <div className="flex gap-2">
        <Input
          id="viz-answer-input"
          value={text}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby="viz-answer-hint"
          placeholder={question.input === 'moves' ? 'Qh5 Bxf7' : 'e4'}
          onChange={(event) => {
            setProblem(null)
            onText(event.target.value)
          }}
        />
        <Button type="submit">{mayBeEmpty && text.trim() === '' ? 'None' : 'Answer'}</Button>
      </div>
      {problem === null ? null : (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </form>
  )
}
