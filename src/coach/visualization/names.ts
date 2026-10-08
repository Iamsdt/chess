import type { BoardView, VisualizationExercise } from '@/domain'

export const EXERCISE_NAMES: Readonly<Record<VisualizationExercise, string>> = {
  'follow-line': 'Follow the line',
  'whats-hanging': "What's hanging",
  'is-it-check': 'Is it check',
  'flash-recall': 'Flash recall',
  'blind-checks': 'Blind checks',
  'blind-route': 'Blind route',
  'count-exchange': 'Count the exchange',
  'pick-picture': 'Pick the picture',
}

export const VIEW_NAMES: Readonly<Record<BoardView, string>> = {
  normal: 'Normal view',
  ghost: 'Ghost view',
  frozen: 'Frozen view',
  partial: 'Partial blindfold',
  blindfold: 'Blindfold',
  flash: 'Flash',
}
