# Authoring a content pack

A content pack is one JSON file holding lessons, puzzles, or both. It is the only
way content gets into Chess King other than the puzzles that ship with the app,
and the same format is used by the builtin lesson pack, so nothing about your pack
is second class.

Validate it before you share it:

```sh
npm run content:validate path/to/your-pack.json
```

Exit codes: `0` everything valid · `1` problems found (they are printed, one line
per problem, naming the field) · `2` the check could not run.

---

## The smallest pack that works

```json
{
  "id": "knight-forks",
  "formatVersion": 1,
  "version": "1.0",
  "name": "Knight forks",
  "kind": "lessons",
  "licence": "CC BY-SA 4.0",
  "description": "Six positions where the knight hits two pieces at once.",
  "author": "Your name",
  "homepage": "https://example.com/knight-forks",
  "itemCount": 1,
  "lessons": [
    {
      "id": "knight-forks-intro",
      "packId": "knight-forks",
      "title": "The family fork",
      "summary": "King, queen and rook, all at once.",
      "difficulty": "beginner",
      "estimatedMinutes": 4,
      "themes": ["fork"],
      "prerequisites": [],
      "version": 1,
      "steps": [
        {
          "id": "knight-forks-intro-0",
          "index": 0,
          "kind": "info",
          "fen": "r3k2r/ppp2ppp/8/4N3/8/8/PPP2PPP/R3K2R w KQkq - 0 1",
          "orientation": "white",
          "prompt": "Find the square that hits everything.",
          "text": "The knight on e5 has one jump that attacks three pieces."
        },
        {
          "id": "knight-forks-intro-1",
          "index": 1,
          "kind": "move",
          "fen": "r3k2r/ppp2ppp/8/4N3/8/8/PPP2PPP/R3K2R w KQkq - 0 1",
          "orientation": "white",
          "prompt": "Play the fork.",
          "expectedMoves": ["Nd7"],
          "focusSquares": ["d7"],
          "arrows": [{ "from": "e5", "to": "d7", "kind": "best" }],
          "hints": ["Look for a square touching both rooks.", "The knight jumps to d7."],
          "successText": "That is the family fork.",
          "keyIdea": "A knight forks best from a square the king cannot reach."
        }
      ]
    }
  ],
  "puzzles": []
}
```

## The fields

**The pack itself** — `id` (unique, kebab-case), `formatVersion` (`1` today; a
pack claiming a higher number is refused with a readable message rather than a
stack trace), `version` (your own revision, any string), `name`, `kind`
(`lessons` · `puzzles` · `openings` · `drills`), `licence` (**required** — an SPDX
id such as `CC-BY-SA-4.0`, or the licence text), `itemCount` (must equal
`lessons.length + puzzles.length`; a count that lies makes progress bars lie, so
it is checked), and the optional `description`, `author` and `homepage`.

`source`, `importedAt` and `updatedAt` describe _this installation's copy_ of a
pack and are stamped on import. Do not put them in the file.

**A lesson** — `id`, `packId`, `title`, `summary`, `difficulty` (`beginner` ·
`intermediate` · `advanced`), `estimatedMinutes`, `themes`, `prerequisites`
(lesson ids that lock this one on the course map), `version`, and `steps`.

**A step** — `id`, `index` (0-based and consecutive; gaps are rejected), `kind`
(`info` · `move` · `choice` · `quiz`), `fen` (the position **before** the move),
`orientation`, `prompt` (the headline), and optionally `text`, `expectedMoves`
(SAN), `alternativeMoves` + `alternativeText` (accepted, but answered differently),
`focusSquares`, `arrows` (`{from, to, kind}` where kind is `best` · `threat` ·
`sage`), `marks`, `hints` (at most three, in ladder order), `successText`,
`failureText`, `keyIdea`.

**A puzzle** inside a pack uses the same shape as the shipped ones — see
`src/domain/puzzle.ts`, where every field names the CSV column it came from. The
importer stamps `packId` onto a pack's puzzles so removing the pack can find them
again.

## Rules the validator enforces

- The schema in `src/domain` — every field, every enum, FEN structure, SAN and
  UCI shape.
- `formatVersion` no higher than this app reads.
- `itemCount` matches what the pack carries.
- No duplicate lesson or puzzle id inside one pack.
- Step `index` values consecutive from 0.
- A licence is present.

Two packs may not claim the same lesson id; the registry refuses the second,
because progress would otherwise be ambiguous.

## Importing

```ts
import { importContentPackFromFile, importContentPackFromUrl } from '@/content'

const result = await importContentPackFromFile(file)
if (!result.ok) console.error(formatPackReport(result.error))
```

Both return a `Result`; a failure is a `PackValidationReport` with one problem per
offending field, which is what the import dialog renders. Nothing throws.

---

## The builtin lesson pack

The 48 tutorials in `public/tutorial/` are converted into a pack at load time by
`loadTutorialPack()` rather than checked in as a built file, so the conversion can
never drift from its source. Two shape mismatches are resolved in the conversion,
and both are worth knowing if you are writing lessons:

- A tutorial step is a move in a line and carries no position. The line is
  replayed and each step keeps the position it starts from.
- `LessonStepKind` has no "the opponent replies now" value, so an opponent move
  becomes an `info` step at the position before it with the reply drawn as a
  `threat` arrow. The commentary survives and the player is never asked to play
  the opponent's move. If S16 would rather auto-play those, the schema needs a
  step kind for it — that is a domain change, not a conversion change.

### Known defect in the shipped tutorials

19 of the 48 tutorials stop replaying part-way through: the hand-authored line
becomes illegal (`back-rank-mate`, for instance, plays `Rd1` with the rook still
on a1 and the d-file blocked). Those lessons are **left out of the pack** and
reported; the other 29 load normally. `npm run content:validate` lists every one,
which is why it currently exits `1` on a clean checkout. Fixing them means editing
`public/tutorial/*.json`, which S10 does not own.
