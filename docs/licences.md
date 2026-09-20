# Licences

Everything Chess King ships that someone else made, and the terms it ships under.
Each entry says **where the terms were read** and **when**, because a licence
recorded from memory is not a licence check.

Owned by S10. S07 (engine) and S08 (board assets) report into it; entries still
waiting on them are marked **unverified** rather than guessed.

---

## Puzzle data — Lichess open puzzle database

- **What:** the 10,000 puzzles in `public/quiz/band_*.csv`, curated into six
  bands. Every row keeps its `source` (`lichess`) and `lichess_id`.
- **Licence:** Creative Commons CC0 1.0 (public domain dedication).
- **Verified:** <https://database.lichess.org/>, read 2026-09-20. The page states,
  in the licence paragraph above the database listings:

  > Database exports are released under the Creative Commons CC0 license. Use
  > them for research, commercial purpose, publication, anything you like. You
  > can download, modify and redistribute them, without asking for permission.

  The statement is made for the page as a whole, which is where the puzzle
  database is published alongside the games, evaluations and openings exports.

- **What we do anyway:** CC0 asks for nothing, but the app credits the source
  regardless, because taking 10,000 puzzles from a community project and saying
  nothing would be poor manners:
  - every puzzle keeps `source` and `lichessId` through the import;
  - `lichessPuzzleUrl()` (in `@/domain`) builds the
    `https://lichess.org/training/<lichess_id>` link the solver shows as
    "Puzzle from Lichess";
  - the About screen and the README credit the Lichess open puzzle database and
    link here.

  **Gap:** the About screen is S23's and the README is not this sprint's file, so
  neither credit is written yet. The data and the link are in place for them.

## Engine — Stockfish 19 lite

- **What:** `public/engine/stockfish-19-lite.{js,wasm}` and the single-threaded
  fallback beside it.
- **Licence:** GNU General Public License, version 3.
- **Verified:** `public/engine/Copying.txt` in this repository, read 2026-09-20 —
  the full GPLv3 text, beginning "GNU GENERAL PUBLIC LICENSE / Version 3, 29 June
  2007".
- **Obligations:** the GPLv3 text must ship with the binaries (it does, at
  `/engine/Copying.txt`), the About screen must name Stockfish and its licence and
  link to the source, and any modifications to the engine must be published. We
  ship the upstream build unmodified.

  **Gaps, both for S07 to confirm:** the exact upstream release the binaries were
  taken from is not recorded anywhere in this repo, and GPLv3 §6 wants a written
  offer or a link to the corresponding source for the build we distribute.

## Board piece sets

- **What:** `prototype/assets/pieces/{alpha,california,maestro,staunty}` — 12 SVGs
  each — which S08 is porting to `public/pieces/`.
- **Status: unverified.** No licence or attribution file accompanies the SVGs in
  this repository, and nothing in the prototype records where they came from.
- **Lead, not a finding:** four piece sets of those names are distributed with
  Lichess, and `lichess-org/lila`'s `COPYING.md`
  (<https://raw.githubusercontent.com/lichess-org/lila/master/COPYING.md>, read
  2026-09-20) lists them as:

  | Set        | Author       | Licence                                |
  | ---------- | ------------ | -------------------------------------- |
  | California | Jerry S.     | CC BY-NC-SA 4.0                        |
  | Staunty    | sadsnake1    | CC BY-NC-SA 4.0                        |
  | Maestro    | sadsnake1    | CC BY-NC-SA 4.0                        |
  | Alpha      | Eric Bentzen | "free for personal non commercial use" |

  Whether the files in this repository _are_ those files has not been checked, so
  none of the above is recorded as this project's licence position yet. **S08
  owns confirming it**, and if it holds, three consequences follow that the team
  has to decide on before release: CC BY-NC-SA requires per-set attribution in the
  UI, it is share-alike, and **NC forbids commercial use** — which sits oddly
  beside an MIT-licensed app, even a free one.

## Lesson content

- **What:** the 48 tutorials in `public/tutorial/`, converted into the builtin
  lesson pack by `@/content`'s `loadTutorialPack()`.
- **Licence:** MIT, as part of this repository. Authored for this project.

## Application code

- **Licence:** MIT, per the badge and the licence section of `README.md`.
- **Gap:** there is **no `LICENSE` file** in the repository. A README badge is not
  a licence grant; one needs adding before release.

## Content packs

Every `ContentPack` carries a required `licence` field (SPDX id or licence text),
shown wherever the pack is listed. The import refuses a pack without one, so a
community pack cannot arrive unlicensed. See `docs/content-packs.md`.

---

## Still to record

| Item                       | Owner     | What is missing                                            |
| -------------------------- | --------- | ---------------------------------------------------------- |
| Piece sets                 | S08       | Provenance of the SVGs; then the licence and the UI credit |
| Stockfish build provenance | S07       | Upstream release + corresponding-source link for GPLv3 §6  |
| `LICENSE` file             | —         | The MIT text the README claims                             |
| Fonts, icons, sounds       | S02 / S12 | Not surveyed by this sprint                                |
