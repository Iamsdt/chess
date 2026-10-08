/**
 * The questions that show off each Sage feature in the mock (docs/sage-features.md).
 *
 * Why one table: the mock script matches these exact strings and the `/dev/sage` page sends
 * them, so the two can never drift apart.
 */
export const SHOWCASE_PROMPTS = {
  whatIf: 'What if I play Nxe5?',
  threat: 'What is my opponent threatening?',
  idea: 'Show me the plan here',
  line: 'Walk me through the main line',
  compare: 'Compare Bb3 and d4',
  controlMap: 'Who controls the centre?',
  yourTurn: 'Let me find the defence',
  grandmaster: 'What should I play here?',
  calculation: 'Map the calculation for me',
  explainWhy: 'Why is that move good?',
  hint: 'Give me a hint',
  simpler: 'Explain it like I am 900',
  language: '¿Por qué perdí esta partida?',
  history: 'What are my weak spots?',
  patterns: 'Why do I keep losing to forks?',
  pastSelf: 'Am I getting better?',
  similar: 'Have I had this position before?',
  queuePuzzles: 'Give me fork puzzles',
  mistakeBank: 'Save this position for review',
  drill: 'Start an endgame drill',
  planWeek: 'Plan my week',
  note: 'Save that takeaway',
  lesson: 'Open a lesson on pins',
  teacher: 'Tell me the story of this game',
  companion: 'Watch my game for blunders',
  openQa: 'What is the en passant rule?',
  visualization: 'Help me see further',
  whatsHanging: 'Quiz me on hanging pieces',
  isItCheck: 'Is it check? Quiz me',
  flashRecall: 'Flash me a position',
  blindChecks: 'Find the checks blindfold',
  blindRoute: 'Knight route, blindfold',
  countExchange: 'Who wins the exchange on e5?',
  pickPicture: 'Pick the right picture',
  deepAnalysis: 'Run a deep analysis',
  providerError: 'Simulate a provider error',
} as const

export type ShowcasePrompt = keyof typeof SHOWCASE_PROMPTS
