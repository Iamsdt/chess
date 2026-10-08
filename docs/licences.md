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

  The README credit is written (S29). **Gap:** the About screen's credit is still S23's.

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

- **What:** `public/pieces/{alpha,california,maestro,staunty}` - 12 SVGs each.
- **Provenance in this repo:** none. The SVG directories contain no licence, author or
  attribution file, and the SVGs carry no metadata. The sets are identified by name only.
- **Licences, read upstream:** `lichess-org/lila`'s `COPYING.md`
  (<https://raw.githubusercontent.com/lichess-org/lila/master/COPYING.md>, read 2026-10-08)
  lists the four sets as follows. The README credits these authors.

  | Set        | Author                                                    | Licence                                                                                          |
  | ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
  | California | [Jerry S.](https://sites.google.com/view/jerrychess/home) | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)                            |
  | Staunty    | sadsnake1                                                 | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)                            |
  | Maestro    | sadsnake1                                                 | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)                            |
  | Alpha      | Eric Bentzen                                              | "free for personal non commercial use" ([source](http://www.enpassant.dk/chess/downl/alpha.zip)) |

- **Still unverified:** that the files in `public/pieces/` are byte-identical to those
  upstream sets (they match by name and set structure, nothing more). Treat the table as the
  working licence position, not as proof.
- **Consequences to decide before any commercial release:**
  - **NC** (non-commercial) applies to all four. Selling the app, ads or paid tiers would
    breach the licences; either drop these sets or replace them with CC0/permissive ones
    (Lichess ships `cburnett` GPLv2+, `chessnut` Apache-2.0, `rhosgfx` CC0).
  - **BY** needs visible attribution: the credit belongs in the About screen as well as the README.
  - **SA** makes adaptations of California, Staunty and Maestro share-alike (CC BY-NC-SA).
    We ship the SVGs unmodified.

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

| Item                       | Owner     | What is missing                                               |
| -------------------------- | --------- | ------------------------------------------------------------- |
| Piece sets                 | S08 / S23 | Byte-compare with upstream; About-screen credit (README done) |
| Stockfish build provenance | S07       | Upstream release + corresponding-source link for GPLv3 §6     |
| `LICENSE` file             | —         | The MIT text the README claims                                |
| Fonts, icons, sounds       | S02 / S12 | Not surveyed by this sprint                                   |
