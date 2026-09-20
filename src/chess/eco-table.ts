/**
 * Bundled ECO opening table — the data `detectOpening()` matches positions against.
 *
 * Source: the Lichess `chess-openings` data set
 * (https://github.com/lichess-org/chess-openings), released into the public domain
 * under CC0. It is the same table lichess.org names openings with, which is why an
 * opening this app shows can be checked against a Lichess game page.
 *
 * Each line is `ECO|name|positionKey`, where the position key is a FEN's first four
 * fields (placement, side to move, castling, en passant) — the same key
 * `positionKeyFromFen()` in `@/domain` derives, so two move orders that transpose
 * into one position match the same opening.
 *
 * **Why this is a reduction, not the whole data set.** The full table is 3815 rows and
 * costs about 60 KB gzipped — nearly a third of the 200 KB JS budget `npm run size`
 * enforces, for a table most of whose depth is sub-sub-variations a club player never
 * needs named. This file keeps a row when it is **eight plies deep or less** (so every
 * opening and every major variation survives) **or** its name is at most two segments
 * — `Family` or `Family: Variation` — which keeps deep-but-famous lines such as the
 * Najdorf, the Scheveningen and the Kalashnikov that a ply cap alone would drop.
 *
 * Coverage of the rule above: 2311 of 3815 rows (61%), 334 of the 500 ECO
 * codes, 148 opening families, ~34.1 KB gzipped. Every opening named anywhere in
 * `prototype/*.html` resolves. Regenerate by re-running the rule against a fresh copy
 * of the upstream TSVs; the table is data, so it is written, never edited by hand.
 */
export const ECO_TABLE_SOURCE = 'lichess-org/chess-openings (CC0)'

/** Rows in this table; exported so a test can assert the file was not truncated. */
export const ECO_TABLE_SIZE = 2311

/**
 * The table itself, as one string rather than an array of objects.
 *
 * Why: 2311 object literals cost far more bytes and far more parse time than one
 * string the module splits on first use, and the string compresses better because
 * neighbouring rows share long FEN prefixes.
 */
export const ECO_TABLE = `A00|Amar Opening|rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R b KQkq -
A00|Amar Opening: Paris Gambit|rnbqkbnr/ppp2ppp/8/3pp3/5P2/6PN/PPPPP2P/RNBQKB1R b KQkq -
A00|Amsterdam Attack|r1bqkb1r/ppp2ppp/2np1n2/4p3/2P5/1PN1P3/P2P1PPP/R1BQKBNR w KQkq -
A00|Anderssen's Opening|rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq -
A00|Anderssen's Opening: Polish Gambit|rnbqkbnr/1ppppppp/8/p7/1P6/P7/2PPPPPP/RNBQKBNR b KQkq -
A00|Barnes Opening|rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq -
A00|Barnes Opening: Fool's Mate|rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq -
A00|Barnes Opening: Gedult Gambit|rnbqkbnr/ppp1pp1p/6p1/8/3Pp3/2P2P2/PP4PP/RNBQKBNR b KQkq -
A00|Barnes Opening: Gedult Gambit|rnbqkbnr/ppppp1pp/8/8/4p3/2N2P2/PPPP2PP/R1BQKBNR b KQkq -
A00|Barnes Opening: Hammerschlag|rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPPKPP/RNBQ1BNR b kq -
A00|Clemenz Opening|rnbqkbnr/pppppppp/8/8/8/7P/PPPPPPP1/RNBQKBNR b KQkq -
A00|Clemenz Opening: Spike Lee Gambit|rnbqkbnr/ppppppp1/8/7p/6P1/7P/PPPPPP2/RNBQKBNR b KQkq -
A00|Creepy Crawly Formation: Classical Defense|rnbqkbnr/ppp2ppp/8/3pp3/8/P6P/1PPPPPP1/RNBQKBNR w KQkq -
A00|Formation: Hippopotamus Attack|r1bq1rk1/ppp2ppp/2nb1n2/3pp3/8/PPPPPPP1/7P/RNBQKBNR b KQ -
A00|Formation: Shy Attack|r1bq1rk1/ppp2ppp/2nb1n2/3pp3/8/P2PP1PP/1PPN1PB1/R1BQK1NR b KQ -
A00|Global Opening|rnbqkbnr/pppp1ppp/8/4p3/8/P6P/1PPPPPP1/RNBQKBNR b KQkq -
A00|Grob Opening|rnbqkbnr/pppppppp/8/8/6P1/8/PPPPPP1P/RNBQKBNR b KQkq -
A00|Grob Opening: Alessi Gambit|rnbqkbnr/ppppp1pp/8/5p2/6P1/8/PPPPPP1P/RNBQKBNR w KQkq -
A00|Grob Opening: Double Grob|rnbqkbnr/pppppp1p/8/6p1/6P1/8/PPPPPP1P/RNBQKBNR w KQkq -
A00|Grob Opening: Double Grob, Coca-Cola Gambit|rnbqkbnr/pppppp1p/8/6p1/5PP1/8/PPPPP2P/RNBQKBNR b KQkq -
A00|Grob Opening: Grob Gambit|rnbqkbnr/ppp1pppp/8/3p4/6P1/8/PPPPPPBP/RNBQK1NR b KQkq -
A00|Grob Opening: Grob Gambit Declined|rnbqkbnr/pp2pppp/2p5/3p4/6P1/8/PPPPPPBP/RNBQK1NR w KQkq -
A00|Grob Opening: Grob Gambit, Basman Gambit|rnbqkbnr/ppp1ppp1/8/3p3P/8/8/PPPPPPBP/RNBQK1NR b KQkq -
A00|Grob Opening: Grob Gambit, Fritz Gambit|rn1qkbnr/ppp1pppp/8/3p4/2P3b1/8/PP1PPPBP/RNBQK1NR b KQkq -
A00|Grob Opening: Grob Gambit, Keres Gambit|rnbqkbnr/ppp2ppp/8/3p4/3p2P1/2P5/PP2PPBP/RNBQK1NR b KQkq -
A00|Grob Opening: Grob Gambit, Richter-Grob Gambit|rnbqkbnr/pp2pppp/2p5/8/2p3P1/1P6/P2PPPBP/RNBQK1NR b KQkq -
A00|Grob Opening: Keene Defense|rnbqkbnr/pp3ppp/2p5/3pp3/6P1/7P/PPPPPPB1/RNBQK1NR w KQkq -
A00|Grob Opening: London Defense|r1bqkbnr/pppp1ppp/2n5/4p3/6P1/7P/PPPPPP2/RNBQKBNR w KQkq -
A00|Grob Opening: Romford Countergambit|rn1qkbnr/ppp1pppp/8/8/2Pp2b1/8/PP1PPPBP/RNBQK1NR w KQkq -
A00|Grob Opening: Spike Attack|rnbqkbnr/pp2pppp/2p5/3p2P1/8/8/PPPPPPBP/RNBQK1NR b KQkq -
A00|Grob Opening: Spike, Hurst Attack|rnbqkbnr/ppp2ppp/8/3pp3/2P3P1/8/PP1PPPBP/RNBQK1NR b KQkq -
A00|Grob Opening: Zilbermints Gambit|rnbqkbnr/ppp1pppp/8/8/4p1P1/2N5/PPPP1P1P/R1BQKBNR b KQkq -
A00|Grob Opening: Zilbermints Gambit, Schiller Defense|rnbqkbnr/ppp1ppp1/8/7p/4p1P1/2N5/PPPP1P1P/R1BQKBNR w KQkq -
A00|Grob Opening: Zilbermints Gambit, Zilbermints-Hartlaub Gambit|rnbqkbnr/ppp2ppp/8/4p3/4p1P1/2NP4/PPP2P1P/R1BQKBNR b KQkq -
A00|Hungarian Opening|rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR b KQkq -
A00|Hungarian Opening: Asten Gambit|r1bqkbnr/ppp3pp/2n5/4Pp2/3pN3/6P1/PPP1PP1P/R1BQKBNR w KQkq f6
A00|Hungarian Opening: Burk Gambit|rnbqk1nr/ppp1bppp/8/3p4/4p2N/P2P2P1/1PP1PP1P/RNBQKB1R b KQkq -
A00|Hungarian Opening: Bücker Gambit|rnbqkbnr/ppp2ppp/8/3pp3/1P6/6P1/P1PPPPBP/RNBQK1NR b KQkq -
A00|Hungarian Opening: Catalan Formation|rnbqkbnr/ppp2ppp/4p3/3p4/8/6P1/PPPPPPBP/RNBQK1NR w KQkq -
A00|Hungarian Opening: Dutch Defense|rnbqkbnr/ppppp1pp/8/5p2/8/6P1/PPPPPP1P/RNBQKBNR w KQkq -
A00|Hungarian Opening: Indian Defense|rnbqkb1r/pppppppp/5n2/8/8/6P1/PPPPPP1P/RNBQKBNR w KQkq -
A00|Hungarian Opening: Myers Defense|rnbqkbnr/pppppp1p/8/6p1/8/6P1/PPPPPP1P/RNBQKBNR w KQkq -
A00|Hungarian Opening: Pachman Gambit|rnbqkbnr/ppppp2p/6p1/7Q/4p3/6P1/PPPP1P1P/RNB1KBNR w KQkq -
A00|Hungarian Opening: Paris Gambit|rn1qkbnr/ppp2ppp/8/3p4/5p2/6PB/PPPPP2P/RNBQ1RK1 b kq -
A00|Hungarian Opening: Reversed Alekhine|rnbqkbnr/pppp1ppp/8/4p3/8/5NP1/PPPPPP1P/RNBQKB1R b KQkq -
A00|Hungarian Opening: Reversed Brooklyn Defense, Brooklyn Benko Gambit|rnbqkb1r/pppp1ppp/5n2/8/1P2p3/6P1/P1PPPP1P/RNBQKBNR b KQkq -
A00|Hungarian Opening: Reversed Modern Defense|rnbqkbnr/pp2pppp/8/2pp4/8/6P1/PPPPPPBP/RNBQK1NR w KQkq -
A00|Hungarian Opening: Reversed Norwegian Defense|rnbqkbnr/pppp1ppp/8/8/4p2N/6P1/PPPPPP1P/RNBQKB1R b KQkq -
A00|Hungarian Opening: Sicilian Invitation|rnbqkbnr/pp1ppppp/8/2p5/8/6P1/PPPPPP1P/RNBQKBNR w KQkq -
A00|Hungarian Opening: Slav Formation|rnbqkbnr/pp2pppp/2p5/3p4/8/6P1/PPPPPPBP/RNBQK1NR w KQkq -
A00|Hungarian Opening: Symmetrical Variation|rnbqkbnr/pppppp1p/6p1/8/8/6P1/PPPPPP1P/RNBQKBNR w KQkq -
A00|Hungarian Opening: Van Kuijk Gambit|rnbqkbnr/ppppppp1/8/8/7p/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A00|Hungarian Opening: Winterberg Gambit|rnbqkbnr/ppp2ppp/8/4p3/2p5/1P4P1/P2PPPBP/RNBQK1NR b KQkq -
A00|Kádas Opening|rnbqkbnr/pppppppp/8/8/7P/8/PPPPPPP1/RNBQKBNR b KQkq -
A00|Kádas Opening: Beginner's Trap|rnbqkbnr/ppp1pppp/8/3p4/7P/7R/PPPPPPP1/RNBQKBN1 b Qkq -
A00|Kádas Opening: Koola-Koola Variation|rnbqkbnr/1ppppppp/8/p7/7P/8/PPPPPPP1/RNBQKBNR w KQkq -
A00|Kádas Opening: Kádas Gambit|rnbqkbnr/pp1ppppp/8/2p5/1P5P/8/P1PPPPP1/RNBQKBNR b KQkq -
A00|Kádas Opening: Kádas Gambit|rnbqkbnr/pp2pppp/8/3p4/3p3P/2P2N2/PP2PPP1/RNBQKB1R b KQkq -
A00|Kádas Opening: Kádas Gambit|rnbqkbnr/pppp1ppp/8/8/3p3P/2P5/PP2PPP1/RNBQKBNR b KQkq -
A00|Kádas Opening: Myers Variation|rnbqkbnr/pp2pppp/8/2pp4/3PP2P/8/PPP2PP1/RNBQKBNR b KQkq -
A00|Kádas Opening: Schneider Gambit|rnbqkbnr/pppppp1p/8/6p1/7P/8/PPPPPPP1/RNBQKBNR w KQkq -
A00|Kádas Opening: Steinbok Gambit|rnbqkbnr/ppppp1pp/8/8/4p2P/3P4/PPP2PP1/RNBQKBNR b KQkq -
A00|Lasker Simul Special|rnbqkbnr/ppppppp1/8/7p/8/6P1/PPPPPP1P/RNBQKBNR w KQkq -
A00|Mieses Opening|rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq -
A00|Mieses Opening: Myers Spike Attack|rnbqkbnr/pppppp1p/6p1/8/6P1/3P4/PPP1PP1P/RNBQKBNR b KQkq -
A00|Mieses Opening: Reversed Rat|rnbqkbnr/pppp1ppp/8/4p3/8/3P4/PPP1PPPP/RNBQKBNR w KQkq -
A00|Mieses Opening: Venezolana Variation|r1bqkbnr/pp1ppppp/2n5/2p5/8/2NP2P1/PPP1PP1P/R1BQKBNR b KQkq -
A00|Polish Opening|rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq -
A00|Polish Opening, with d5|rnbqkbnr/ppp1pppp/8/3p4/1P6/8/P1PPPPPP/RNBQKBNR w KQkq -
A00|Polish Opening, with d5|rnbqkb1r/ppp1pppp/5n2/3p4/1P6/5N2/PBPPPPPP/RN1QKB1R b KQkq -
A00|Polish Opening: Baltic Defense|rn1qkbnr/ppp1pppp/8/3p1b2/1P6/8/PBPPPPPP/RN1QKBNR w KQkq -
A00|Polish Opening: Birmingham Gambit|rnbqkbnr/pp1ppppp/8/2p5/1P6/8/P1PPPPPP/RNBQKBNR w KQkq -
A00|Polish Opening: Bugayev Advance Variation|rnbqkbnr/pppp2pp/5p2/1P2p3/8/8/PBPPPPPP/RN1QKBNR b KQkq -
A00|Polish Opening: Bugayev Attack|rnbqkbnr/pppp1ppp/8/4p3/1P6/P7/2PPPPPP/RNBQKBNR b KQkq -
A00|Polish Opening: Czech Defense|rnbqkbnr/ppp2ppp/3p4/4p3/1P6/8/PBPPPPPP/RN1QKBNR w KQkq -
A00|Polish Opening: Dutch Defense|rnbqkbnr/ppppp1pp/8/5p2/1P6/8/P1PPPPPP/RNBQKBNR w KQkq -
A00|Polish Opening: German Defense|rnb1kbnr/ppp1pppp/3q4/3p4/1P6/8/PBPPPPPP/RN1QKBNR w KQkq -
A00|Polish Opening: Grigorian Variation|r1bqkbnr/pppppppp/2n5/8/1P6/8/P1PPPPPP/RNBQKBNR w KQkq -
A00|Polish Opening: Karniewski Variation|rnbqkb1r/pppppppp/7n/8/1P6/8/P1PPPPPP/RNBQKBNR w KQkq -
A00|Polish Opening: King's Indian Variation|rnbqkb1r/pppppp1p/5np1/8/1P6/8/PBPPPPPP/RN1QKBNR w KQkq -
A00|Polish Opening: King's Indian Variation, Schiffler Attack|rnbqkb1r/pppppp1p/5np1/8/1P2P3/8/PBPP1PPP/RN1QKBNR b KQkq -
A00|Polish Opening: Myers Variation|rnbqkbnr/pp2pppp/2p5/3p4/PP6/8/1BPPPPPP/RN1QKBNR b KQkq -
A00|Polish Opening: Outflank Variation|rnbqkbnr/pp1ppppp/2p5/8/1P6/8/P1PPPPPP/RNBQKBNR w KQkq -
A00|Polish Opening: Outflank Variation, Schuehler Gambit|rnbqkbnr/1p1ppppp/2p5/pP6/8/8/PBPPPPPP/RN1QKBNR b KQkq -
A00|Polish Opening: Queen's Indian Variation|rnbqkb1r/p1pp1ppp/1p2pn2/1P6/8/8/PBPPPPPP/RN1QKBNR w KQkq -
A00|Polish Opening: Queenside Defense|rnbqkb1r/1ppp1ppp/p3pn2/1P6/8/8/PBPPPPPP/RN1QKBNR w KQkq -
A00|Polish Opening: Rooks Swap Line|1nbqkb1r/1ppp1ppp/4pn2/1P6/8/8/2PPPPPP/BN1QKBNR b Kk -
A00|Polish Opening: Schiffler-Sokolsky Variation|rnbqkb1r/ppp2ppp/4pn2/1P1p4/8/4P3/PBPP1PPP/RN1QKBNR b KQkq -
A00|Polish Opening: Schuehler Gambit|rnbqkbnr/1p1ppppp/8/pp6/4P3/8/PBPP1PPP/RN1QKBNR b KQkq -
A00|Polish Opening: Symmetrical Variation|rnbqkbnr/p1pppppp/8/1p6/1P6/8/P1PPPPPP/RNBQKBNR w KQkq -
A00|Polish Opening: Tartakower Gambit|rnbqkbnr/pppp2pp/5p2/4p3/1P2P3/8/PBPP1PPP/RN1QKBNR b KQkq -
A00|Polish Opening: Wolferts Gambit|rnbqkbnr/pp1p1ppp/8/2p1p3/1P6/8/PBPPPPPP/RN1QKBNR w KQkq -
A00|Saragossa Opening|rnbqkbnr/pppppppp/8/8/8/2P5/PP1PPPPP/RNBQKBNR b KQkq -
A00|Sodium Attack|rnbqkbnr/pppppppp/8/8/8/N7/PPPPPPPP/R1BQKBNR b KQkq -
A00|Sodium Attack: Celadon Variation|rnbqk1nr/pp3ppp/8/2ppp3/8/P2PP3/P1P2PPP/1RBQKBNR b Kkq -
A00|Sodium Attack: Chenoboskion Variation|rnbqkbnr/pppppp1p/6p1/8/6P1/N7/PPPPPP1P/R1BQKBNR b KQkq -
A00|Sodium Attack: Durkin Gambit|r1bqkbnr/pppp2pp/2n5/4pp2/2N1P3/8/PPPP1PPP/R1BQKBNR w KQkq -
A00|Valencia Opening|rnbqkbnr/pppp1ppp/8/4p3/8/3P4/PPPNPPPP/R1BQKBNR b KQkq -
A00|Van Geet Opening|rnbqkbnr/pppppppp/8/8/8/2N5/PPPPPPPP/R1BQKBNR b KQkq -
A00|Van Geet Opening: Battambang Variation|rnbqkbnr/pppp1ppp/8/4p3/8/P1N5/1PPPPPPP/R1BQKBNR b KQkq -
A00|Van Geet Opening: Billockus-Johansen Gambit|rnbqk1nr/pppp1ppp/8/2b1p3/8/2N2N2/PPPPPPPP/R1BQKB1R w KQkq -
A00|Van Geet Opening: Damhaug Gambit|rnbqkbnr/ppp2ppp/8/3pp3/5P2/2N5/PPPPP1PP/R1BQKBNR w KQkq -
A00|Van Geet Opening: Dougherty Gambit|rnbqkbnr/ppp1pppp/8/8/4p3/2N2P2/PPPP2PP/R1BQKBNR b KQkq -
A00|Van Geet Opening: Dunst-Perrenet Gambit|rnbqkbnr/ppp1pppp/8/8/4p3/2NP4/PPP2PPP/R1BQKBNR b KQkq -
A00|Van Geet Opening: Düsseldorf Gambit|rnbqkbnr/pp1ppppp/8/2p5/1P6/2N5/P1PPPPPP/R1BQKBNR b KQkq -
A00|Van Geet Opening: Gladbacher Gambit|rnbqkbnr/ppp2ppp/8/4p3/4p3/1PNP4/P1P2PPP/R1BQKBNR b KQkq -
A00|Van Geet Opening: Hector Gambit|rnbqkbnr/ppp1pppp/8/8/2B1p3/2N5/PPPP1PPP/R1BQK1NR b KQkq -
A00|Van Geet Opening: Hergert Gambit|r1bqkbnr/ppp2ppp/2np4/4P3/8/2N5/PPPPP1PP/R1BQKBNR w KQkq -
A00|Van Geet Opening: Hulsemann Gambit|rn1qkbnr/ppp2ppp/4b3/3pp2Q/8/2N1P3/PPPP1PPP/R1B1KBNR w KQkq -
A00|Van Geet Opening: Jendrossek Gambit|rnbqkb1r/pp2p1pp/5n2/2p2p2/1P1p1P2/5N2/P1PPPNPP/R1BQKB1R b KQkq -
A00|Van Geet Opening: Kluever Gambit|rnbqkbnr/ppppp1pp/8/8/4p3/2NP4/PPP2PPP/R1BQKBNR b KQkq -
A00|Van Geet Opening: Laroche Gambit|rnbqkbnr/p1pppppp/8/1p6/8/2N5/PPPPPPPP/R1BQKBNR w KQkq -
A00|Van Geet Opening: Liebig Gambit|rnbqkb1r/ppp2ppp/5n2/3pp2Q/8/2N1P3/PPPP1PPP/R1B1KBNR w KQkq -
A00|Van Geet Opening: Melleby Gambit|rnbqkbnr/pp2pppp/8/2p5/3pNP2/8/PPPPP1PP/R1BQKBNR w KQkq -
A00|Van Geet Opening: Myers Attack|rnbqkbnr/pppppp1p/6p1/8/7P/2N5/PPPPPPP1/R1BQKBNR b KQkq -
A00|Van Geet Opening: Napoleon Attack|r1bqkbnr/pppp1ppp/2n5/4p3/3P4/2N2N2/PPP1PPPP/R1BQKB1R b KQkq -
A00|Van Geet Opening: Novosibirsk Variation|r1bqkbnr/pp1ppppp/2n5/8/7Q/2N5/PPP1PPPP/R1B1KBNR b KQkq -
A00|Van Geet Opening: Nowokunski Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/2N5/PPPP2PP/R1BQKBNR b KQkq e3
A00|Van Geet Opening: Pfeiffer Gambit|rnbqkbnr/ppp2ppp/8/4p3/3pNP2/8/PPPPP1PP/R1BQKBNR w KQkq -
A00|Van Geet Opening: Pfeiffer Gambit, Sleipnir Countergambit|rnbqkbnr/ppp2ppp/8/4p3/3pNP2/5N2/PPPPP1PP/R1BQKB1R b KQkq -
A00|Van Geet Opening: Reversed Nimzowitsch|rnbqkbnr/pppp1ppp/8/4p3/8/2N5/PPPPPPPP/R1BQKBNR w KQkq -
A00|Van Geet Opening: Reversed Scandinavian|r1bqkbnr/pppp1ppp/2n5/8/Q7/2N5/PPP1PPPP/R1B1KBNR b KQkq -
A00|Van Geet Opening: Sicilian Two Knights|r1bqkbnr/pp1ppppp/2n5/8/3N4/2N5/PPP1PPPP/R1BQKB1R b KQkq -
A00|Van Geet Opening: Sleipnir Gambit|rnbqk1nr/ppp2ppp/8/3pp3/1b1P4/2N1P3/PPP2PPP/R1BQKBNR w KQkq -
A00|Van Geet Opening: Twyble Attack|rnbqkbnr/pp1ppppp/8/2p5/8/2N5/PPPPPPPP/1RBQKBNR b Kkq -
A00|Van Geet Opening: Tübingen Gambit|rnbqkb1r/pppppppp/5n2/8/6P1/2N5/PPPPPP1P/R1BQKBNR b KQkq -
A00|Van Geet Opening: Venezolana Variation|rnbqkb1r/ppp1pppp/5n2/3p4/8/2NP2P1/PPP1PP1P/R1BQKBNR b KQkq -
A00|Van Geet Opening: Warsteiner Gambit|rnbqkbnr/ppp1pp1p/8/3p2p1/5P2/2N5/PPPPP1PP/R1BQKBNR w KQkq -
A00|Van't Kruijs Opening|rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq -
A00|Van't Kruijs Opening: Bouncing Bishop Variation|rnbqkbnr/p1pp1ppp/8/1p2p3/8/1B2P3/PPPP1PPP/RNBQK1NR b KQkq -
A00|Van't Kruijs Opening: Keoni-Hiva Gambit, Akahi Variation|rnbqkb1r/pppp1ppp/5n2/8/5p2/2N1PN2/PPPP2PP/R1BQKB1R b KQkq -
A00|Van't Kruijs Opening: Keoni-Hiva Gambit, Alua Variation|r1bqkbnr/pppp1ppp/2n5/8/5p2/2N1PN2/PPPP2PP/R1BQKB1R b KQkq -
A00|Van't Kruijs Opening: Keoni-Hiva Gambit, Ekolu Variation|rnbqkbnr/ppp2ppp/8/3p4/5p2/2N1PN2/PPPP2PP/R1BQKB1R b KQkq -
A00|Ware Opening|rnbqkbnr/pppppppp/8/8/P7/8/1PPPPPPP/RNBQKBNR b KQkq -
A00|Ware Opening: Cologne Gambit|r1bqkbnr/p1pnpppp/1p6/3p4/P2P4/2N5/1PP1PPPP/R1BQKBNR w KQkq -
A00|Ware Opening: Crab Variation|rnbqkbnr/pppp1ppp/8/4p3/P6P/8/1PPPPPP1/RNBQKBNR b KQkq -
A00|Ware Opening: Meadow Hay Trap|rnbqkbnr/pppp1ppp/8/4p3/P7/R7/1PPPPPPP/1NBQKBNR b Kkq -
A00|Ware Opening: Symmetric Variation|rnbqkbnr/1ppppppp/8/p7/P7/8/1PPPPPPP/RNBQKBNR w KQkq -
A00|Ware Opening: Ware Gambit|rnbqkbnr/ppp3pp/P7/3ppp2/8/4P3/1PPP1PPP/RNBQKBNR b KQkq -
A00|Ware Opening: Wing Gambit|rn1qkbnr/pbpppppp/8/1P6/8/8/1PPPPPPP/RNBQKBNR w KQkq -
A01|Nimzo-Larsen Attack|rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR b KQkq -
A01|Nimzo-Larsen Attack: Classical Variation|rnbqkbnr/ppp1pppp/8/3p4/8/1P6/P1PPPPPP/RNBQKBNR w KQkq -
A01|Nimzo-Larsen Attack: Dutch Variation|rnbqkbnr/ppppp1pp/8/5p2/8/1P6/P1PPPPPP/RNBQKBNR w KQkq -
A01|Nimzo-Larsen Attack: English Variation|rnbqkbnr/pp1ppppp/8/2p5/8/1P6/P1PPPPPP/RNBQKBNR w KQkq -
A01|Nimzo-Larsen Attack: Graz Attack|rnbqkbnr/ppp1pppp/8/3p4/8/BP6/P1PPPPPP/RN1QKBNR b KQkq -
A01|Nimzo-Larsen Attack: Indian Variation|rnbqkb1r/pppppppp/5n2/8/8/1P6/P1PPPPPP/RNBQKBNR w KQkq -
A01|Nimzo-Larsen Attack: Modern Variation|rnbqkbnr/pppp1ppp/8/4p3/8/1P6/P1PPPPPP/RNBQKBNR w KQkq -
A01|Nimzo-Larsen Attack: Modern Variation|r1bqkbnr/pppp1ppp/2n5/4p3/8/1P6/PBPPPPPP/RN1QKBNR w KQkq -
A01|Nimzo-Larsen Attack: Modern Variation|r1bqkbnr/pppp1ppp/2n5/4p3/8/1P2P3/PBPP1PPP/RN1QKBNR b KQkq -
A01|Nimzo-Larsen Attack: Modern Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/1P6/PB1PPPPP/RN1QKBNR w KQkq -
A01|Nimzo-Larsen Attack: Pachman Gambit|r1bqkbnr/pppp1ppp/2n5/4p3/5P2/1P6/PBPPP1PP/RN1QKBNR b KQkq -
A01|Nimzo-Larsen Attack: Polish Variation|rnbqkbnr/p1pppppp/8/1p6/8/1P6/P1PPPPPP/RNBQKBNR w KQkq -
A01|Nimzo-Larsen Attack: Ringelbach Gambit|rnbqkbnr/pppp2pp/4p3/5p2/4P3/1P6/PBPP1PPP/RN1QKBNR b KQkq -
A01|Nimzo-Larsen Attack: Spike Variation|rnbqkb1r/pppppp1p/5np1/8/6P1/1P6/PBPPPP1P/RN1QKBNR b KQkq -
A01|Nimzo-Larsen Attack: Symmetrical Variation|rnbqkbnr/p1pppppp/1p6/8/8/1P6/P1PPPPPP/RNBQKBNR w KQkq -
A02|Bird Opening|rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq -
A02|Bird Opening: Batavo-Polish Attack|rnbqkb1r/pppppp1p/5np1/8/1P3P2/5N2/P1PPP1PP/RNBQKB1R b KQkq -
A02|Bird Opening: Double Duck Formation|rnbqkbnr/ppp1p1pp/8/3p1p2/3P1P2/8/PPP1P1PP/RNBQKBNR w KQkq -
A02|Bird Opening: From's Gambit|rnbqkbnr/pppp1ppp/8/4p3/5P2/8/PPPPP1PP/RNBQKBNR w KQkq -
A02|Bird Opening: From's Gambit, Bahr Gambit|rnbqkbnr/pppp1ppp/8/4p3/5P2/2N5/PPPPP1PP/R1BQKBNR b KQkq -
A02|Bird Opening: From's Gambit, Langheld Gambit|rnbqkb1r/ppp2ppp/3P1n2/8/8/8/PPPPP1PP/RNBQKBNR w KQkq -
A02|Bird Opening: From's Gambit, Lasker Variation|rnbqk1nr/ppp2p1p/3b4/6p1/8/5N2/PPPPP1PP/RNBQKB1R w KQkq -
A02|Bird Opening: Hobbs Gambit|rnbqkbnr/pppppp1p/8/6p1/5P2/8/PPPPP1PP/RNBQKBNR w KQkq -
A02|Bird Opening: Hobbs-Zilbermints Gambit|rnbqkbnr/pppppp2/7p/6p1/5P2/5N2/PPPPP1PP/RNBQKB1R w KQkq -
A02|Bird Opening: Horsefly Defense|rnbqkb1r/pppppppp/7n/8/5P2/8/PPPPP1PP/RNBQKBNR w KQkq -
A02|Bird Opening: Lasker Gambit|rnbqkbnr/pppp2pp/5p2/4P3/8/8/PPPPP1PP/RNBQKBNR w KQkq -
A02|Bird Opening: Mujannah|rnbqkb1r/pppppppp/5n2/8/2P2P2/8/PP1PP1PP/RNBQKBNR b KQkq -
A02|Bird Opening: Myers Defense|rnbqkbnr/p1pppppp/8/1p6/5P2/8/PPPPP1PP/RNBQKBNR w KQkq -
A02|Bird Opening: Platz Gambit|rnbqkb1r/ppppnppp/8/4P3/8/8/PPPPP1PP/RNBQKBNR w KQkq -
A02|Bird Opening: Schlechter Gambit|r1bqkbnr/pppp1ppp/2n5/4P3/8/8/PPPPP1PP/RNBQKBNR w KQkq -
A02|Bird Opening: Siegener Gambit|rnbqkbnr/pp1p1ppp/8/2p5/3p1P2/2P2N2/PP2P1PP/RNBQKB1R b KQkq -
A02|Bird Opening: Swiss Gambit|rnbqkb1r/ppppp1pp/5n2/8/4pPP1/2N5/PPPP3P/R1BQKBNR b KQkq -
A02|Bird Opening: Wagner-Zwitersch Gambit|rnbqkbnr/ppppp1pp/8/5p2/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -
A03|Bird Opening: Dutch Variation|rnbqkbnr/ppp1pppp/8/3p4/5P2/8/PPPPP1PP/RNBQKBNR w KQkq -
A03|Bird Opening: Dutch Variation, Dudweiler Gambit|rnbqkbnr/ppp1pppp/8/3p4/5PP1/8/PPPPP2P/RNBQKBNR b KQkq -
A03|Bird Opening: Lasker Variation|rnbqkb1r/pp2pppp/5n2/2pp4/5P2/4PN2/PPPP2PP/RNBQKB1R w KQkq -
A03|Bird Opening: Sturm Gambit|rnbqkbnr/ppp1pppp/8/3p4/2P2P2/8/PP1PP1PP/RNBQKBNR b KQkq -
A03|Bird Opening: Thomas Gambit|rnbqkb1r/pp2pppp/5n2/2p5/3p1P2/1P2PN2/PBPP2PP/RN1QKB1R b KQkq -
A03|Bird Opening: Williams Gambit|rnbqkbnr/ppp1pppp/8/3p4/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -
A03|Bird Opening: Williams Gambit|rnbqkb1r/ppp1pppp/5n2/8/4pP2/2N5/PPPPQ1PP/R1B1KBNR b KQkq -
A03|Bird Opening: Williams-Zilbermints Gambit|rnbqkb1r/ppp1pppp/5n2/8/4pP2/2N5/PPPPN1PP/R1BQKB1R b KQkq -
A04|Colle System: Rhamphorhynchus Variation|rnb1k1nr/pp1pppbp/6p1/q1P5/8/4PN2/PPP2PPP/RNBQKB1R w KQkq -
A04|Modern Defense: Semi-Averbakh Variation, Polish Variation|rnb1k1nr/pp1pppbp/1q4p1/2p5/2PPP3/5N2/PP3PPP/RNBQKB1R w KQkq -
A04|Modern Defense: Semi-Averbakh Variation, Pterodactyl Variation|rnb1k1nr/pp1pppbp/6p1/q1p5/2PPP3/5N2/PP3PPP/RNBQKB1R w KQkq -
A04|Zukertort Defense: Kingside Variation|rnbqkb1r/pppppp1p/6pn/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A04|Zukertort Defense: Sicilian Knight Variation|r1bqkbnr/pp1ppppp/n7/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
A04|Zukertort Opening|rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -
A04|Zukertort Opening: Arctic Defense|rnbqkbnr/ppppp1pp/5p2/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Arctic Defense, Drunken Knight Variation|rnbqkb1r/pppppnpp/5p2/8/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Basman Defense|rnbqkbnr/ppppppp1/7p/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Black Mustang Defense|r1bqkbnr/pppppppp/2n5/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Drunken Cavalry Variation|r1bqkb1r/pppppppp/n6n/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Dutch Variation|rnbqkbnr/ppppp1pp/8/5p2/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Herrstrom Gambit|rnbqkbnr/pppppp1p/8/6p1/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Kingside Fianchetto|rnbqkbnr/pppppp1p/6p1/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Lisitsyn Gambit|rnbqkbnr/ppppp1pp/8/5p2/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -
A04|Zukertort Opening: Lisitsyn Gambit Deferred|rnbqkb1r/ppppp1pp/5n2/5p2/4P3/3P1N2/PPP2PPP/RNBQKB1R b KQkq -
A04|Zukertort Opening: Pirc Invitation|rnbqkbnr/ppp1pppp/3p4/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Polish Defense|rnbqkbnr/p1pppppp/8/1p6/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Queen's Gambit Invitation|rnbqkbnr/pppp1ppp/4p3/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Queenside Fianchetto Variation|rnbqkbnr/p1pppppp/1p6/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Ross Gambit|rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Shabalov Gambit|rnbqkbnr/3p1ppp/p3p3/1pp5/2P5/2N2NP1/PP1PPP1P/R1BQKB1R w KQkq -
A04|Zukertort Opening: Sicilian Invitation|rnbqkbnr/pp1ppppp/8/2p5/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Slav Invitation|rnbqkbnr/pp1ppppp/2p5/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Speelsmet Gambit|rnbqkbnr/pp1ppppp/8/8/3p4/4PN2/PPP2PPP/RNBQKB1R b KQkq -
A04|Zukertort Opening: St. George Defense|rnbqkbnr/1ppppppp/p7/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: The Walrus|r1bqkbnr/ppp2ppp/2p5/8/8/8/PPPPPPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Vos Gambit|rnbqkbnr/ppp2ppp/3p4/4p3/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Wade Defense|rn1qkbnr/ppp1pppp/3p4/8/4P1b1/5N2/PPPP1PPP/RNBQKB1R w KQkq -
A04|Zukertort Opening: Ware Defense|rnbqkbnr/1ppppppp/8/p7/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A05|King's Indian Attack|rnbqkb1r/ppp1pppp/5n2/3p4/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A05|King's Indian Attack: Smyslov Variation|rnbqkb1r/pppppp1p/5np1/8/1P6/5NP1/P1PPPP1P/RNBQKB1R b KQkq -
A05|King's Indian Attack: Spassky Variation|rnbqkb1r/p1pppppp/5n2/1p6/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A05|King's Indian Attack: Symmetrical Defense|rnbqkb1r/pppppp1p/5np1/8/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A05|King's Indian Attack: Wahls Defense|rnbq1rk1/ppp1ppbp/5np1/3p4/8/3P1NP1/PPP1PPBP/RNBQ1RK1 w - -
A05|Polish Opening: Zukertort System|rnbqkb1r/pppppp1p/5np1/8/1P6/5N2/PBPPPPPP/RN1QKB1R b KQkq -
A05|Zukertort Opening|rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A05|Zukertort Opening|r1bqkb1r/pppppppp/2n2n2/8/8/2N2N2/PPPPPPPP/R1BQKB1R w KQkq -
A05|Zukertort Opening: Double Fianchetto Attack|rnbq1rk1/ppp1ppbp/3p1np1/8/8/1P3NP1/PBPPPPBP/RN1Q1RK1 b - -
A05|Zukertort Opening: Lemberger Gambit|rnbqkb1r/pppppppp/5n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -
A05|Zukertort Opening: Myers Polish Attack|rnbqkb1r/pppppp1p/5np1/8/PP6/5N2/2PPPPPP/RNBQKB1R b KQkq -
A05|Zukertort Opening: Nimzo-Larsen Variation|rnbqkb1r/pppppppp/5n2/8/8/1P3N2/P1PPPPPP/RNBQKB1R b KQkq -
A05|Zukertort Opening: Quiet System|rnbqkb1r/pppppppp/5n2/8/8/4PN2/PPPP1PPP/RNBQKB1R b KQkq -
A06|Nimzo-Larsen Attack: Classical Variation|rnbqkbnr/ppp1pppp/8/3p4/8/1P3N2/P1PPPPPP/RNBQKB1R b KQkq -
A06|Nimzo-Larsen Attack: Norfolk Gambit|rnbqkbnr/pp2pppp/8/2pp4/4P3/1P3N2/P1PP1PPP/RNBQKB1R b KQkq -
A06|Nimzo-Larsen Attack: Norfolk Gambit|rnbqkb1r/pp2pppp/5n2/2pp4/4P3/1P3N2/PBPP1PPP/RN1QKB1R b KQkq -
A06|Zukertort Opening|rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -
A06|Zukertort Opening: Ampel Variation|rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKBR1 b Qkq -
A06|Zukertort Opening: Old Indian Attack|rnbqkbnr/ppp1pppp/8/3p4/8/3P1N2/PPP1PPPP/RNBQKB1R b KQkq -
A06|Zukertort Opening: Pachman Gambit|rnbqkbnr/pp2pppp/8/2p5/2p5/1P2PN2/P2P1PPP/RNBQKB1R b KQkq -
A06|Zukertort Opening: Regina-Nu Gambit|rnbqkbnr/pp2pppp/8/2p5/2p5/1PN2N2/P2PPPPP/R1BQKB1R b KQkq -
A06|Zukertort Opening: Reversed Mexican Defense|rnbqkbnr/ppp1pppp/8/3p4/8/2N2N2/PPPPPPPP/R1BQKB1R b KQkq -
A06|Zukertort Opening: Santasiere's Folly|rnbqkbnr/ppp1pppp/8/3p4/1P6/5N2/P1PPPPPP/RNBQKB1R b KQkq -
A06|Zukertort Opening: Tennison Gambit|rnbqkbnr/ppp1pppp/8/3p4/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -
A06|Zukertort Opening: The Potato|rnbqkbnr/ppp1pppp/8/3p4/P7/5N2/1PPPPPPP/RNBQKB1R b KQkq -
A07|Hungarian Opening: Wiedenhagen-Beta Gambit|rnbqkbnr/ppp1pp1p/8/3p2p1/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A07|King's Indian Attack|rnbqkbnr/ppp1pppp/8/3p4/8/5NP1/PPPPPP1P/RNBQKB1R b KQkq -
A07|King's Indian Attack, with Bf5|rn1qkb1r/pp2pppp/2p2n2/3p1b2/8/5NP1/PPPPPPBP/RNBQ1RK1 w kq -
A07|King's Indian Attack, with Bf5|rn1qkb1r/pp2ppp1/2p2n1p/3p1b2/8/3P1NP1/PPP1PPBP/RNBQ1RK1 w kq -
A07|King's Indian Attack, with Bf5|rn1qkb1r/pp2ppp1/2p2n1p/5b2/2p5/3P1NP1/PP2PPBP/RNBQ1RK1 w kq -
A07|King's Indian Attack, with Bf5|rn1qkb1r/pp3ppp/2p1pn2/3p1b2/8/3P1NP1/PPPNPPBP/R1BQ1RK1 b kq -
A07|King's Indian Attack, with Bf5|rn1qkb1r/pp3ppp/2p1pn2/3p1b2/7N/3P2P1/PPP1PPBP/RNBQ1RK1 b kq -
A07|King's Indian Attack, with e6|rnbqkb1r/ppp2ppp/4pn2/3p4/8/5NP1/PPPPPPBP/RNBQK2R w KQkq -
A07|King's Indian Attack, with e6|rnbqk2r/ppp1bppp/4pn2/3p4/8/5NP1/PPPPPPBP/RNBQ1RK1 w kq -
A07|King's Indian Attack: Double Fianchetto|rnbqkbnr/ppp1pp1p/6p1/3p4/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A07|King's Indian Attack: Keres Variation|rn1qkbnr/ppp1pppp/8/3p4/6b1/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A07|King's Indian Attack: Keres Variation|r2qkbnr/pppnpppp/8/3p4/6b1/5NP1/PPPPPPBP/RNBQK2R w KQkq -
A07|King's Indian Attack: Keres Variation|r2qkbnr/pp1npppp/2p5/3p4/6b1/5NP1/PPPPPPBP/RNBQ1RK1 w kq -
A07|King's Indian Attack: Keres Variation|r2qk2r/pp1n1ppp/2pb1n2/3p4/3P2b1/2N2NP1/PP2PPBP/R1BQ1RK1 w kq -
A07|King's Indian Attack: Omega-Delta Gambit|rnbqkbnr/ppp2ppp/8/3pp3/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A07|King's Indian Attack: Pachman System|rnbqk2r/ppp1npbp/6p1/3pp3/8/3P1NP1/PPP1PPBP/RNBQ1RK1 w kq -
A07|King's Indian Attack: Sicilian Variation|rnbqkbnr/pp2pppp/8/2pp4/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -
A07|King's Indian Attack: Yugoslav Variation|rn1qkb1r/pp2pppp/2p2n2/3p4/6b1/5NP1/PPPPPPBP/RNBQ1RK1 w kq -
A07|King's Indian Attack: Yugoslav Variation|rnbqkb1r/p1p2ppp/1p2pn2/3p4/2P5/5NP1/PP1PPPBP/RNBQ1RK1 b kq -
A08|King's Indian Attack: French Variation|r1bqkbnr/pp2pppp/2n5/2pp4/8/5NP1/PPPPPPBP/RNBQK2R w KQkq -
A08|King's Indian Attack: Sicilian Variation|r1bq1rk1/pp2bppp/2n1pn2/2pp4/4P3/3P1NP1/PPPN1PBP/R1BQR1K1 b - -
A08|King's Indian Attack: Sicilian Variation|rnbqkbnr/pp2pppp/8/2pp4/8/5NP1/PPPPPPBP/RNBQK2R b KQkq -
A08|King's Indian Attack: Sicilian Variation|rnbqkb1r/pp3ppp/4pn2/2pp4/8/3P1NP1/PPP1PPBP/RNBQ1RK1 b kq -
A08|Zukertort Opening: Reversed Grünfeld|r1bqkbnr/pp2pppp/2n5/2pp4/3P4/5NP1/PPP1PPBP/RNBQK2R b KQkq -
A08|Zukertort Opening: Reversed Grünfeld|r1bqkb1r/pp2pppp/2n2n2/2pp4/3P4/5NP1/PPP1PPBP/RNBQK2R w KQkq -
A08|Zukertort Opening: Reversed Grünfeld|r1bqkb1r/pp2pppp/2n2n2/2pp4/3P4/5NP1/PPP1PPBP/RNBQ1RK1 b kq -
A08|Zukertort Opening: Reversed Grünfeld|r1bqkbnr/pp3ppp/2n1p3/2pp4/3P4/5NP1/PPP1PPBP/RNBQ1RK1 b kq -
A09|Réti Opening|rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq -
A09|Réti Opening: Advance Variation|rnbqkbnr/ppp1pppp/8/8/2Pp4/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A09|Réti Opening: Advance Variation, Michel Gambit|rnbqkbnr/pp2pppp/8/2p5/1PPp4/5N2/P2PPPPP/RNBQKB1R w KQkq -
A09|Réti Opening: Advance Variation, Navara Gambit|rnbqkbnr/ppp1pp1p/8/6p1/1PPp4/5N2/P2PPPPP/RNBQKB1R w KQkq -
A09|Réti Opening: Penguin Variation|rnbqkbnr/ppp1pppp/8/8/2Pp4/5N2/PP1PPPPP/RNBQKBR1 b Qkq -
A09|Réti Opening: Reversed Blumenfeld Gambit|rnbqkbnr/pp2pppp/8/2p5/1PPp4/4PN2/P2P1PPP/RNBQKB1R b KQkq -
A09|Réti Opening: Réti Accepted|rnbqkbnr/ppp1pppp/8/8/2p5/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A09|Réti Opening: Réti Gambit, Keres Variation|rn1qkbnr/ppp1pppp/4b3/8/2p5/4PN2/PP1P1PPP/RNBQKB1R w KQkq -
A09|Réti Opening: Zilbermints Gambit|rnbqkbnr/p1p1pppp/8/1p1p4/2P5/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A10|English Opening|rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -
A10|English Opening: Achilles-Omega Gambit|rnbqkb1r/pppppppp/5n2/8/2P1P3/8/PP1P1PPP/RNBQKBNR b KQkq -
A10|English Opening: Adorjan Defense|rnbqkbnr/pppp1p1p/6p1/4p3/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq -
A10|English Opening: Anglo-Dutch Defense|rnbqkbnr/ppppp1pp/8/5p2/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A10|English Opening: Anglo-Dutch Defense, Hickmann Gambit|rnbqkbnr/ppppp1pp/8/5p2/2P1P3/8/PP1P1PPP/RNBQKBNR b KQkq -
A10|English Opening: Anglo-Dutch Variation, Chabanon Gambit|rnbqkbnr/ppp1p1pp/3p4/5p2/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq -
A10|English Opening: Anglo-Dutch Variation, Ferenc Gambit|rnbqkb1r/ppppp1pp/5n2/5p2/2P1P3/2N5/PP1P1PPP/R1BQKBNR b KQkq -
A10|English Opening: Anglo-Lithuanian Variation|r1bqkbnr/pppppppp/2n5/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A10|English Opening: Anglo-Scandinavian Defense|rnbqkbnr/ppp1pppp/8/3p4/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A10|English Opening: Anglo-Scandinavian Defense, Löhn Gambit|rnbqkbnr/ppp2ppp/4p3/3P4/8/8/PP1PPPPP/RNBQKBNR w KQkq -
A10|English Opening: Anglo-Scandinavian Defense, Malvinas Variation|rnb1kbnr/ppp1pppp/8/q7/8/2N5/PP1PPPPP/R1BQKBNR w KQkq -
A10|English Opening: Anglo-Scandinavian Defense, Schulz Gambit|rnbqkb1r/ppp1pppp/5n2/3P4/8/8/PP1PPPPP/RNBQKBNR w KQkq -
A10|English Opening: Great Snake Variation|rnbqkbnr/pppppp1p/6p1/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A10|English Opening: Jaenisch Gambit|rnbqkbnr/p1pppppp/8/1p6/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A10|English Opening: Myers Defense|rnbqkbnr/pppppp1p/8/6p1/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A10|English Opening: Myers Gambit|rnbqk1nr/ppppppbp/8/6p1/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A10|English Opening: Porcupine Variation|rnbqkb1r/ppppp1pp/5n2/8/2P1p1P1/2N5/PP1P1P1P/R1BQKBNR b KQkq -
A10|English Opening: Wade Gambit|rnbqkbnr/ppppp1pp/8/5p2/2P3P1/8/PP1PPP1P/RNBQKBNR b KQkq -
A10|English Opening: Zilbermints Gambit|rnbqkbnr/pppp1p1p/8/4p1p1/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A11|English Opening: Caro-Kann Defensive System|rnbqkbnr/pp1ppppp/2p5/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A11|Réti Opening: Anglo-Slav Variation, Gurevich System|rnbqkbnr/pp2pppp/2p5/3p4/2P5/4PN2/PP1P1PPP/RNBQKB1R b KQkq -
A11|Réti Opening: Anglo-Slav Variation, Gurevich System|rnbqkb1r/pp2pppp/2p2n2/3p4/2P5/4PN2/PPQP1PPP/RNB1KB1R b KQkq -
A11|Réti Opening: Anglo-Slav Variation, with g3|rnbqkb1r/pp2pp1p/2p2np1/3p4/2P5/1P3NP1/P2PPP1P/RNBQKB1R w KQkq -
A11|Réti Opening: Anglo-Slav Variation, with g3|rnbqkb1r/pp2pppp/2p2n2/3p4/2P5/5NP1/PP1PPPBP/RNBQK2R b KQkq -
A11|Réti Opening: Anglo-Slav Variation, with g3|rnbqkb1r/pp2pppp/2p2n2/8/2p5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A11|Réti Opening: Anglo-Slav Variation, with g3|rn1qkb1r/pp2pppp/2p2n2/3p1b2/2P5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A12|Réti Opening: Anglo-Slav Variation|rnbqkb1r/pp2pppp/2p2n2/3p4/2P5/1P3NP1/P2PPP1P/RNBQKB1R b KQkq -
A12|Réti Opening: Anglo-Slav Variation, Bled Variation|rnbqkb1r/pp2pp1p/2p2np1/3p4/2P5/1P3N2/PB1PPPPP/RN1QKB1R w KQkq -
A12|Réti Opening: Anglo-Slav Variation, Bogoljubow Variation|rnbqkbnr/pp2pppp/2p5/3p4/2P5/1P3N2/P2PPPPP/RNBQKB1R b KQkq -
A12|Réti Opening: Anglo-Slav Variation, Bogoljubow Variation|rn1qkbnr/pp2pppp/2p5/3p4/2P3b1/1P3N2/P2PPPPP/RNBQKB1R w KQkq -
A12|Réti Opening: Anglo-Slav Variation, Bogoljubow Variation|rn1qkbnr/pp2pppp/2p5/3p1b2/2P5/1P3N2/P2PPPPP/RNBQKB1R w KQkq -
A12|Réti Opening: Anglo-Slav Variation, Bogoljubow Variation|rn1qkbnr/pp2pppp/2p5/3p1b2/2P5/1P3N2/PB1PPPPP/RN1QKB1R b KQkq -
A12|Réti Opening: Anglo-Slav Variation, Capablanca Variation|rn1qkb1r/pp2pppp/2p2n2/3p4/2P3b1/1P3N2/PB1PPPPP/RN1QKB1R w KQkq -
A12|Réti Opening: Anglo-Slav Variation, London Defensive System|rn1qkb1r/pp2pppp/2p2n2/3p1b2/2P5/1P3NP1/P2PPP1P/RNBQKB1R w KQkq -
A12|Réti Opening: Anglo-Slav Variation, New York System|rn1qkb1r/pp2pppp/2p2n2/3p1b2/2P5/1P3N2/PB1PPPPP/RN1QKB1R w KQkq -
A12|Réti Opening: Anglo-Slav Variation, Torre System|rn1qkb1r/pp2pppp/2p2n2/3p4/2P3b1/1P3NP1/P2PPP1P/RNBQKB1R w KQkq -
A12|Réti Opening: Anglo-Slav Variation, with dxc4|rnbqkb1r/pp2pppp/2p2n2/8/2p5/1P3NP1/P2PPP1P/RNBQKB1R w KQkq -
A13|English Opening: Agincourt Defense|rnbqkbnr/pppp1ppp/4p3/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A13|English Opening: Agincourt Defense|rnbqkbnr/pppp1ppp/4p3/8/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq -
A13|English Opening: Agincourt Defense|rnbqkbnr/ppp2ppp/4p3/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A13|English Opening: Agincourt Defense|rnbq1rk1/ppp1bppp/4pn2/3p4/2P5/1P2PN2/PB1P1PPP/RN1QKB1R w KQ -
A13|English Opening: Agincourt Defense|rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/1P2PN2/PB3PPP/RN1QKB1R b KQ -
A13|English Opening: Agincourt Defense, Bogoljubow Defense|rnbqk2r/ppp2ppp/3bpn2/3p4/2P5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A13|English Opening: Agincourt Defense, Catalan Defense|rnbqkbnr/pp3ppp/4p3/2pp4/2P5/5NP1/PP1PPP1P/RNBQKB1R w KQkq -
A13|English Opening: Agincourt Defense, Catalan Defense Accepted|rnbqkb1r/ppp2ppp/4pn2/8/2p5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A13|English Opening: Agincourt Defense, Catalan Defense, Semi-Slav Defense|rnbqkb1r/pp3ppp/2p1pn2/3p4/2P5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A13|English Opening: Agincourt Defense, Kurajica Defense|rnbqkbnr/pp3ppp/2p1p3/3p4/2P5/5NP1/PP1PPP1P/RNBQKB1R w KQkq -
A13|English Opening: Neo-Catalan|rnbqkb1r/ppp2ppp/4pn2/3p4/2P5/5NP1/PP1PPP1P/RNBQKB1R w KQkq -
A13|English Opening: Neo-Catalan Declined|rnbqk2r/ppp1bppp/4pn2/3p4/2P5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A13|English Opening: Romanishin Gambit|rnbqkb1r/2pp1ppp/p3pn2/1p6/2P5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A14|Réti Opening: Anglo-Slav Variation|rnbqk2r/pp2bppp/2p1pn2/3p4/2P5/1P3NP1/PB1PPPBP/RN1QK2R b KQkq -
A15|English Opening: Anglo-Indian Defense|rnbqkb1r/pppppppp/5n2/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A15|English Opening: Anglo-Indian Defense, Anti-Anti-Grünfeld|rnbqk2r/ppppppbp/5np1/8/2P1P3/2N2N2/PP1P1PPP/R1BQKB1R b KQkq -
A15|English Opening: Anglo-Indian Defense, Grünfeld Formation|rnbqkb1r/ppp1pp1p/5np1/3p4/2P5/5NP1/PP1PPP1P/RNBQKB1R w KQkq -
A15|English Opening: Anglo-Indian Defense, King's Indian Formation|rnbqkb1r/pppppp1p/5np1/8/2P5/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A15|English Opening: Anglo-Indian Defense, King's Indian Formation, Double Fianchetto|rn1qkb1r/pbpppp1p/1p3np1/8/2P5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A15|English Opening: Anglo-Indian Defense, King's Knight Variation|rnbqkb1r/pppppppp/5n2/8/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq -
A15|English Opening: Anglo-Indian Defense, Old Indian Formation|rnbqkb1r/ppp1pppp/3p1n2/8/2P5/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A15|English Opening: Anglo-Indian Defense, Queen's Indian Formation|rnbqkb1r/p1pppppp/1p3n2/8/2P5/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A15|English Opening: Anglo-Indian Defense, Queen's Indian Formation|rn1qkb1r/pbpp1ppp/1p2pn2/8/2P5/5NP1/PP1PPPBP/RNBQK2R w KQkq -
A15|English Opening: Anglo-Indian Defense, Romanishin Variation|rnbqkb1r/1ppp1ppp/p3pn2/8/2P5/5NP1/PP1PPP1P/RNBQKB1R w KQkq -
A15|English Opening: Anglo-Indian Defense, Scandinavian Defense|rnbqkb1r/ppp1pppp/5n2/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A15|English Opening: Anglo-Indian Defense, Scandinavian Defense, Exchange Variation|rnbqkb1r/ppp1pppp/8/3n4/8/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A15|English Opening: Anglo-Indian Defense, Slav Formation|rnbqkb1r/pp1ppp1p/2p2np1/8/2P5/5NP1/PP1PPP1P/RNBQKB1R w KQkq -
A15|English Orangutan|rnbqkb1r/pppppppp/5n2/8/1PP5/8/P2PPPPP/RNBQKBNR b KQkq -
A15|English Orangutan|rnbqkb1r/pppppp1p/5np1/8/1PP5/5N2/P2PPPPP/RNBQKB1R b KQkq -
A16|English Opening: Anglo-Grünfeld Defense|rnbqkb1r/ppp1pppp/5n2/3p4/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq -
A16|English Opening: Anglo-Indian Defense, Anglo-Grünfeld Variation|rnbqkb1r/ppp1pppp/8/3n4/8/2N2N2/PP1PPPPP/R1BQKB1R b KQkq -
A16|English Opening: Anglo-Indian Defense, Anglo-Grünfeld Variation|rnbqkb1r/ppp1pp1p/6p1/3n4/8/2N2N2/PP1PPPPP/R1BQKB1R w KQkq -
A16|English Opening: Anglo-Indian Defense, Queen's Knight Variation|rnbqkb1r/pppppppp/5n2/8/2P5/2N5/PP1PPPPP/R1BQKBNR b KQkq -
A17|English Opening: Anglo-Indian Defense|rnbqkb1r/pp3ppp/4p3/2pn4/8/2N1PN2/PP1P1PPP/R1BQKB1R w KQkq -
A17|English Opening: Anglo-Indian Defense, Hedgehog System|rnbqkb1r/pppp1ppp/4pn2/8/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq -
A17|English Opening: Anglo-Indian Defense, Nimzo-English|rnbqk2r/pppp1ppp/4pn2/8/1bP5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq -
A17|English Opening: Anglo-Indian Defense, Queen's Indian Formation|rnbqkb1r/p1pp1ppp/1p2pn2/8/2P5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq -
A17|English Opening: Anglo-Indian Defense, Zvjaginsev-Krasenkow Attack|rnbqk2r/pppp1ppp/4pn2/8/1bP3P1/2N2N2/PP1PPP1P/R1BQKB1R b KQkq -
A18|English Opening: Mikenas-Carls Variation|rnbqkb1r/pppp1ppp/4pn2/8/2P1P3/2N5/PP1P1PPP/R1BQKBNR b KQkq -
A18|English Opening: Mikenas-Carls Variation|r1bqkb1r/pppp1ppp/2n1pn2/8/2P1P3/2N5/PP1P1PPP/R1BQKBNR w KQkq -
A18|English Opening: Mikenas-Carls Variation|rnbqkb1r/ppp2ppp/4pn2/3pP3/2P5/2N5/PP1P1PPP/R1BQKBNR b KQkq -
A19|English Opening: Anglo-Indian Defense, Flohr-Mikenas-Carls Variation, Nei Gambit|rnbqkbnr/pp1p1ppp/4p3/2p1P3/2P5/2N5/PP1P1PPP/R1BQKBNR w KQkq -
A19|English Opening: Mikenas-Carls, Sicilian|rnbqkb1r/pp1p1ppp/4pn2/2p5/2P1P3/2N5/PP1P1PPP/R1BQKBNR w KQkq -
A20|English Opening: Drill Variation|rnbqkbnr/pppp1pp1/8/4p2p/2P5/6P1/PP1PPP1P/RNBQKBNR w KQkq -
A20|English Opening: King's English Variation|rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A20|English Opening: King's English Variation, Kahiko-Hula Gambit|rnbqkb1r/pppp1ppp/5n2/8/2P2p2/4PN2/PP1P2PP/RNBQKB1R b KQkq -
A20|English Opening: King's English Variation, Nimzowitsch Variation|rnbqkbnr/pppp1ppp/8/4p3/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq -
A20|English Opening: King's English Variation, Nimzowitsch-Flohr Variation|rnbqkbnr/pppp1ppp/8/8/2P1p3/5N2/PP1PPPPP/RNBQKB1R w KQkq -
A21|English Opening: King's English Variation|rnbqkbnr/ppp2ppp/3p4/4p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R b KQkq -
A21|English Opening: King's English Variation, Keres Defense|rnbqkbnr/pp3ppp/2pp4/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR w KQkq -
A21|English Opening: King's English Variation, Kramnik-Shirov Counterattack|rnbqk1nr/pppp1ppp/8/4p3/1bP5/2N5/PP1PPPPP/R1BQKBNR w KQkq -
A21|English Opening: King's English Variation, Reversed Sicilian|rnbqkbnr/pppp1ppp/8/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR b KQkq -
A21|English Opening: King's English Variation, Smyslov Defense|rn1qkbnr/ppp2ppp/3p4/4p3/2P3b1/2N2N2/PP1PPPPP/R1BQKB1R w KQkq -
A21|English Opening: King's English Variation, Troger Defense|r2qkbnr/ppp2ppp/2npb3/4p3/2P5/2N3P1/PP1PPPBP/R1BQK1NR w KQkq -
A22|English Opening: Carls-Bremen System|rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR b KQkq -
A22|English Opening: King's English Variation, Adhiban Gambit|rnbqkb1r/pp1p1ppp/2p2n2/6N1/2P1p3/2N5/PP1PPPPP/R1BQKB1R w KQkq -
A22|English Opening: King's English Variation, Bellon Gambit|rnbqkb1r/p1pp1ppp/5n2/1p4N1/2P1p3/2N5/PP1PPPPP/R1BQKB1R w KQkq -
A22|English Opening: King's English Variation, Two Knights Variation|rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq -
A22|English Opening: King's English Variation, Two Knights Variation, Reversed Dragon|rnbqkb1r/ppp2ppp/5n2/3pp3/2P5/2N3P1/PP1PPP1P/R1BQKBNR w KQkq -
A22|English Opening: King's English Variation, Two Knights Variation, Smyslov System|rnbqk2r/pppp1ppp/5n2/4p3/1bP5/2N3P1/PP1PPP1P/R1BQKBNR w KQkq -
A22|English Opening: King's English, Erbenheimer Gambit|rnbqkb1r/pppp1ppp/8/6N1/2P1p1n1/2N5/PP1PPPPP/R1BQKB1R w KQkq -
A22|English Opening: King's English, Mazedonisch|rnbqkb1r/pppp1ppp/5n2/4p3/2P2P2/2N5/PP1PP1PP/R1BQKBNR b KQkq -
A23|English Opening: King's English Variation, Two Knights Variation, Keres Variation|rnbqkb1r/pp1p1ppp/2p2n2/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR w KQkq -
A23|English Opening: King's English Variation, Two Knights Variation, Keres Variation|rnbqk2r/pp1p1ppp/2p2n2/2b1p3/2P5/2N3P1/PP1PPPBP/R1BQK1NR w KQkq -
A24|English Opening: King's English Variation, Two Knights Variation, Fianchetto Line|rnbqkb1r/pppp1p1p/5np1/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR w KQkq -
A25|English Opening: King's English Variation, Reversed Closed Sicilian|r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq -
A25|English Opening: King's English Variation, Taimanov Variation|r1bqk1nr/pppp1pbp/2n3p1/4p3/2P5/2N3P1/PP1PPPBP/R1BQK1NR w KQkq -
A27|English Opening: King's English Variation, Three Knights System|r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R b KQkq -
A28|English Opening: Four Knights System, Nimzowitsch Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/2P1P3/2N2N2/PP1P1PPP/R1BQKB1R b KQkq -
A28|English Opening: King's English Variation, Four Knights Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq -
A28|English Opening: King's English Variation, Four Knights Variation, Bradley Beach Variation|r1bqkb1r/pppp1ppp/2n2n2/8/2PPp3/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
A28|English Opening: King's English Variation, Four Knights Variation, Flexible Line|r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/2NP1N2/PP2PPPP/R1BQKB1R b KQkq -
A28|English Opening: King's English Variation, Four Knights Variation, Korchnoi Line|r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/P1N2N2/1P1PPPPP/R1BQKB1R b KQkq -
A28|English Opening: King's English Variation, Four Knights Variation, Quiet Line|r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/2N1PN2/PP1P1PPP/R1BQKB1R b KQkq -
A29|English Opening: King's English Variation, Four Knights Variation, Fianchetto Line|r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/2N2NP1/PP1PPP1P/R1BQKB1R b KQkq -
A29|English Opening: King's English Variation, Four Knights Variation, Fianchetto Line|r1bqk2r/pppp1ppp/2n2n2/4p3/1bP5/2N2NP1/PP1PPP1P/R1BQKB1R w KQkq -
A30|English Opening: Symmetrical Variation|rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -
A30|English Opening: Symmetrical Variation|rnbqkbnr/pp1ppppp/8/2p5/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq -
A30|English Opening: Symmetrical Variation, Napolitano Gambit|rnbqkb1r/pp1ppppp/5n2/2p5/1PP5/5N2/P2PPPPP/RNBQKB1R b KQkq -
A30|English Opening: Wing Gambit|rnbqkbnr/pp1ppppp/8/2p5/1PP5/8/P2PPPPP/RNBQKBNR b KQkq -
A31|English Opening: Symmetrical Variation, Anti-Benoni Variation|rnbqkb1r/pp1ppppp/5n2/2p5/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq -
A32|English Opening: Symmetrical Variation, Anti-Benoni Variation, Spielmann Defense|rnbqkb1r/pp1p1ppp/4pn2/8/2PN4/8/PP2PPPP/RNBQKB1R w KQkq -
A34|English Opening: Symmetrical Variation|r1bqkb1r/pp2pppp/2n2n2/3p4/2Pp4/2N2NP1/PP2PP1P/R1BQKB1R w KQkq -
A34|English Opening: Symmetrical Variation, Fianchetto Variation|rnbqkb1r/pp1ppppp/5n2/2p5/2P5/2N3P1/PP1PPP1P/R1BQKBNR b KQkq -
A34|English Opening: Symmetrical Variation, Normal Variation|rnbqkbnr/pp1ppppp/8/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR b KQkq -
A34|English Opening: Symmetrical Variation, Three Knights Variation|rnbqkb1r/pp1ppppp/5n2/2p5/2P5/2N2N2/PP1PPPPP/R1BQKB1R b KQkq -
A35|English Opening: Symmetrical Variation|rnbqkb1r/pp1p1ppp/5n2/2p1p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq -
A35|English Opening: Symmetrical Variation, Four Knights Variation|r1bqkb1r/pp1ppppp/2n2n2/2p5/2P5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq -
A35|English Opening: Symmetrical Variation, Four Knights Variation, Keres-Parma System|r1bqkb1r/pp1p1ppp/2n1pn2/2p5/2P5/2N2NP1/PP1PPP1P/R1BQKB1R w KQkq -
A35|English Opening: Symmetrical Variation, Two Knights Variation|r1bqkbnr/pp1ppppp/2n5/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq -
A36|English Opening: Symmetrical Variation, Two Knights, Fianchetto Variation|r1bqkbnr/pp1ppppp/2n5/2p5/2P5/2N3P1/PP1PPP1P/R1BQKBNR b KQkq -
A36|English Opening: Symmetrical Variation, Ultra-Symmetrical Variation|r1bqk1nr/pp1pppbp/2n3p1/2p5/2P5/2N3P1/PP1PPPBP/R1BQK1NR w KQkq -
A40|Australian Defense|r1bqkbnr/pppppppp/n7/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Benoni Defense: Franco-Sicilian Hybrid|rnbqk2r/pp2npbp/3p2p1/2pP4/4P3/2N2N2/PP3PPP/R1BQKB1R w KQkq -
A40|Borg Defense: Borg Gambit|rnbqkbnr/pppppp1p/8/6p1/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Colle System: Pterodactyl Variation|rnb1k1nr/pp1pppbp/6p1/q1p5/3P4/3BPN2/PPP2PPP/RNBQK2R w KQkq -
A40|Colle System: Siroccopteryx Variation|rnb1k1nr/pp1pppbp/6p1/q7/3N4/3BP3/PPP2PPP/RNBQK2R w KQkq -
A40|English Defense|rnbqkbnr/p1pppppp/1p6/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|English Defense|rnbqkbnr/p1pp1ppp/1p2p3/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A40|English Defense: Eastbourne Gambit|rn1qkbnr/pbpp1ppp/1p6/4p3/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
A40|English Defense: Hartlaub Gambit Accepted|rn1qkb1r/pbpp2pp/1p2pn2/5P2/2PP4/2N5/PP3PPP/R1BQKBNR w KQkq -
A40|English Defense: Hartlaub Gambit Declined|rn1qkbnr/pbpp2pp/1p2p3/3P1p2/2P1P3/2N5/PP3PPP/R1BQKBNR b KQkq -
A40|English Defense: Perrin Variation|r2qkbnr/pbpp1ppp/1pn1p3/8/2PPP3/3B4/PP3PPP/RNBQK1NR w KQkq -
A40|English Defense: Poli Gambit|rn1qkb1r/pbpp2pp/1p2p2n/5P2/2PP4/5P2/PP4PP/RNBQKBNR w KQkq -
A40|Englund Gambit|rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Englund Gambit Declined|rnbqkbnr/pppp1ppp/8/3Pp3/8/8/PPP1PPPP/RNBQKBNR b KQkq -
A40|Englund Gambit Declined: Diemer Counterattack|rnb1k1nr/pppp1ppp/8/2bPp3/4P2q/8/PPP2PPP/RNBQKBNR w KQkq -
A40|Englund Gambit Declined: Reversed Alekhine|rnbqkbnr/pppp1ppp/8/4p3/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq -
A40|Englund Gambit Declined: Reversed Brooklyn|rnbqkbnr/pppp1ppp/8/8/3Pp3/8/PPP1PPPP/RNBQKBNR b KQkq -
A40|Englund Gambit Declined: Reversed French|rnbqkbnr/pppp1ppp/8/4p3/3P4/4P3/PPP2PPP/RNBQKBNR b KQkq -
A40|Englund Gambit Declined: Reversed Krebs|rnbqkbnr/pppp1ppp/8/8/3Pp3/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A40|Englund Gambit Declined: Reversed Mokele Mbembe|rnbqkbnr/pppp1ppp/8/4N3/3Pp3/8/PPP1PPPP/RNBQKB1R b KQkq -
A40|Englund Gambit: Felbecker Gambit|r1bqk1nr/pppp1ppp/2n5/2b1P3/8/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A40|Englund Gambit: Hartlaub-Charlick Gambit|rnbqkbnr/ppp2ppp/3p4/4P3/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Englund Gambit: Main Line|r1b1kbnr/ppppqppp/2n5/4P3/8/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A40|Englund Gambit: Mosquito Gambit|rnb1kbnr/pppp1ppp/8/4P3/7q/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Englund Gambit: Soller Gambit|rnbqkbnr/pppp2pp/5p2/4P3/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Englund Gambit: Soller Gambit Deferred|r1bqkbnr/pppp2pp/2n2p2/4P3/8/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A40|Englund Gambit: Stockholm Variation|r1b1kbnr/ppppqppp/2n5/3QP3/8/5N2/PPP1PPPP/RNB1KB1R b KQkq -
A40|Englund Gambit: Zilbermints Gambit|r1bqkb1r/ppppnppp/2n5/4P3/8/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A40|Horwitz Defense|rnbqkbnr/pppp1ppp/4p3/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Horwitz Defense: Zilbermints Gambit|rnbqkbnr/pppp1ppp/8/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A40|Kangaroo Defense|rnbqk1nr/pppp1ppp/4p3/8/1bPP4/8/PP2PPPP/RNBQKBNR w KQkq -
A40|Kangaroo Defense: Keres Defense, Transpositional Variation|rnbqk1nr/pppp1ppp/4p3/8/1bPP4/2N5/PP2PPPP/R1BQKBNR b KQkq -
A40|Mikenas Defense|r1bqkbnr/pppppppp/2n5/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Mikenas Defense: Cannstatter Variation|r1bqkbnr/pppp1ppp/8/3Pp3/2Pn4/8/PP2PPPP/RNBQKBNR w KQkq -
A40|Mikenas Defense: Lithuanian Variation|r1bqkbnr/ppppnppp/8/3Pp3/2P5/8/PP2PPPP/RNBQKBNR w KQkq -
A40|Mikenas Defense: Pozarek Gambit|r1bqkbnr/pppp1ppp/8/8/2n5/2N5/PP2PPPP/R1BQKBNR w KQkq -
A40|Modern Defense: Beefeater Variation|rnbqk1nr/pp1pp2p/6p1/2pP1p2/2P5/2P5/P3PPPP/R1BQKBNR w KQkq -
A40|Modern Defense: Lizard Defense, Pirc-Diemer Gambit|rnbqkb1r/pppppp1p/5np1/7P/3P4/8/PPP1PPP1/RNBQKBNR b KQkq -
A40|Montevideo Defense|rnbqkbnr/pppppppp/8/3P4/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Polish Defense|rnbqkbnr/p1pppppp/8/1p6/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Polish Defense: Spassky Gambit Accepted|rn1qkbnr/pbpppppp/8/1B6/3PP3/8/PPP2PPP/RNBQK1NR b KQkq -
A40|Pterodactyl Defense: Central, Benoni Pterodactyl|rnb1k1nr/pp1pppbp/6p1/q1pP4/2P1P3/8/PP3PPP/RNBQKBNR w KQkq -
A40|Pterodactyl Defense: Fianchetto, Queen Benoni Pterodactyl|rnb1k1nr/pp1pppbp/6p1/q1pP4/2P5/2N5/PP2PPPP/R1BQKBNR w KQkq -
A40|Pterodactyl Defense: Fianchetto, Queen Pterodactyl|rnb1k1nr/pp1pppbp/6p1/q1p5/3P4/5NP1/PPP1PPBP/RNBQK2R w KQkq -
A40|Pterodactyl Defense: Queen Pterodactyl, Quiet Line|rnbqk1nr/pp1pppbp/6p1/2p5/2PP4/2N1P3/PP3PPP/R1BQKBNR b KQkq -
A40|Queen's Pawn Game|rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -
A40|Queen's Pawn Game: Anglo-Slav Opening|rnbqkbnr/pp2pppp/2pp4/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A40|Queen's Pawn Game: Modern Defense|rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A40|Slav Indian: Kudischewitsch Gambit|rnbqkb1r/p2ppppp/2p2n2/1p6/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
A40|Zaire Defense|rnbqkbnr/pppppppp/8/3PP3/8/8/PPP2PPP/RNBQKBNR w KQkq -
A41|Modern Defense|rnbqk1nr/ppp1ppbp/3p2p1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
A41|Modern Defense: Neo-Modern Defense|rnbqk1nr/pppp1pbp/6p1/4p3/2PPP3/8/PP3PPP/RNBQKBNR w KQkq -
A41|Old Indian Defense|rnbqkbnr/ppp1pppp/3p4/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -
A41|Queen's Pawn Game|rnbqkbnr/ppp1pppp/3p4/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A41|Queen's Pawn Game: Rossolimo Variation|rnbqkbnr/ppp1pp1p/3p2p1/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A41|Rat Defense: English Rat|rnbqkbnr/ppp2ppp/3p4/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A41|Rat Defense: English Rat, Lisbon Gambit|r1bqkbnr/ppp2ppp/2np4/4P3/2P5/8/PP2PPPP/RNBQKBNR w KQkq -
A41|Rat Defense: English Rat, Pounds Gambit|rn1qkbnr/ppp2ppp/3pb3/4P3/2P5/8/PP2PPPP/RNBQKBNR w KQkq -
A41|Robatsch Defense: Rossolimo Variation|rn1qk1nr/ppp1ppbp/3p2p1/8/2PPP1b1/5N2/PP3PPP/RNBQKB1R w KQkq -
A41|Wade Defense|rn1qkbnr/ppp1pppp/3p4/8/3P2b1/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A41|Zukertort Opening: Wade Defense, Chigorin Plan|1r1qkbnr/pppnpppp/3p4/8/2PP2b1/1Q3N2/PP2PPPP/RNB1KB1R w KQk -
A42|Modern Defense: Averbakh System|rnbqk1nr/ppp1ppbp/3p2p1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq -
A42|Modern Defense: Kotov Variation|r1bqk1nr/ppp1ppbp/2np2p1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq -
A42|Modern Defense: Randspringer Variation|rnbqk1nr/ppp1p1bp/3p2p1/5p2/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq -
A42|Pterodactyl Defense|rnb1k1nr/pp2ppbp/3p2p1/q1p5/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq -
A43|Benoni Defense: Benoni Gambit Accepted|rnbqkbnr/pp1ppppp/8/2P5/8/8/PPP1PPPP/RNBQKBNR b KQkq -
A43|Benoni Defense: Benoni Gambit, Schlenker Defense|r1bqkbnr/pp1ppppp/n7/2P5/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A43|Benoni Defense: Benoni-Indian Defense|rnbqkb1r/pp1ppppp/5n2/2pP4/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A43|Benoni Defense: Benoni-Indian Defense, Kingside Move Order|rnbqkb1r/pp1ppppp/5n2/2pP4/8/5N2/PPP1PPPP/RNBQKB1R b KQkq -
A43|Benoni Defense: Benoni-Staunton Gambit|rnbqkbnr/pp1pp1pp/8/2pP1p2/4P3/8/PPP2PPP/RNBQKBNR b KQkq -
A43|Benoni Defense: Cormorant Gambit|rnbqkbnr/p2ppppp/1p6/2P5/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A43|Benoni Defense: French Benoni|rnbqkbnr/pp1p1ppp/4p3/2pP4/4P3/8/PPP2PPP/RNBQKBNR b KQkq -
A43|Benoni Defense: Hawk Variation|rnbqkb1r/pp1ppppp/5n2/3P4/2p5/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A43|Benoni Defense: Old Benoni|rnbqkbnr/pp1ppppp/8/2p5/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A43|Benoni Defense: Old Benoni|rnbqkbnr/pp1ppppp/8/2pP4/8/8/PPP1PPPP/RNBQKBNR b KQkq -
A43|Benoni Defense: Old Benoni|rnbqkbnr/pp2pppp/3p4/2pP4/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A43|Benoni Defense: Old Benoni, Mujannah Formation|rnbqkbnr/pp1pp1pp/8/2pP1p2/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A43|Benoni Defense: Old Benoni, Schmid Variation|rnbqkbnr/pp2pp1p/3p2p1/2pP4/8/2N5/PPP1PPPP/R1BQKBNR w KQkq -
A43|Benoni Defense: Snail Variation|r1bqkbnr/pp1ppppp/n7/2pP4/8/8/PPP1PPPP/RNBQKBNR w KQkq -
A43|Benoni Defense: Woozle|rnb1kb1r/pp1ppppp/5n2/q1pP4/8/2N5/PPP1PPPP/R1BQKBNR w KQkq -
A43|Benoni Defense: Zilbermints-Benoni Gambit|rnbqkbnr/pp1ppppp/8/2p5/1P1P4/8/P1P1PPPP/RNBQKBNR b KQkq -
A43|Benoni Defense: Zilbermints-Benoni Gambit|rnbqkbnr/pp1ppppp/8/8/1P1p4/5N2/P1P1PPPP/RNBQKB1R b KQkq -
A43|Benoni Defense: Zilbermints-Benoni Gambit, Tamarkin Countergambit|rnbqkbnr/pp1p1ppp/8/4p3/1P1p4/5N2/P1P1PPPP/RNBQKB1R w KQkq -
A43|Indian Defense: Pseudo-Benko|rnbqkb1r/p2ppppp/5n2/1ppP4/8/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A43|Queen's Pawn Game: Liedmann Gambit|rnbqkbnr/pp1ppppp/8/8/2Pp4/4P3/PP3PPP/RNBQKBNR b KQkq -
A44|Benoni Defense: Old Benoni|rnbqkbnr/pp1p1ppp/8/2pPp3/8/8/PPP1PPPP/RNBQKBNR w KQkq e6
A44|Benoni Defense: Semi-Benoni|rnbqkbnr/pp3ppp/3p4/2pPp3/4P3/8/PPP2PPP/RNBQKBNR w KQkq -
A45|Amazon Attack: Siberian Attack|rnbqkb1r/ppp1pppp/5n2/3p4/3P4/2NQ4/PPP1PPPP/R1B1KBNR b KQkq -
A45|Basque Opening|rnbqkb1r/pppppppp/5n2/8/3P4/1P6/P1P1PPPP/RNBQKBNR b KQkq -
A45|Canard Opening|rnbqkb1r/pppppppp/5n2/8/3P1P2/8/PPP1P1PP/RNBQKBNR b KQkq -
A45|Indian Defense|rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A45|Indian Defense: Accelerated London System|rnbqkb1r/pppppppp/5n2/8/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq -
A45|Indian Defense: Gedult Attack|rnbqkb1r/ppp1pppp/5n2/3p4/3P2P1/5P2/PPP1P2P/RNBQKBNR b KQkq -
A45|Indian Defense: Gibbins-Weidenhagen Gambit|rnbqkb1r/pppppppp/5n2/8/3P2P1/8/PPP1PP1P/RNBQKBNR b KQkq -
A45|Indian Defense: Gibbins-Weidenhagen Gambit Accepted|rnbqkb1r/pppppppp/8/8/3P2n1/8/PPP1PP1P/RNBQKBNR w KQkq -
A45|Indian Defense: Gibbins-Weidenhagen Gambit, Maltese Falcon|rnbqkb1r/pppppppp/5n2/8/3PP3/5P2/PPP4P/RNBQKBNR b KQkq -
A45|Indian Defense: Gibbins-Weidenhagen Gambit, Oshima Defense|rnbqkb1r/pppp1ppp/5n2/4p3/3P2P1/8/PPP1PP1P/RNBQKBNR w KQkq -
A45|Indian Defense: Lazard Gambit|rnbqkb1r/pppp1ppp/5n2/4p3/3P4/8/PPPNPPPP/R1BQKBNR w KQkq -
A45|Indian Defense: Maddigan Gambit|rnbqkb1r/pppp1ppp/5n2/4p3/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
A45|Indian Defense: Omega Gambit|rnbqkb1r/pppppppp/5n2/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
A45|Indian Defense: Omega Gambit, Arafat Gambit|rnbqkb1r/pppppppp/5n2/6B1/3P4/3B4/PPP2PPP/RN1QK1NR b KQkq -
A45|Indian Defense: Paleface Attack, Blackmar-Diemer Gambit Deferred|rnbqkb1r/ppp1pppp/5n2/3p4/3PP3/5P2/PPP3PP/RNBQKBNR b KQkq -
A45|Indian Defense: Pawn Push Variation|rnbqkb1r/pppppppp/5n2/3P4/8/8/PPP1PPPP/RNBQKBNR b KQkq -
A45|Indian Defense: Reversed Chigorin Defense|rnbqkb1r/pp1ppppp/5n2/2p5/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
A45|Indian Defense: Tartakower Attack|rnbqkb1r/pppppppp/5n2/8/3P4/6P1/PPP1PP1P/RNBQKBNR b KQkq -
A45|Paleface Attack|rnbqkb1r/pppppppp/5n2/8/3P4/5P2/PPP1P1PP/RNBQKBNR b KQkq -
A45|Queen's Pawn Game: Chigorin Variation|rnbqkb1r/ppp1pppp/5n2/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
A45|Queen's Pawn Game: Veresov, Richter Attack|rnbqkb1r/ppp1pppp/5n2/3p4/3P4/2N2P2/PPP1P1PP/R1BQKBNR b KQkq -
A45|Trompowsky Attack|rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR b KQkq -
A45|Trompowsky Attack: Borg Variation|rnbqkb1r/pppppp1p/8/6p1/3PnB2/8/PPP1PPPP/RN1QKBNR w KQkq -
A45|Trompowsky Attack: Classical Defense|rnbqkb1r/pppp1ppp/4pn2/6B1/3P4/8/PPP1PPPP/RN1QKBNR w KQkq -
A45|Trompowsky Attack: Classical Defense, Big Center Variation|rnbqkb1r/pppp1ppp/4pn2/6B1/3PP3/8/PPP2PPP/RN1QKBNR b KQkq -
A45|Trompowsky Attack: Edge Variation|rnbqkb1r/pppppppp/8/8/3Pn2B/8/PPP1PPPP/RN1QKBNR b KQkq -
A45|Trompowsky Attack: Poisoned Pawn Variation|rnb1kb1r/pp1ppppp/1q3n2/2pP2B1/8/2N5/PPP1PPPP/R2QKBNR b KQkq -
A45|Trompowsky Attack: Raptor Variation|rnbqkb1r/pppppppp/8/6B1/3Pn2P/8/PPP1PPP1/RN1QKBNR b KQkq -
A45|Trompowsky Attack: Raptor Variation, Hergert Gambit|rnbqkb1r/pppp1ppp/8/4p1P1/3P4/8/PPP1PPP1/RN1QKBNR w KQkq -
A46|Döry Defense|rnbqkb1r/pppppppp/8/8/3Pn3/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A46|Indian Defense: Czech-Indian|rnbqkb1r/pp1ppppp/2p2n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A46|Indian Defense: Knights Variation|rnbqkb1r/pppppppp/5n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq -
A46|Indian Defense: Knights Variation, Alburt-Miles Variation|rnbqkb1r/1ppppppp/p4n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A46|Indian Defense: London System|rnbqkb1r/pppp1ppp/4pn2/8/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq -
A46|Indian Defense: Polish Variation|rnbqkb1r/p1pppppp/5n2/1p6/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A46|Indian Defense: Spielmann-Indian|rnbqkb1r/pp1ppppp/5n2/2p5/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A46|Indian Defense: Wade-Tartakower Defense|rnbqkb1r/ppp1pppp/3p1n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A46|Queen's Pawn Game: Veresov Attack, Classical Defense|rnbqkb1r/ppp2ppp/4pn2/3p2B1/3P4/2N2N2/PPP1PPPP/R2QKB1R b KQkq -
A46|Torre Attack: Classical Defense|rnbqkb1r/pppp1ppp/4pn2/6B1/3P4/5N2/PPP1PPPP/RN1QKB1R b KQkq -
A46|Torre Attack: Classical Defense, Nimzowitsch Variation|rnbqkb1r/pppp1pp1/4pn1p/6B1/3P4/5N2/PPP1PPPP/RN1QKB1R w KQkq -
A46|Torre Attack: Wagner Gambit|rnbqkb1r/pp1p1ppp/4pn2/2p3B1/3PP3/5N2/PPP2PPP/RN1QKB1R b KQkq -
A46|Yusupov-Rubinstein System|rnbqkb1r/pppp1ppp/4pn2/8/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq -
A47|Indian Defense: Schnepper Gambit|rnbqkb1r/p1pp1ppp/1p3n2/4p3/3P4/2P2N2/PP2PPPP/RNBQKB1R w KQkq -
A47|Marienbad System|rn1qkb1r/pb1ppppp/1p3n2/2p5/3P4/5NP1/PPP1PPBP/RNBQK2R w KQkq -
A47|Marienbad System: Berg Variation|rn1qkb1r/pb1ppppp/1p3n2/8/2PQ4/5NP1/PP2PPBP/RNB1K2R b KQkq -
A47|Pseudo Queen's Indian Defense|rnbqkb1r/p1pppppp/1p3n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A47|Pseudo Queen's Indian Defense|rn1qk2r/pb1pbppp/1p2pn2/2p5/3P4/1P1BPN2/P1PN1PPP/R1BQK2R w KQkq -
A48|East Indian Defense|rnbqkb1r/pppppp1p/5np1/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A48|Indian Defense: Colle System, King's Indian Variation|rnbqk2r/ppp1ppbp/3p1np1/8/3P4/3BPN2/PPP2PPP/RNBQK2R w KQkq -
A48|London System|rnbqkb1r/pppppp1p/5np1/8/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq -
A48|London System|rnbqk2r/ppppppbp/5np1/8/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq -
A48|London System|rnbqk2r/ppp1ppbp/3p1np1/8/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq -
A48|London System, with Bd3|rnbqk2r/ppp1ppbp/3p1np1/8/3P1B2/3BPN2/PPP2PPP/RN1QK2R b KQkq -
A48|London System, with Be2|rnbqk2r/ppp1ppbp/3p1np1/8/3P1B2/4PN2/PPP1BPPP/RN1QK2R b KQkq -
A48|London System, with Be2|rnbq1rk1/ppp1ppbp/3p1np1/8/3P1B2/4PN2/PPP1BPPP/RN1QK2R w KQ -
A48|London System, with Be2|rnbqk2r/pp2ppbp/3p1np1/2p5/3P1B2/4PN1P/PPP1BPP1/RN1QK2R b KQkq -
A48|Queen's Pawn Game: Barry Attack|rnbqkb1r/ppp1pp1p/5np1/3p4/3P1B2/2N2N2/PPP1PPPP/R2QKB1R b KQkq -
A48|Queen's Pawn Game: Barry Attack|rnbqk2r/ppp1ppbp/5np1/3p4/3P1B2/2N2N2/PPP1PPPP/R2QKB1R w KQkq -
A48|Torre Attack: Fianchetto Defense|rnbqkb1r/pppppp1p/5np1/6B1/3P4/5N2/PPP1PPPP/RN1QKB1R b KQkq -
A48|Torre Attack: Fianchetto Defense, Euwe Variation|rnbqk2r/pp1pppbp/5np1/2p3B1/3P4/5N2/PPPNPPPP/R2QKB1R w KQkq -
A49|Indian Defense: Przepiorka Variation|rnbqkb1r/pppppp1p/5np1/8/3P4/5NP1/PPP1PP1P/RNBQKB1R b KQkq -
A50|Indian Defense: Medusa Gambit|rnbqkb1r/pppppp1p/5n2/6p1/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A50|Indian Defense: Normal Variation|rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -
A50|Indian Defense: Pyrenees Gambit|rnbqkb1r/p1pppppp/5n2/1p6/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A50|Mexican Defense|r1bqkb1r/pppppppp/2n2n2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A50|Mexican Defense: Horsefly Gambit|r1bqkb1r/pppppppp/5n2/3Pn3/2P2P2/8/PP2P1PP/RNBQKBNR b KQkq -
A50|Queen's Indian Accelerated|rnbqkb1r/p1pppppp/1p3n2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A50|Slav Indian|rnbqkb1r/pp1ppppp/2p2n2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A51|Indian Defense: Budapest Gambit|rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A51|Indian Defense: Budapest Gambit Accepted|rnbqkb1r/pppp1ppp/5n2/4P3/2P5/8/PP2PPPP/RNBQKBNR b KQkq -
A51|Indian Defense: Budapest Gambit Accepted, Fajarowicz Defense|rnbqkb1r/pppp1ppp/8/4P3/2P1n3/8/PP2PPPP/RNBQKBNR w KQkq -
A51|Indian Defense: Budapest Gambit Accepted, Fajarowicz Defense, Bonsdorf Variation|rnbqkb1r/pppp1ppp/8/4P3/2P1n3/P7/1P2PPPP/RNBQKBNR b KQkq -
A51|Indian Defense: Budapest Gambit Accepted, Fajarowicz Defense, Steiner Variation|rnbqkb1r/pppp1ppp/8/4P3/2P1n3/8/PPQ1PPPP/RNB1KBNR b KQkq -
A52|Indian Defense: Budapest Gambit Accepted, Main Line|rnbqkb1r/pppp1ppp/8/4P3/2P3n1/8/PP2PPPP/RNBQKBNR w KQkq -
A52|Indian Defense: Budapest Gambit Accepted, Main Line, Adler Variation|rnbqkb1r/pppp1ppp/8/4P3/2P3n1/5N2/PP2PPPP/RNBQKB1R b KQkq -
A52|Indian Defense: Budapest Gambit Accepted, Main Line, Alekhine Variation|rnbqkb1r/pppp1ppp/8/4P3/2P1P1n1/8/PP3PPP/RNBQKBNR b KQkq -
A52|Indian Defense: Budapest Gambit Accepted, Main Line, Alekhine Variation, Abonyi Variation|rnbqkb1r/pppp1ppp/8/4n3/2P1P3/8/PP3PPP/RNBQKBNR w KQkq -
A52|Indian Defense: Budapest Gambit Accepted, Main Line, Alekhine Variation, Tartakower Defense|rnbqkb1r/ppp2ppp/3p4/4P3/2P1P1n1/8/PP3PPP/RNBQKBNR w KQkq -
A52|Indian Defense: Budapest Gambit Accepted, Main Line, Rubinstein Variation|rnbqkb1r/pppp1ppp/8/4P3/2P2Bn1/8/PP2PPPP/RN1QKBNR b KQkq -
A53|Old Indian Defense|rnbqkb1r/ppp1pppp/3p1n2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A53|Old Indian Defense: Aged Gibbon Gambit|rnbqkb1r/ppp1pppp/3p1n2/8/2PP2P1/8/PP2PP1P/RNBQKBNR b KQkq -
A53|Old Indian Defense: Czech Variation, with Nc3|rnbqkb1r/pp2pppp/2pp1n2/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
A53|Old Indian Defense: Czech Variation, with Nf3|rnbqkb1r/pp2pppp/2pp1n2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
A53|Old Indian Defense: Janowski Variation|rn1qkb1r/ppp1pppp/3p1n2/5b2/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
A53|Old Indian Defense: Janowski Variation, Fianchetto Variation|rn1qkb1r/ppp1pppp/3p1n2/5b2/2PP4/2N3P1/PP2PP1P/R1BQKBNR b KQkq -
A53|Old Indian Defense: Janowski Variation, Grinberg Gambit|rn1qkb1r/ppp1pppp/3p1n2/5b2/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq -
A53|Old Indian Defense: Janowski Variation, Main Line|rn1qkb1r/ppp1pppp/3p1n2/5b2/2PP4/2N2P2/PP2P1PP/R1BQKBNR b KQkq -
A54|Old Indian Defense: Duz-Khotimirsky Variation|r1bqkb1r/pppn1ppp/3p1n2/4p3/2PP4/2NBP3/PP3PPP/R1BQK1NR b KQkq -
A54|Old Indian Defense: Tartakower-Indian|rn1qkb1r/ppp1pppp/3p1n2/8/2PP2b1/5N2/PP2PPPP/RNBQKB1R w KQkq -
A54|Old Indian Defense: Two Knights Variation|rnbqkb1r/ppp2ppp/3p1n2/4p3/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
A54|Old Indian Defense: Ukrainian Variation|rnbqkb1r/ppp2ppp/3p1n2/4p3/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
A55|Old Indian Defense: Normal Variation|r1bqkb1r/pppn1ppp/3p1n2/4p3/2PPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq -
A56|Benoni Defense|rnbqkb1r/pp1ppppp/5n2/2p5/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A56|Benoni Defense: Czech Benoni Defense|rnbqkb1r/pp1p1ppp/5n2/2pPp3/2P5/8/PP2PPPP/RNBQKBNR w KQkq e6
A56|Benoni Defense: Hromádka System|rnbqkb1r/pp2pppp/3p1n2/2pP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq -
A56|Benoni Defense: King's Indian System|rnbqkb1r/pp3p1p/3p1np1/2pPp3/2P1P3/2N5/PP3PPP/R1BQKBNR w KQkq -
A56|Benoni Defense: Weenink Variation|rnbqkb1r/pp1p1ppp/4pn2/2P5/2P5/8/PP2PPPP/RNBQKBNR w KQkq -
A56|Vulture Defense|rnbqkb1r/pp1ppppp/8/2pP4/2P1n3/8/PP2PPPP/RNBQKBNR w KQkq -
A57|Benko Gambit|rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq -
A57|Benko Gambit Accepted|rnbqkb1r/3ppppp/p4n2/1PpP4/8/8/PP2PPPP/RNBQKBNR w KQkq -
A57|Benko Gambit Accepted: Dlugy Variation|rnbqkb1r/3ppppp/p4n2/1PpP4/8/5P2/PP2P1PP/RNBQKBNR b KQkq -
A57|Benko Gambit Accepted: Modern Variation|rnbqkb1r/3ppppp/p4n2/1PpP4/8/4P3/PP3PPP/RNBQKBNR b KQkq -
A57|Benko Gambit Accepted: Pawn Return Variation|rnbqkb1r/3ppppp/pP3n2/2pP4/8/8/PP2PPPP/RNBQKBNR b KQkq -
A57|Benko Gambit Declined: Bishop Attack|rnbqkb1r/p2ppppp/5n2/1ppP2B1/2P5/8/PP2PPPP/RN1QKBNR b KQkq -
A57|Benko Gambit Declined: Hjørring Countergambit|rnbqkb1r/p2ppppp/5n2/1ppP4/2P1P3/8/PP3PPP/RNBQKBNR b KQkq -
A57|Benko Gambit Declined: Main Line|rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/5N2/PP2PPPP/RNBQKB1R b KQkq -
A57|Benko Gambit Declined: Pseudo-Sämisch|rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/5P2/PP2P1PP/RNBQKBNR b KQkq -
A57|Benko Gambit Declined: Quiet Line|rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP1NPPPP/R1BQKBNR b KQkq -
A57|Benko Gambit Declined: Sosonko Variation|rnbqkb1r/p2ppppp/5n2/1ppP4/P1P5/8/1P2PPPP/RNBQKBNR b KQkq -
A57|Benko Gambit: Mutkin Countergambit|rnbqkb1r/p2ppppp/5n2/1ppP4/2P3P1/8/PP2PP1P/RNBQKBNR b KQkq -
A57|Benko Gambit: Nescafe Frappe Attack|rnbqkb1r/4pppp/3p1n2/1NpP4/1pB1P3/8/PP3PPP/R1BQK1NR b KQkq -
A57|Benko Gambit: Zaitsev System|rnbqkb1r/3ppppp/p4n2/1PpP4/8/2N5/PP2PPPP/R1BQKBNR b KQkq -
A58|Benko Gambit Accepted: Central Storming Variation|rn1qkb1r/3ppp1p/b4np1/2pP4/5P2/2N5/PP2P1PP/R1BQKBNR b KQkq -
A58|Benko Gambit Accepted: Fianchetto Variation|rn1qk2r/4ppbp/b2p1np1/2pP4/8/2N2NP1/PP2PPBP/R1BQK2R b KQkq -
A58|Benko Gambit Accepted: Fully Accepted Variation|rnbqkb1r/3ppppp/P4n2/2pP4/8/8/PP2PPPP/RNBQKBNR b KQkq -
A58|Benko Gambit: Fianchetto Variation|rn1qkb1r/4pp1p/b2p1np1/2pP4/8/2N2NP1/PP2PP1P/R1BQKB1R b KQkq -
A58|Benko Gambit: Nd2 Variation|rn1qkb1r/4pp1p/b2p1np1/2pP4/8/2N5/PP1NPPPP/R1BQKB1R b KQkq -
A59|Benko Gambit|rn1qkb1r/4pp1p/3p1np1/2pP4/4P3/2N3P1/PP3P1P/R1BQ1KNR b kq -
A59|Benko Gambit Accepted: King Walk Variation|rn1q1rk1/4ppbp/3p1np1/2pP4/4P3/2N2NP1/PP3PKP/R1BQ3R b - -
A59|Benko Gambit Accepted: Yugoslav|rn1qkb1r/4pppp/b2p1n2/2pP4/4P3/2N5/PP3PPP/R1BQKBNR b KQkq -
A59|Benko Gambit Accepted: Yugoslav|rn1qkb1r/4pp1p/3p1np1/2pP4/4P3/2N5/PP2NPPP/R1BQ1K1R b kq -
A60|Benoni Defense: Modern Variation|rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq -
A61|Benoni Defense|rnbqkb1r/pp3p1p/3p1np1/2pP4/8/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
A61|Benoni Defense: Fianchetto Variation|rnbqkb1r/pp3p1p/3p1np1/2pP4/8/2N2NP1/PP2PP1P/R1BQKB1R b KQkq -
A61|Benoni Defense: Knight's Tour Variation|rnbqkb1r/pp3p1p/3p1np1/2pP4/8/2N5/PP1NPPPP/R1BQKB1R b KQkq -
A61|Benoni Defense: Uhlmann Variation|rnbqkb1r/pp3p1p/3p1np1/2pP2B1/8/2N2N2/PP2PPPP/R2QKB1R b KQkq -
A62|Benoni Defense: Fianchetto Variation|rnbq1rk1/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PPBP/R1BQK2R w KQ -
A65|Benoni Defense: King's Pawn Line|rnbqkb1r/pp3ppp/3p1n2/2pP4/4P3/2N5/PP3PPP/R1BQKBNR b KQkq -
A65|Benoni Defense: King's Pawn Line|rnbqk2r/pp3pbp/3p1np1/2pP4/4P3/2N2P2/PP4PP/R1BQKBNR w KQkq -
A65|Benoni Defense: King's Pawn Line|rnbq1rk1/pp3pbp/3p1np1/2pP4/4P3/2N1BP2/PP1Q2PP/R3KBNR b KQ -
A66|Benoni Defense: Mikenas Variation|rnbqk2r/pp3pbp/3p1np1/2pPP3/5P2/2N5/PP4PP/R1BQKBNR b KQkq -
A66|Benoni Defense: Pawn Storm Variation|rnbqkb1r/pp3p1p/3p1np1/2pP4/4PP2/2N5/PP4PP/R1BQKBNR b KQkq -
A67|Benoni Defense: Taimanov Variation|rnbqk2r/pp3pbp/3p1np1/1BpP4/4PP2/2N5/PP4PP/R1BQK1NR b KQkq -
A68|Benoni Defense: Four Pawns Attack|rnbq1rk1/pp3pbp/3p1np1/2pP4/4PP2/2N2N2/PP4PP/R1BQKB1R w KQ -
A70|Benoni Defense: Classical Variation|rnbqkb1r/pp3p1p/3p1np1/2pP4/4P3/2N2N2/PP3PPP/R1BQKB1R b KQkq -
A72|Benoni Defense: Classical Variation|rnbq1rk1/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQK2R w KQ -
A80|Dutch Defense|rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
A80|Dutch Defense: Alapin Variation|rnbqkbnr/ppppp1pp/8/5p2/3P4/3Q4/PPP1PPPP/RNB1KBNR b KQkq -
A80|Dutch Defense: Barcza Variation|rnbqkb1r/ppppp1pp/5n2/5p2/3P4/2P2N2/PP2PPPP/RNBQKB1R b KQkq -
A80|Dutch Defense: Hevendehl Gambit|rnbqkbnr/pppp2pp/8/4pp2/3P2P1/8/PPP1PP1P/RNBQKBNR w KQkq -
A80|Dutch Defense: Hopton Attack|rnbqkbnr/ppppp1pp/8/5pB1/3P4/8/PPP1PPPP/RN1QKBNR b KQkq -
A80|Dutch Defense: Janzen-Korchnoi Gambit|rnbqkb1r/ppppp1pp/5n2/5p2/3P2P1/7P/PPP1PP2/RNBQKBNR b KQkq -
A80|Dutch Defense: Kingfisher Gambit|rnbqkbnr/ppp1p1pp/8/3p1p2/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq -
A80|Dutch Defense: Korchnoi Attack|rnbqkbnr/ppppp1pp/8/5p2/3P4/7P/PPP1PPP1/RNBQKBNR b KQkq -
A80|Dutch Defense: Krejcik Gambit|rnbqkbnr/ppppp1pp/8/5p2/3P2P1/8/PPP1PP1P/RNBQKBNR b KQkq -
A80|Dutch Defense: Krejcik Gambit, Tate Gambit|rnbqkbnr/ppp1p1pp/8/3p4/3PP1p1/2N5/PPP2P1P/R1BQKBNR b KQkq -
A80|Dutch Defense: Manhattan Gambit, Anti-Classical Line|rnbqkbnr/pppp2pp/4p3/5p2/3P2P1/3Q4/PPP1PP1P/RNB1KBNR b KQkq -
A80|Dutch Defense: Manhattan Gambit, Anti-Leningrad|rnbqkbnr/ppppp2p/6p1/5p2/3P2P1/3Q4/PPP1PP1P/RNB1KBNR b KQkq -
A80|Dutch Defense: Manhattan Gambit, Anti-Modern|rnbqkbnr/ppp1p1pp/3p4/5p2/3P2P1/3Q4/PPP1PP1P/RNB1KBNR b KQkq -
A80|Dutch Defense: Manhattan Gambit, Anti-Stonewall|rnbqkbnr/ppp1p1pp/8/3p1p2/3P2P1/3Q4/PPP1PP1P/RNB1KBNR b KQkq -
A80|Dutch Defense: Omega-Isis Gambit|rnbqkbnr/pppp2pp/8/4pp2/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
A80|Dutch Defense: Raphael Variation|rnbqkbnr/ppppp1pp/8/5p2/3P4/2N5/PPP1PPPP/R1BQKBNR b KQkq -
A80|Dutch Defense: Senechaud Gambit|rnbqkbnr/pppp2pp/4p3/5p2/3P1BP1/8/PPP1PP1P/RN1QKBNR b KQkq -
A80|Dutch Defense: Spielmann Gambit|rnbqkb1r/ppppp1pp/5n2/5p2/3P2P1/2N5/PPP1PP1P/R1BQKBNR b KQkq -
A80|Queen's Pawn Game: Veresov Attack, Dutch System|rnbqkbnr/ppp1p1pp/8/3p1p2/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
A81|Dutch Defense: Blackburne Variation|rnbqkb1r/pppp2pp/4pn2/5p2/3P4/6PN/PPP1PPBP/RNBQK2R b KQkq -
A81|Dutch Defense: Fianchetto Attack|rnbqkbnr/ppppp1pp/8/5p2/3P4/6P1/PPP1PP1P/RNBQKBNR b KQkq -
A81|Dutch Defense: Leningrad Variation, Carlsbad Variation|rnbqk1nr/ppppp1bp/6p1/5p2/3P4/6PN/PPP1PPBP/RNBQK2R b KQkq -
A81|Dutch Defense: Semi-Leningrad Variation|rnbqkb1r/ppppp2p/5np1/5p2/3P4/6P1/PPP1PPBP/RNBQK1NR w KQkq -
A82|Dutch Defense: Blackmar's Second Gambit|rnbqkb1r/ppppp1pp/5n2/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR b KQkq -
A82|Dutch Defense: Staunton Gambit|rnbqkbnr/ppppp1pp/8/5p2/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
A82|Dutch Defense: Staunton Gambit Accepted|rnbqkbnr/ppppp1pp/8/8/3Pp3/8/PPP2PPP/RNBQKBNR w KQkq -
A82|Dutch Defense: Staunton Gambit, American Attack|rnbqkbnr/ppppp1pp/8/8/3Pp3/8/PPPN1PPP/R1BQKBNR b KQkq -
A82|Dutch Defense: Staunton Gambit, Tartakower Variation|rnbqkb1r/ppppp1pp/5n2/8/3Pp1P1/2N5/PPP2P1P/R1BQKBNR b KQkq -
A82|Rat Defense: Balogh Defense|rnbqkbnr/ppp1p1pp/3p4/5p2/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
A83|Dutch Defense: Staunton Gambit|rnbqkb1r/ppppp1pp/5n2/6B1/3Pp3/2N5/PPP2PPP/R2QKBNR b KQkq -
A83|Dutch Defense: Staunton Gambit, Chigorin Variation|rnbqkb1r/pp1pp1pp/2p2n2/6B1/3Pp3/2N5/PPP2PPP/R2QKBNR w KQkq -
A83|Dutch Defense: Staunton Gambit, Nimzowitsch Variation|rnbqkb1r/p1ppp1pp/1p3n2/6B1/3Pp3/2N5/PPP2PPP/R2QKBNR w KQkq -
A84|Dutch Defense|rnbqkbnr/ppppp1pp/8/5p2/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -
A84|Dutch Defense: Bellon Gambit|rnbqkbnr/pppp2pp/4p3/5p2/2PPP3/8/PP3PPP/RNBQKBNR b KQkq -
A84|Dutch Defense: Bladel Variation|rnbqkb1r/ppppp2p/6pn/5p2/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
A84|Dutch Defense: Classical Variation|rnbqkbnr/pppp2pp/4p3/5p2/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A84|Dutch Defense: Krause Variation|r1bqkb1r/ppp1p1pp/2np1n2/5p2/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
A84|Dutch Defense: Normal Variation|rnbqkb1r/ppppp1pp/5n2/5p2/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
A84|Dutch Defense: Rubinstein Variation|rnbqkbnr/pppp2pp/4p3/5p2/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -
A85|Dutch Defense: Queen's Knight Variation|rnbqkb1r/ppppp1pp/5n2/5p2/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -
A86|Dutch Defense: Fianchetto Variation|rnbqkb1r/ppppp1pp/5n2/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq -
A86|Dutch Defense: Hort-Antoshin System|rnb1kb1r/ppq1p1pp/2pp1n2/5p2/2PP4/2N3P1/PP2PPBP/R1BQK1NR w KQkq -
A86|Dutch Defense: Leningrad Variation|rnbqkb1r/ppppp2p/5np1/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR w KQkq -
A87|Dutch Defense: Leningrad Variation|rnbqk2r/ppppp1bp/5np1/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R b KQkq -
A90|Dutch Defense: Classical Variation|rnbqkb1r/pppp2pp/4pn2/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR b KQkq -
A90|Dutch Defense: Classical Variation|rnbqkb1r/ppp3pp/4pn2/3p1p2/2PP4/5NP1/PP2PPBP/RNBQK2R b KQkq -
A90|Dutch Defense: Nimzo-Dutch Variation|rnbqk2r/pppp2pp/4pn2/5p2/1bPP4/6P1/PP2PPBP/RNBQK1NR w KQkq -
A91|Dutch Defense: Classical Variation|rnbqk2r/ppppb1pp/4pn2/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR w KQkq -
A92|Dutch Defense: Alekhine Variation|rnbq1rk1/ppppb1pp/4p3/5p2/2PPn3/5NP1/PP2PPBP/RNBQ1RK1 w - -
A92|Dutch Defense: Classical Variation|rnbq1rk1/ppppb1pp/4pn2/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R w KQ -
A92|Dutch Defense: Stonewall Variation|rnbq1rk1/ppp1b1pp/4pn2/3p1p2/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b - -
A92|Dutch Defense: Stonewall Variation|rnbq1rk1/ppp1b1pp/4pn2/3p1p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1 w - -
A94|Dutch Defense: Stonewall Variation|rnbq1rk1/pp2b1pp/2p1pn2/3p1p2/2PP4/BP3NP1/P3PPBP/RN1Q1RK1 b - -
A95|Dutch Defense: Stonewall Variation|rnbq1rk1/pp2b1pp/2p1pn2/3p1p2/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 w - -
A96|Dutch Defense: Classical Variation|rnbq1rk1/ppp1b1pp/3ppn2/5p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1 w - -
B00|Barnes Defense|rnbqkbnr/ppppp1pp/5p2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Borg Defense|rnbqkbnr/pppppp1p/8/6p1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Borg Defense: Borg Gambit|rnbqk1nr/ppppppbp/8/6p1/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Borg Defense: Troon Gambit|rnbqkbnr/pppppp2/7p/8/3PP1pP/8/PPP2PP1/RNBQKBNR w KQkq -
B00|Borg Defense: Zilbermints Gambit|rnbqkbnr/pppp1p1p/8/4p1p1/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Carr Defense|rnbqkbnr/ppppppp1/7p/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Carr Defense: Zilbermints Gambit|rnbqkbnr/pppp1pp1/7p/4p3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Duras Gambit|rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Fried Fox Defense|rnbq1bnr/pppppkpp/5p2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQ -
B00|Goldsmith Defense|rnbqkbnr/ppppppp1/8/7p/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Goldsmith Defense: Picklepuss Defense|rnbqkb1r/ppppppp1/5n2/7p/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Hippopotamus Defense|rnbqkb1r/pppppppp/7n/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Hippopotamus Defense|rnbqkb1r/ppppp2p/5ppn/8/2PPP3/8/PP3PPP/RNBQKBNR w KQkq -
B00|King's Pawn Game|rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -
B00|Lemming Defense|r1bqkbnr/pppppppp/n7/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Lion Defense: Lion's Jaw|rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/5P2/PPP3PP/RNBQKBNR b KQkq -
B00|Nimzowitsch Defense|r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense|r1bqkbnr/pppppppp/2n5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
B00|Nimzowitsch Defense: Breyer Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Colorado Countergambit|r1bqkbnr/ppppp1pp/2n5/5p2/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B00|Nimzowitsch Defense: Colorado Countergambit Accepted|r1bqkbnr/ppppp1pp/2n5/5P2/8/5N2/PPPP1PPP/RNBQKB1R b KQkq -
B00|Nimzowitsch Defense: Declined Variation|r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -
B00|Nimzowitsch Defense: El Columpio Defense|r1bqkb1r/pppppppp/2n5/4P3/6n1/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B00|Nimzowitsch Defense: Franco-Nimzowitsch Variation|r1bqkbnr/pppp1ppp/2n1p3/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B00|Nimzowitsch Defense: French Connection|r1bqkbnr/pppp1ppp/2n1p3/8/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Hornung Gambit|r1bqkbnr/ppp1pppp/2n5/3p4/3PP3/4B3/PPP2PPP/RN1QKBNR b KQkq -
B00|Nimzowitsch Defense: Kennedy Variation|r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, Bielefelder Gambit|r1bqk1nr/pppp1ppp/2n5/2b1P3/4P3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, Hammer Gambit|r1bqkbnr/pppp2pp/2n2p2/4P3/4P3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, Herford Gambit|r1b1kbnr/pppp1ppp/2n5/4P3/4P2q/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, Keres Attack|r1bqkbnr/pppp1ppp/8/4n3/4P3/2N5/PPP2PPP/R1BQKBNR b KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, Linksspringer Variation|r1bqkbnr/pppp1ppp/2n5/3Pp3/4P3/8/PPP2PPP/RNBQKBNR b KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, Main Line|r1bqkbnr/pppp1ppp/6n1/8/4PP2/8/PPP3PP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, Paulsen Attack|r1bqkbnr/pppp1ppp/8/4n3/4P3/5N2/PPP2PPP/RNBQKB1R b KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, Riemann Defense|r1bqkbnr/pppp1ppp/2n5/8/4PP2/8/PPP3PP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Kennedy Variation, de Smet Gambit|r1bqkbnr/ppp2ppp/2np4/4P3/4P3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Mikenas Variation|r1bqkbnr/ppp1pppp/2np4/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Neo-Mongoloid Defense|r1bqkbnr/ppppp1pp/2n2p2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Pirc Connection|r1bqkbnr/pppppp1p/2n3p1/8/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Pseudo-Spanish Variation|r1bqkbnr/pppppppp/2n5/1B6/4P3/8/PPPP1PPP/RNBQK1NR b KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation|r1bqkbnr/ppp1pppp/2n5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Aachen Gambit|r1bqkbnr/ppp1pppp/8/3P4/1n1P4/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Advance Variation|r1bqkbnr/ppp1pppp/2n5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Bogoljubow Variation|r1bqkbnr/ppp1pppp/2n5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Bogoljubow Variation|r1bqkbnr/ppp1pppp/2n5/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Bogoljubow Variation, Brandics Gambit|r1bqkbnr/1pp1pppp/p1n5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Bogoljubow Variation, Erben Gambit|r1bqkbnr/ppp1pp1p/2n3p1/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Bogoljubow Variation, Heinola-Deppe Gambit|r1bqkbnr/ppp2ppp/2n5/3pp3/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Bogoljubow Variation, Nimzowitsch Gambit|r1bqkbnr/ppp1pppp/8/3Pn3/4p3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Bogoljubow Variation, Vehre Variation|r1bqkb1r/ppp1pppp/2n2n2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Exchange Variation|r1b1kbnr/ppp1pppp/2n5/3q4/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Nimzowitsch Defense: Scandinavian Variation, Exchange Variation, Marshall Gambit|r1b1kbnr/ppp1pppp/2n5/3q4/3P4/2N5/PPP2PPP/R1BQKBNR b KQkq -
B00|Nimzowitsch Defense: Wheeler Gambit|r1bqkbnr/pppppppp/2n5/8/1P2P3/8/P1PP1PPP/RNBQKBNR b KQkq -
B00|Nimzowitsch Defense: Williams Variation|r1bqkbnr/ppp1pppp/2np4/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B00|Nimzowitsch Defense: Woodchuck Variation|r1bqkbnr/1ppppppp/p1n5/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Owen Defense|rnbqkbnr/p1pppppp/1p6/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Owen Defense: Guatemala Defense|rn1qkbnr/p1pppppp/bp6/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Owen Defense: Hekili-Loa Gambit|r1bqkbnr/p2ppppp/1pn5/2P5/4P3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Owen Defense: Matovinsky Gambit|rn1qkbnr/p1ppp2p/1p4p1/5P1Q/3P4/3B4/PPP2PbP/RNB1K1NR w KQkq -
B00|Owen Defense: Naselwaus Gambit|rn1qkbnr/pbpppppp/1p6/6B1/3PP3/8/PPP2PPP/RN1QKBNR b KQkq -
B00|Owen Defense: Smith Gambit|rn1qkbnr/pbpppppp/1p6/8/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
B00|Owen Defense: Unicorn Variation|rn1qkbnr/pbppp1pp/1p3p2/8/2PPP3/8/PP3PPP/RNBQKBNR w KQkq -
B00|Owen Defense: Wind Gambit|rn1qkbnr/pbpp1ppp/1p6/4p3/3PP3/5P2/PPP3PP/RNBQKBNR w KQkq -
B00|Pirc Defense|rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Pirc Defense|rnbqkbnr/ppp1pppp/3p4/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
B00|Pirc Defense|rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Pirc Defense: Roscher Gambit|rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
B00|Rat Defense: Antal Defense|r1bqkbnr/pppnpppp/3p4/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Rat Defense: Fuller Gambit|rnbqkb1r/ppp1pppp/5n2/3P4/5P2/8/PPPP2PP/RNBQKBNR w KQkq -
B00|Rat Defense: Harmonist|rnbqkbnr/ppp1pppp/3p4/8/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -
B00|Rat Defense: Petruccioli Attack|rnbqkbnr/ppp1pppp/3p4/8/4P2P/8/PPPP1PP1/RNBQKBNR b KQkq -
B00|Rat Defense: Spike Attack|rnbqkbnr/ppp1pppp/3p4/8/4P1P1/8/PPPP1P1P/RNBQKBNR b KQkq -
B00|St. George Defense|rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|St. George Defense: Polish Variation|rn1qkbnr/1bpp1ppp/p3p3/1p6/3PP3/3B1N2/PPP2PPP/RNBQK2R w KQkq -
B00|St. George Defense: San Jorge Variation|rn1qk1nr/1bp1ppbp/p2p2p1/1p6/3PP3/2PB1N2/PP3PPP/RNBQ1RK1 w kq -
B00|St. George Defense: Zilbermints Gambit|rnbqkbnr/1ppp1ppp/p7/4p3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B00|Van Geet Opening: Berlin Gambit|r1bqkbnr/ppp1pppp/2n5/3P4/4p3/2N5/PPP2PPP/R1BQKBNR b KQkq -
B00|Ware Defense|rnbqkbnr/1ppppppp/8/p7/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B00|Ware Defense: Snagglepuss Defense|r1bqkbnr/1ppppppp/2n5/p7/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense|rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense|rnbqkbnr/ppp1pppp/8/3p4/4P3/1P6/P1PP1PPP/RNBQKBNR b KQkq -
B01|Scandinavian Defense: Anderssen Counterattack|rnb1kbnr/ppp2ppp/8/q3p3/3P4/2N5/PPP2PPP/R1BQKBNR w KQkq -
B01|Scandinavian Defense: Blackburne Gambit|r1bqkbnr/pp2pppp/2n5/8/8/8/PPPP1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Blackburne-Kloosterboer Gambit|rnbqkbnr/pp2pppp/2p5/3P4/8/8/PPPP1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Boehnke Gambit|rn1qkbnr/ppp2ppp/4b3/8/8/8/PPPP1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Bronstein Variation|rnb1kb1r/1pp1pppp/p2q1n2/8/3P4/2N2N2/PPP2PPP/R1BQKB1R w KQkq -
B01|Scandinavian Defense: Classical Variation|rn2kb1r/ppp1pppp/5n2/q4b2/3P4/2N2N2/PPP2PPP/R1BQKB1R w KQkq -
B01|Scandinavian Defense: Grünfeld Variation|rn2kb1r/pp2pppp/2p2n2/q3Nb2/3P2P1/2N5/PPP2P1P/R1BQKB1R b KQkq -
B01|Scandinavian Defense: Gubinsky-Melts Defense|rnb1kbnr/ppp1pppp/3q4/8/8/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B01|Scandinavian Defense: Icelandic-Palme Gambit|rnbqkb1r/ppp2ppp/4pn2/3P4/2P5/8/PP1P1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Kiel Variation|rnbqkb1r/ppp1pppp/8/8/1nPP4/8/PP3PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Kloosterboer Gambit|rnbqkbnr/pp3ppp/2P5/4p3/8/8/PPPP1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Kádas Gambit|rnbqkb1r/pp3ppp/2P2n2/4p3/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Lasker Variation|rn2kb1r/ppp1pppp/5n2/q7/3P2b1/2N2N1P/PPP2PP1/R1BQKB1R b KQkq -
B01|Scandinavian Defense: Main Line|rnb1kbnr/ppp1pppp/8/q7/8/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B01|Scandinavian Defense: Main Line, Leonhardt Gambit|rnb1kbnr/ppp1pppp/8/q7/1P6/2N5/P1PP1PPP/R1BQKBNR b KQkq -
B01|Scandinavian Defense: Main Line, Mieses Variation|rnb1kb1r/ppp1pppp/5n2/q7/3P4/2N5/PPP2PPP/R1BQKBNR w KQkq -
B01|Scandinavian Defense: Marshall Variation|rnbqkb1r/ppp1pppp/8/3n4/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Mieses-Kotroc Variation|rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Modern Variation|rnbqkb1r/ppp1pppp/5n2/3P4/8/8/PPPP1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Modern Variation|rnbqkb1r/ppp1pppp/5n2/3P4/3P4/8/PPP2PPP/RNBQKBNR b KQkq -
B01|Scandinavian Defense: Modern Variation, Gipslis Variation|rn1qkb1r/ppp1pppp/8/3n4/3P2b1/5N2/PPP2PPP/RNBQKB1R w KQkq -
B01|Scandinavian Defense: Modern Variation, Wing Gambit|rnbqkb1r/p1p1pp1p/5np1/1p1P4/2PP4/8/PP3PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Panov Transfer|rnbqkb1r/pp2pppp/2p2n2/3P4/2P5/8/PP1P1PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Portuguese Gambit|rn1qkb1r/ppp1pppp/5n2/3P4/3P2b1/8/PPP2PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Portuguese Gambit, Classical Variation|rn1qkb1r/ppp1pppp/5n2/3P4/3P2b1/5N2/PPP2PPP/RNBQKB1R b KQkq -
B01|Scandinavian Defense: Portuguese Gambit, Elbow Variation|rn1qkb1r/pp2pppp/2p2n2/1B1P4/3P2b1/8/PPP2PPP/RNBQK1NR w KQkq -
B01|Scandinavian Defense: Portuguese Gambit, Wuss Variation|rn1qkb1r/ppp1pppp/5n2/3P4/3P2b1/8/PPP1BPPP/RNBQK1NR b KQkq -
B01|Scandinavian Defense: Richter Variation|rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq -
B01|Scandinavian Defense: Richter Variation|rnbqkb1r/ppp1pp1p/5np1/3P4/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
B01|Scandinavian Defense: Schiller-Pytel Variation|rnb1kbnr/pp2pppp/2pq4/8/3P4/2N5/PPP2PPP/R1BQKBNR w KQkq -
B01|Scandinavian Defense: Valencian Variation|rnbqkbnr/ppp1pppp/8/8/8/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B01|Scandinavian Defense: Zilbermints Gambit|rnbqkbnr/ppp1pppp/8/3p4/1P2P3/8/P1PP1PPP/RNBQKBNR b KQkq -
B01|Van Geet Opening: Grünfeld Defense|rnbqkbnr/ppp2ppp/8/4p3/4N3/8/PPPP1PPP/R1BQKBNR w KQkq -
B02|Alekhine Defense|rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B02|Alekhine Defense: Brooklyn Variation|rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR w KQkq -
B02|Alekhine Defense: Brooklyn Variation, Everglades Variation|rnbqkbnr/ppppp1pp/8/4Pp2/3P4/8/PPP2PPP/RNBQKBNR w KQkq f6
B02|Alekhine Defense: Buckley Attack|rnbqkb1r/pppppppp/8/3nP3/8/N7/PPPP1PPP/R1BQKBNR b KQkq -
B02|Alekhine Defense: Kmoch Variation|rnbqkb1r/pp1ppppp/1n6/2p1P3/8/1B1P4/PPP2PPP/RNBQK1NR b KQkq -
B02|Alekhine Defense: Krejcik Variation|rnbqkb1r/pppppppp/5n2/8/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq -
B02|Alekhine Defense: Krejcik Variation, Krejcik Gambit|rnbqkb1r/pppppBpp/8/8/4n3/8/PPPP1PPP/RNBQK1NR b KQkq -
B02|Alekhine Defense: Maróczy Variation|rnbqkb1r/pppppppp/5n2/8/4P3/3P4/PPP2PPP/RNBQKBNR b KQkq -
B02|Alekhine Defense: Mokele Mbembe|rnbqkb1r/pppppppp/8/4P3/4n3/8/PPPP1PPP/RNBQKBNR w KQkq -
B02|Alekhine Defense: Mokele Mbembe, Modern Line|rnbqkb1r/ppppp1pp/5p2/4P3/3Pn3/8/PPP2PPP/RNBQKBNR w KQkq -
B02|Alekhine Defense: Mokele Mbembe, Vavra Defense|rnbqkb1r/pppp1ppp/4p3/4P3/3Pn3/8/PPP2PPP/RNBQKBNR w KQkq -
B02|Alekhine Defense: Normal Variation|rnbqkb1r/pppppppp/8/3nP3/8/8/PPPP1PPP/RNBQKBNR w KQkq -
B02|Alekhine Defense: Scandinavian Variation|rnbqkb1r/ppp1pppp/5n2/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B02|Alekhine Defense: Scandinavian Variation, Geschev Gambit|rnbqkb1r/pp2pppp/2p2n2/3P4/8/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B02|Alekhine Defense: Scandinavian Variation, Myers Gambit|rnbqkb1r/ppp1pppp/5n2/6B1/4p3/2NP4/PPP2PPP/R2QKBNR b KQkq -
B02|Alekhine Defense: Spielmann Gambit|rnbqkb1r/pppnpppp/4P3/3p4/8/2N5/PPPP1PPP/R1BQKBNR b KQkq -
B02|Alekhine Defense: Steiner Variation|rnbqkb1r/pppppppp/1n6/4P3/2P5/1P6/P2P1PPP/RNBQKBNR b KQkq -
B02|Alekhine Defense: Sämisch Attack|rnbqkb1r/pppppppp/8/3nP3/8/2N5/PPPP1PPP/R1BQKBNR b KQkq -
B02|Alekhine Defense: The Squirrel|rnbqkb1r/pppppppp/8/4P3/2P2n2/8/PP1P1PPP/RNBQKBNR w KQkq -
B02|Alekhine Defense: Two Pawns Attack|rnbqkb1r/pppppppp/8/3nP3/2P5/8/PP1P1PPP/RNBQKBNR b KQkq -
B02|Alekhine Defense: Two Pawns Attack, Lasker Variation|rnbqkb1r/pppppppp/1n6/2P1P3/8/8/PP1P1PPP/RNBQKBNR b KQkq -
B02|Alekhine Defense: Two Pawns Attack, Tate Variation|rnbqkb1r/pppppppp/1n6/4P3/P1P5/8/1P1P1PPP/RNBQKBNR b KQkq -
B02|Alekhine Defense: Welling Variation|rnbqkb1r/pppppppp/8/3nP3/8/1P6/P1PP1PPP/RNBQKBNR b KQkq -
B03|Alekhine Defense|rnbqkb1r/pppppppp/8/3nP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq -
B03|Alekhine Defense|rnbqkb1r/ppp1pppp/3p4/3nP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
B03|Alekhine Defense|rnbqkb1r/ppp1pppp/3p4/3nP3/2PP4/8/PP3PPP/RNBQKBNR b KQkq -
B03|Alekhine Defense: Balogh Variation|rnbqkb1r/ppp1pppp/3p4/3nP3/2BP4/8/PPP2PPP/RNBQK1NR b KQkq -
B03|Alekhine Defense: Exchange Variation|rnbqkb1r/ppp1pppp/1n1P4/8/2PP4/8/PP3PPP/RNBQKBNR b KQkq -
B03|Alekhine Defense: Four Pawns Attack|rnbqkb1r/ppp1pppp/1n1p4/4P3/2PP1P2/8/PP4PP/RNBQKBNR b KQkq -
B03|Alekhine Defense: Hunt Variation|rnbqkb1r/ppp1pppp/1n1p4/2P1P3/3P4/8/PP3PPP/RNBQKBNR b KQkq -
B03|Alekhine Defense: O'Sullivan Gambit|rnbqkb1r/p1pppppp/8/1p1nP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
B04|Alekhine Defense: Modern Variation|rnbqkb1r/ppp1pppp/3p4/3nP3/3P4/5N2/PPP2PPP/RNBQKB1R b KQkq -
B04|Alekhine Defense: Modern Variation, Alburt Variation|rnbqkb1r/ppp1pp1p/3p2p1/3nP3/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq -
B04|Alekhine Defense: Modern Variation, Larsen Variation|rnbqkb1r/ppp1pppp/8/3np3/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq -
B04|Alekhine Defense: Modern Variation, Larsen-Haakert Variation|r1bqkb1r/ppp1pppp/2np4/3nP3/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq -
B04|Alekhine Defense: Modern Variation, Schmid Variation|rnbqkb1r/ppp1pppp/1n1p4/4P3/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq -
B05|Alekhine Defense: Modern Variation, Main Line|rn1qkb1r/ppp1pppp/3p4/3nP3/3P2b1/5N2/PPP2PPP/RNBQKB1R w KQkq -
B06|Modern Defense|rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B06|Modern Defense|rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B06|Modern Defense: Anti-Modern|rnbqk1nr/pp2ppbp/2pp2p1/8/2BPP3/2N5/PPP1QPPP/R1B1K1NR b KQkq -
B06|Modern Defense: Bishop Attack|rnbqk1nr/ppppppbp/6p1/8/2BPP3/8/PPP2PPP/RNBQK1NR b KQkq -
B06|Modern Defense: Bishop Attack, Bücker Gambit|rnbqk1nr/p1ppppbp/6p1/1p6/2BPP3/8/PPP2PPP/RNBQK1NR w KQkq -
B06|Modern Defense: Bishop Attack, Monkey's Bum|rnbqk1nr/pppp1p1p/4p1p1/8/2BbP3/5Q2/PPP2PPP/RNB1K1NR w KQkq -
B06|Modern Defense: Dunworthy Variation|rnbqk1nr/pp2pp1p/2P3p1/8/2Pb4/8/PP3PPP/RNBQKBNR w KQkq -
B06|Modern Defense: Fianchetto Gambit|rnbqkbnr/ppppp2p/6p1/5p2/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B06|Modern Defense: Gurgenidze Defense|rnbqk1nr/pp2ppb1/2p3p1/3pP2p/3P1P2/2N5/PPP3PP/R1BQKBNR w KQkq -
B06|Modern Defense: Lizard Defense, Mittenberger Gambit|rnbqk1nr/ppp1ppbp/6p1/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B06|Modern Defense: Masur Gambit|rnbq1rk1/ppppp2p/6pb/5P2/3P4/2N5/PPP2PPP/R2QKBNR w KQ -
B06|Modern Defense: Modern Pterodactyl|rnbqk1nr/pp1pppbp/6p1/2p5/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B06|Modern Defense: Mongredien Defense, with Nc3|rnbqk1nr/p1ppppbp/1p4p1/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B06|Modern Defense: Mongredien Defense, with Nf3|rnbqk1nr/p1ppppbp/1p4p1/8/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B06|Modern Defense: Norwegian Defense|rnbqkb1r/pppppp1p/5np1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B06|Modern Defense: Norwegian Defense, Norwegian Gambit|rnbqkb1r/ppp1pp1p/3p2p1/4P2n/3P4/8/PPP1BPPP/RNBQK1NR w KQkq -
B06|Modern Defense: Pseudo-Austrian Attack|rnbqk1nr/ppp1ppbp/3p2p1/8/3PPP2/2N5/PPP3PP/R1BQKBNR b KQkq -
B06|Modern Defense: Standard Defense|rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B06|Modern Defense: Standard Line|rnbqk1nr/ppppppbp/6p1/8/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq -
B06|Modern Defense: Three Pawns Attack|rnbqk1nr/ppppppbp/6p1/8/3PPP2/8/PPP3PP/RNBQKBNR b KQkq -
B06|Modern Defense: Two Knights Variation|rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq -
B06|Modern Defense: Two Knights Variation, Suttles Variation|rnbqk1nr/pp2ppbp/2pp2p1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq -
B06|Modern Defense: Westermann Gambit|rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPPB1PPP/RN1QKBNR b KQkq -
B06|Modern Defense: Wind Gambit|rnbqk1nr/ppppppbp/6p1/8/3PP3/3B4/PPP2PPP/RNBQK1NR b KQkq -
B06|Pterodactyl Defense: Austrian, Austriadactylus Western|rnb1k1nr/pp1pppbp/6p1/q1p5/3PPP2/5N2/PPP3PP/RNBQKB1R w KQkq -
B06|Pterodactyl Defense: Austrian, Grand Prix Pterodactyl|rnb1k1nr/pp1pppbp/6p1/q1p5/4PP2/2N2N2/PPPP2PP/R1BQKB1R w KQkq -
B06|Pterodactyl Defense: Austrian, Pteranodon|rnb1k1nr/pp1pppbp/6p1/q1p5/3PPP2/2P5/PP4PP/RNBQKBNR w KQkq -
B06|Pterodactyl Defense: Eastern, Anhanguera|rnbqk1nr/pp1pppbp/6p1/2p5/3PP3/2N1B3/PPP2PPP/R2QKBNR b KQkq -
B06|Pterodactyl Defense: Eastern, Benoni|rnbqk1nr/pp1pppbp/6p1/2pP4/4P3/2N5/PPP2PPP/R1BQKBNR b KQkq -
B06|Pterodactyl Defense: Eastern, Benoni Pterodactyl|rnb1k1nr/pp1pppbp/6p1/q1pP4/4P3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B06|Pterodactyl Defense: Eastern, Rhamphorhynchus|rnb1k1nr/pp1pppbp/6p1/q1P5/4P3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B06|Pterodactyl Defense: Fianchetto, King Pterodactyl|rnb1k1nr/pp1pppbp/6p1/q1p5/3PP3/5NP1/PPP2P1P/RNBQKB1R w KQkq -
B06|Pterodactyl Defense: Fianchetto, Rhamphorhynchus|rnb1k1nr/pp1pppbp/6p1/q1P5/4P3/6P1/PPP2P1P/RNBQKBNR w KQkq -
B06|Pterodactyl Defense: Western, Anhanguera|rnb1k1nr/pp1pppbp/6p1/q1p5/3PP3/4BN2/PPP2PPP/RN1QKB1R w KQkq -
B06|Rat Defense: Accelerated Gurgenidze|rnbqkbnr/pp2pp1p/2pp2p1/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B07|Czech Defense|rnbqkb1r/pp2pppp/2pp1n2/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B07|King's Pawn Game: Maróczy Defense|rnbqkbnr/ppp2ppp/3p4/4p3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B07|Lion Defense|r1bqkb1r/pppnpppp/3p1n2/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B07|Lion Defense: Anti-Philidor|r1bqkb1r/pppnpppp/3p1n2/8/3PPP2/2N5/PPP3PP/R1BQKBNR b KQkq -
B07|Lion Defense: Anti-Philidor, Lion's Cave|r1bqkb1r/pppn1ppp/3p1n2/4p3/3PPP2/2N5/PPP3PP/R1BQKBNR w KQkq -
B07|Lion Defense: Bayonet Attack|r1bqkb1r/pppnpppp/3p1n2/8/3PP1P1/2N5/PPP2P1P/R1BQKBNR b KQkq -
B07|Modern Defense: Geller's System|rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/2P2N2/PP3PPP/RNBQKB1R b KQkq -
B07|Pirc Defense|rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B07|Pirc Defense: 150 Attack|rnbqkb1r/pp2pp1p/2pp1np1/8/3PP3/2N1B3/PPPQ1PPP/R3KBNR b KQkq -
B07|Pirc Defense: Bayonet Attack|rnbqk2r/ppp1ppbp/3p1np1/8/3PP2P/2N5/PPP1BPP1/R1BQK1NR b KQkq -
B07|Pirc Defense: Byrne Variation|rnbqkb1r/ppp1pp1p/3p1np1/6B1/3PP3/2N5/PPP2PPP/R2QKBNR b KQkq -
B07|Pirc Defense: Chinese Variation|rnbqk2r/ppp1ppbp/3p1np1/8/3PP1P1/2N5/PPP1BP1P/R1BQK1NR b KQkq -
B07|Pirc Defense: Kholmov System|rnbqkb1r/ppp1pp1p/3p1np1/8/2BPP3/2N5/PPP2PPP/R1BQK1NR b KQkq -
B07|Pirc Defense: Sveshnikov System|rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N3P1/PPP2P1P/R1BQKBNR b KQkq -
B08|Pirc Defense: Classical Variation|rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq -
B08|Pirc Defense: Classical Variation|rnbqk2r/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq -
B09|Pirc Defense: Austrian Attack|rnbqkb1r/ppp1pp1p/3p1np1/8/3PPP2/2N5/PPP3PP/R1BQKBNR b KQkq -
B09|Pirc Defense: Austrian Attack|rnbq1rk1/ppp1ppbp/3p1np1/8/3PPP2/2N2N2/PPP3PP/R1BQKB1R w KQ -
B10|Caro-Kann Defense|rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B10|Caro-Kann Defense|rnbqkbnr/pp1ppppp/2p5/8/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq -
B10|Caro-Kann Defense|rnbqkbnr/pp2pppp/2p5/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B10|Caro-Kann Defense: Accelerated Panov Attack|rnbqkbnr/pp1ppppp/2p5/8/2P1P3/8/PP1P1PPP/RNBQKBNR b KQkq -
B10|Caro-Kann Defense: Accelerated Panov Attack|rnbqkbnr/pp2pppp/2p5/3p4/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq -
B10|Caro-Kann Defense: Accelerated Panov Attack, Modern Variation|rnbqkb1r/pp2pppp/5n2/3P4/8/8/PP1P1PPP/RNBQKBNR w KQkq -
B10|Caro-Kann Defense: Accelerated Panov Attack, Open Variation|rnbqkbnr/pp1p1ppp/2p5/4p3/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq -
B10|Caro-Kann Defense: Accelerated Panov Attack, Pseudo-Scandinavian|rnb1kbnr/pp2pppp/2p5/3q4/2P5/8/PP1P1PPP/RNBQKBNR w KQkq -
B10|Caro-Kann Defense: Accelerated Panov Attack, Van Weersel Attack|rnbqkbnr/pp2pppp/8/3p4/4P3/1Q6/PP1P1PPP/RNB1KBNR b KQkq -
B10|Caro-Kann Defense: Apocalypse Attack|rnbqkbnr/pp2pppp/8/3pN3/8/8/PPPP1PPP/RNBQKB1R b KQkq -
B10|Caro-Kann Defense: Breyer Variation|rnbqkbnr/pp1ppppp/2p5/8/4P3/3P4/PPP2PPP/RNBQKBNR b KQkq -
B10|Caro-Kann Defense: Dinic Gambit|rnbqkbnr/pp2pppp/2p5/6N1/4p3/3P4/PPP2PPP/RNBQKB1R b KQkq -
B10|Caro-Kann Defense: Endgame Offer|rnbqkbnr/pp2pppp/2p5/3p4/4P3/3P1N2/PPP2PPP/RNBQKB1R b KQkq -
B10|Caro-Kann Defense: Endgame Variation|rnb1kbnr/pp2pppp/2p5/8/4P3/5N2/PPP2PPP/RNBK1B1R b kq -
B10|Caro-Kann Defense: Euwe Attack|rnbqkbnr/pp1ppppp/2p5/8/4P3/1P6/P1PP1PPP/RNBQKBNR b KQkq -
B10|Caro-Kann Defense: Goldman Variation|rnbqkbnr/pp2pppp/2p5/3p4/4P3/2N2Q2/PPPP1PPP/R1B1KBNR b KQkq -
B10|Caro-Kann Defense: Hector Gambit|rnbqkbnr/pp2pppp/2p5/6N1/4p3/2N5/PPPP1PPP/R1BQKB1R b KQkq -
B10|Caro-Kann Defense: Hillbilly Attack|rnbqkbnr/pp1ppppp/2p5/8/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq -
B10|Caro-Kann Defense: Hillbilly Attack, Schaeffer Gambit|rnbqkbnr/pp2pppp/2p5/7Q/4p3/1B6/PPPP1PPP/RNB1K1NR b KQkq -
B10|Caro-Kann Defense: Labahn Attack|rnbqkbnr/pp1ppppp/2p5/8/1P2P3/8/P1PP1PPP/RNBQKBNR b KQkq -
B10|Caro-Kann Defense: Labahn Attack, Double Gambit|rnbqkbnr/pp2pppp/2p5/1P1p4/4P3/8/P1PP1PPP/RNBQKBNR b KQkq -
B10|Caro-Kann Defense: Labahn Attack, Polish Variation|rnbqkbnr/pp1p1ppp/2p5/4p3/1P2P3/8/PBPP1PPP/RN1QKBNR b KQkq -
B10|Caro-Kann Defense: Scorpion-Horus Gambit|rnbqkbnr/pp2pppp/2p5/6B1/4p3/2NP4/PPP2PPP/R2QKBNR b KQkq -
B10|Caro-Kann Defense: Spike Variation|rnbqkbnr/pp1ppppp/2p5/8/4P1P1/8/PPPP1P1P/RNBQKBNR b KQkq -
B10|Caro-Kann Defense: Spike Variation, Scorpion-Grob Gambit|rnbqkbnr/pp2pppp/2p5/8/4p1P1/2NP4/PPP2P1P/R1BQKBNR b KQkq -
B10|Caro-Kann Defense: St. Patrick's Attack|rnbqkbnr/pp2pppp/2p5/3p4/4P3/2N4P/PPPP1PP1/R1BQKBNR b KQkq -
B10|Caro-Kann Defense: Toikkanen Gambit|rnbqkbnr/pp2pppp/2p5/3pP3/2P5/8/PP1P1PPP/RNBQKBNR b KQkq -
B10|Caro-Kann Defense: Two Knights Attack|rnbqkbnr/pp2pppp/2p5/3p4/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq -
B11|Caro-Kann Defense: Two Knights Attack, Mindeno Variation|rn1qkbnr/pp2pppp/2p5/3p4/4P1b1/2N2N2/PPPP1PPP/R1BQKB1R w KQkq -
B11|Caro-Kann Defense: Two Knights Attack, Mindeno Variation, Exchange Line|rn1qkbnr/pp2pppp/2p5/3p4/4P3/2N2b1P/PPPP1PP1/R1BQKB1R w KQkq -
B11|Caro-Kann Defense: Two Knights Attack, Mindeno Variation, Retreat Line|rn1qkbnr/pp2pppp/2p5/3p3b/4P3/2N2N1P/PPPP1PP1/R1BQKB1R w KQkq -
B12|Caro-Kann Defense|rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
B12|Caro-Kann Defense|rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B12|Caro-Kann Defense: Advance Variation|rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq -
B12|Caro-Kann Defense: Advance Variation, Bayonet Attack|rn1qkbnr/pp2pppp/2p5/3pPb2/3P2P1/8/PPP2P1P/RNBQKBNR b KQkq -
B12|Caro-Kann Defense: Advance Variation, Botvinnik-Carls Defense|rnbqkbnr/pp2pppp/8/2ppP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
B12|Caro-Kann Defense: Advance Variation, Bronstein Variation|rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/8/PPP1NPPP/RNBQKB1R b KQkq -
B12|Caro-Kann Defense: Advance Variation, Prins Attack|rn1qkbnr/pp2pppp/2p5/3pPb2/1P1P4/8/P1P2PPP/RNBQKBNR b KQkq -
B12|Caro-Kann Defense: Advance Variation, Short Variation|rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/5N2/PPP2PPP/RNBQKB1R b KQkq -
B12|Caro-Kann Defense: Advance Variation, Tal Variation|rn1qkbnr/pp2pppp/2p5/3pPb2/3P3P/8/PPP2PP1/RNBQKBNR b KQkq -
B12|Caro-Kann Defense: Advance Variation, Van der Wiel Attack|rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/2N5/PPP2PPP/R1BQKBNR b KQkq -
B12|Caro-Kann Defense: Advance Variation, Van der Wiel Attack, Dreyev Defense|rn2kbnr/pp2pppp/1qp5/3pPb2/3P4/2N5/PPP2PPP/R1BQKBNR w KQkq -
B12|Caro-Kann Defense: De Bruycker Defense|r1bqkbnr/pp1ppppp/n1p5/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B12|Caro-Kann Defense: De Bruycker Defense|r1bqkbnr/ppnppppp/2p5/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B12|Caro-Kann Defense: Edinburgh Variation|rnb1kbnr/pp2pppp/1qp5/3p4/3PP3/8/PPPN1PPP/R1BQKBNR w KQkq -
B12|Caro-Kann Defense: Maróczy Variation|rnbqkbnr/pp2pppp/2p5/3p4/3PP3/5P2/PPP3PP/RNBQKBNR b KQkq -
B12|Caro-Kann Defense: Masi Variation|rnbqkb1r/pp1ppppp/2p2n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B12|Caro-Kann Defense: Massachusetts Defense|rnbqkbnr/pp1pp1pp/2p5/5p2/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
B12|Caro-Kann Defense: Mieses Gambit|rnbqkbnr/pp2pppp/2p5/3p4/3PP3/4B3/PPP2PPP/RN1QKBNR b KQkq -
B12|Caro-Kann Defense: Modern Variation|rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPPN1PPP/R1BQKBNR b KQkq -
B12|Caro-Kann Defense: Ulysses Gambit|rnbqkbnr/pp2pppp/2p5/6N1/3Pp3/8/PPP2PPP/RNBQKB1R b KQkq -
B13|Caro-Kann Defense: Exchange Variation|rnbqkbnr/pp2pppp/2p5/3P4/3P4/8/PPP2PPP/RNBQKBNR b KQkq -
B13|Caro-Kann Defense: Exchange Variation|rnbqkbnr/pp2pppp/8/3p4/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
B13|Caro-Kann Defense: Exchange Variation|rnbqkbnr/pp2pppp/8/3p4/3P1B2/8/PPP2PPP/RN1QKBNR b KQkq -
B13|Caro-Kann Defense: Exchange Variation|r1bqkbnr/pp2pppp/2n5/3p4/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq -
B13|Caro-Kann Defense: Exchange Variation, Bulla Attack|rnbqkbnr/pp2pppp/8/3p4/3P2P1/8/PPP2P1P/RNBQKBNR b KQkq -
B13|Caro-Kann Defense: Panov Attack|rnbqkbnr/pp2pppp/8/3p4/2PP4/8/PP3PPP/RNBQKBNR b KQkq -
B13|Caro-Kann Defense: Panov Attack|rnbqkb1r/pp2pppp/5n2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR b KQkq -
B14|Caro-Kann Defense: Panov Attack|rnbqkb1r/pp3ppp/4pn2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR w KQkq -
B14|Caro-Kann Defense: Panov Attack|r2qkb1r/pp3ppp/2n2n2/1B1p4/3P2b1/2N2N2/PP3PPP/R1BQK2R w KQkq -
B14|Caro-Kann Defense: Panov Attack|r1bq1rk1/pp3ppp/2nb1n2/1B1p2B1/3P4/2N2N2/PP3PPP/R2Q1RK1 b - -
B14|Caro-Kann Defense: Panov Attack|r1bqkb1r/pp3ppp/2n1pn2/2Pp4/3P4/2N2N2/PP3PPP/R1BQKB1R b KQkq -
B15|Caro-Kann Defense|rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq -
B15|Caro-Kann Defense|rnbqkbnr/pp2pppp/2p5/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B15|Caro-Kann Defense: Alekhine Gambit|rnbqkb1r/pp2pppp/2p2n2/8/3PN3/3B4/PPP2PPP/R1BQK1NR b KQkq -
B15|Caro-Kann Defense: Alien Gambit|rnbqkb1r/pp2pNp1/2p2n1p/8/3P4/8/PPP2PPP/R1BQKBNR b KQkq -
B15|Caro-Kann Defense: Campomanes Attack|rnbqkb1r/pp2pppp/2p2n2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B15|Caro-Kann Defense: Forgacs Variation|rnbqkb1r/pp3ppp/2p2p2/8/2BP4/8/PPP2PPP/R1BQK1NR b KQkq -
B15|Caro-Kann Defense: Gurgenidze Counterattack|rnbqkbnr/p3pppp/2p5/1p1p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B15|Caro-Kann Defense: Gurgenidze System|rnbqkbnr/pp2pp1p/2p3p1/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
B15|Caro-Kann Defense: Main Line|rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR b KQkq -
B15|Caro-Kann Defense: Rasa-Studier Gambit|rnbqkbnr/pp2pppp/2p5/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR b KQkq -
B15|Caro-Kann Defense: Tartakower Variation|rnbqkb1r/pp3ppp/2p2p2/8/3P4/8/PPP2PPP/R1BQKBNR w KQkq -
B15|Caro-Kann Defense: von Hennig Gambit|rnbqkbnr/pp2pppp/2p5/8/2BPp3/2N5/PPP2PPP/R1BQK1NR b KQkq -
B16|Caro-Kann Defense: Bronstein-Larsen Variation|rnbqkb1r/pp2pp1p/2p2p2/8/3P4/8/PPP2PPP/R1BQKBNR w KQkq -
B16|Caro-Kann Defense: Finnish Variation|rnbqkbnr/pp2ppp1/2p4p/8/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -
B17|Caro-Kann Defense: Karpov Variation|r1bqkbnr/pp1npppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -
B18|Caro-Kann Defense: Classical Variation|rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -
B18|Caro-Kann Defense: Martian Gambit|rn1qkbnr/pp2ppp1/2p1N1bp/8/3P4/5N2/PPP2PPP/R1BQKB1R b KQkq -
B19|Caro-Kann Defense: Classical Variation|r2qkbnr/pp1nppp1/2p3bp/8/3P3P/5NN1/PPP2PP1/R1BQKB1R w KQkq -
B20|Sicilian Defense|rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
B20|Sicilian Defense: Amazon Attack|rnbqkbnr/pp1ppppp/8/2p5/4P1Q1/8/PPPP1PPP/RNB1KBNR b KQkq -
B20|Sicilian Defense: Big Clamp Formation|r1bqkbnr/pp2pppp/2np4/2p5/4PP2/2PP4/PP4PP/RNBQKBNR b KQkq -
B20|Sicilian Defense: Bowdler Attack|rnbqkbnr/pp1ppppp/8/2p5/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq -
B20|Sicilian Defense: Brick Variation|rnbqkbnr/pp1ppppp/8/2p5/4P3/7N/PPPP1PPP/RNBQKB1R b KQkq -
B20|Sicilian Defense: Czerniak Attack|rnbqkbnr/pp1ppppp/8/2p5/4P3/1P6/P1PP1PPP/RNBQKBNR b KQkq -
B20|Sicilian Defense: Czerniak Attack, Queen Fianchetto Variation|rnbqkbnr/p2ppppp/1p6/2p5/4P3/1P6/P1PP1PPP/RNBQKBNR w KQkq -
B20|Sicilian Defense: Euwe Attack, Prins Gambit|rnbqkbnr/pp2pppp/8/2pp4/4P3/1P6/PBPP1PPP/RN1QKBNR b KQkq -
B20|Sicilian Defense: Gloria Variation|r1bqkbnr/pp2ppp1/2np4/2p4p/2P1P3/2N3P1/PP1P1P1P/R1BQKBNR w KQkq -
B20|Sicilian Defense: Grob Variation|rnbqkbnr/pp1ppppp/8/2p5/4P1P1/8/PPPP1P1P/RNBQKBNR b KQkq -
B20|Sicilian Defense: Keres Variation|rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPPNPPP/RNBQKB1R b KQkq -
B20|Sicilian Defense: King David's Opening|rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPPKPPP/RNBQ1BNR b kq -
B20|Sicilian Defense: Kronberger Variation|rnbqkbnr/pp1ppppp/8/2p5/4P3/N7/PPPP1PPP/R1BQKBNR b KQkq -
B20|Sicilian Defense: Kronberger Variation, Nemeth Gambit|r1bqkbnr/pp1ppppp/2n5/8/2BpP3/N7/PPP2PPP/R1BQK1NR b KQkq -
B20|Sicilian Defense: Lasker-Dunne Attack|rnbqkbnr/pp1ppppp/8/2p5/4P3/6P1/PPPP1P1P/RNBQKBNR b KQkq -
B20|Sicilian Defense: Mengarini Variation|rnbqkbnr/pp1ppppp/8/2p5/4P3/P7/1PPP1PPP/RNBQKBNR b KQkq -
B20|Sicilian Defense: Myers Attack, with a4|rnbqkbnr/pp1ppppp/8/2p5/P3P3/8/1PPP1PPP/RNBQKBNR b KQkq -
B20|Sicilian Defense: Myers Attack, with h4|rnbqkbnr/pp1ppppp/8/2p5/4P2P/8/PPPP1PP1/RNBQKBNR b KQkq -
B20|Sicilian Defense: Staunton-Cochrane Variation|rnbqkbnr/pp1ppppp/8/2p5/2P1P3/8/PP1P1PPP/RNBQKBNR b KQkq -
B20|Sicilian Defense: Wing Gambit|rnbqkbnr/pp1ppppp/8/2p5/1P2P3/8/P1PP1PPP/RNBQKBNR b KQkq -
B20|Sicilian Defense: Wing Gambit, Abrahams Variation|rnbqkbnr/pp1ppppp/8/8/1p2P3/8/PBPP1PPP/RN1QKBNR b KQkq -
B20|Sicilian Defense: Wing Gambit, Carlsbad Variation|rnbqkbnr/pp1ppppp/8/8/4P3/p7/2PP1PPP/RNBQKBNR w KQkq -
B20|Sicilian Defense: Wing Gambit, Marshall Variation|rnbqkbnr/pp1ppppp/8/8/1p2P3/P7/2PP1PPP/RNBQKBNR b KQkq -
B20|Sicilian Defense: Wing Gambit, Santasiere Variation|rnbqkbnr/pp1ppppp/8/8/1pP1P3/8/P2P1PPP/RNBQKBNR b KQkq c3
B21|Bird Opening: Dutch Variation, Batavo Gambit|rnbqkbnr/pp2pppp/8/2p5/4pP2/5N2/PPPP2PP/RNBQKB1R w KQkq -
B21|Sicilian Defense: Coles Sicilian Gambit|r1bqkb1r/pp1ppppp/2n2n2/8/2B1P3/8/PPP2PPP/RNBQK1NR b KQkq -
B21|Sicilian Defense: Halasz Gambit|rnbqkbnr/pp1ppppp/8/8/3pPP2/8/PPP3PP/RNBQKBNR b KQkq -
B21|Sicilian Defense: McDonnell Attack|rnbqkbnr/pp1ppppp/8/2p5/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -
B21|Sicilian Defense: McDonnell Attack, Tal Gambit|rnbqkb1r/pp2pppp/5n2/2pP4/5P2/8/PPPP2PP/RNBQKBNR w KQkq -
B21|Sicilian Defense: McDonnell Attack, Toilet Variation|rnbqkbnr/pp2pppp/8/2pp4/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq -
B21|Sicilian Defense: Morphy Gambit|rnbqkbnr/pp1ppppp/8/8/3pP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
B21|Sicilian Defense: Morphy Gambit, Andreaschek Gambit|rnbqkbnr/pp1p1ppp/8/4p3/3pP3/2P2N2/PP3PPP/RNBQKB1R b KQkq -
B21|Sicilian Defense: Smith-Morra Gambit|rnbqkbnr/pp1ppppp/8/2p5/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
B21|Sicilian Defense: Smith-Morra Gambit|rnbqkbnr/pp1ppppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Accepted|rnbqkbnr/pp1ppppp/8/8/4P3/2p5/PP3PPP/RNBQKBNR w KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Accepted, Danish Variation|rnbqkbnr/pp1ppppp/8/8/4P3/2p2N2/PP3PPP/RNBQKB1R b KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Accepted, Fianchetto Defense|rnbqkbnr/pp1ppp1p/6p1/8/4P3/2N5/PP3PPP/R1BQKBNR w KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Declined, Alapin Formation|rnbqkb1r/pp1ppppp/5n2/8/3pP3/2P5/PP3PPP/RNBQKBNR w KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Declined, Center Formation|rnbqkbnr/pp1p1ppp/8/4p3/3pP3/2P5/PP3PPP/RNBQKBNR w KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Declined, Dubois Variation|rnbqkbnr/pp1ppppp/8/8/2P1P3/3p4/PP3PPP/RNBQKBNR b KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Declined, Push Variation|rnbqkbnr/pp1ppppp/8/8/4P3/2Pp4/PP3PPP/RNBQKBNR w KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Declined, Scandinavian Formation|rnbqkbnr/pp2pppp/8/3p4/3pP3/2P5/PP3PPP/RNBQKBNR w KQkq -
B21|Sicilian Defense: Smith-Morra Gambit Declined, Wing Formation|rnb1kbnr/pp1ppppp/8/q7/3pP3/2P5/PP3PPP/RNBQKBNR w KQkq -
B22|Sicilian Defense: Alapin Variation|rnbqkbnr/pp1ppppp/8/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR b KQkq -
B22|Sicilian Defense: Alapin Variation, Anti-Alapin Gambit|rnbqkb1r/pp2pppp/5n2/2pP4/8/2P5/PP1P1PPP/RNBQKBNR w KQkq -
B22|Sicilian Defense: Alapin Variation, Barmen Defense|rnb1kbnr/pp2pppp/8/2pq4/8/2P5/PP1P1PPP/RNBQKBNR w KQkq -
B22|Sicilian Defense: Alapin Variation, Smith-Morra Declined|rnbqkb1r/pp1ppppp/8/3nP3/3p4/2P5/PP3PPP/RNBQKBNR w KQkq -
B22|Sicilian Defense: Delayed Alapin Variation|rnb1kb1r/pp3ppp/4pn2/2pq4/3P4/2P2N2/PP3PPP/RNBQKB1R w KQkq -
B22|Sicilian Defense: Delayed Alapin Variation|r1bqk1nr/pp3ppp/2nb4/1Bpp4/3P4/2P2N2/PP3PPP/RNBQ1RK1 b kq -
B22|Sicilian Defense: Heidenfeld Variation|r1bqkb1r/pp1ppppp/2n5/2pnP3/8/N1P2N2/PP1P1PPP/R1BQKB1R b KQkq -
B23|Sicilian Defense: Closed|rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq -
B23|Sicilian Defense: Closed|rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B23|Sicilian Defense: Closed|rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR b KQkq -
B23|Sicilian Defense: Closed, Chameleon Variation|r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPPNPPP/R1BQKB1R b KQkq -
B23|Sicilian Defense: Closed, Grob Attack|r1bqkbnr/pp1ppppp/2n5/2p5/4P1P1/2N5/PPPP1P1P/R1BQKBNR b KQkq -
B23|Sicilian Defense: Closed, Korchnoi Defense|rnbqkbnr/pp3ppp/4p3/2pp4/4P3/2N3P1/PPPP1P1P/R1BQKBNR w KQkq -
B23|Sicilian Defense: Closed, Portland Attack|r1bqkbnr/pp1ppp1p/2n3p1/2p5/4P1P1/2NP4/PPP2P1P/R1BQKBNR b KQkq -
B23|Sicilian Defense: Closed, Traditional|r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
B23|Sicilian Defense: Grand Prix Attack|r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq -
B24|Sicilian Defense: Closed|r1bqkbnr/pp1ppp1p/2n3p1/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR w KQkq -
B24|Sicilian Defense: Closed|r1bqk1nr/pp1pppbp/2n3p1/2p5/4P3/2N3P1/PPPP1PBP/R1BQK1NR w KQkq -
B24|Sicilian Defense: Closed, Fianchetto Variation|r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR b KQkq -
B25|Sicilian Defense: Closed|r1bqk1nr/pp2ppbp/2np2p1/2p5/4P3/2NP2P1/PPP2PBP/R1BQK1NR w KQkq -
B25|Sicilian Defense: Closed|r1bqk1nr/pp2ppbp/2np2p1/2p5/4PP2/2NP2P1/PPP3BP/R1BQK1NR b KQkq -
B26|Sicilian Defense: Closed|r1bqk1nr/pp2ppbp/2np2p1/2p5/4P3/2NPB1P1/PPP2PBP/R2QK1NR b KQkq -
B27|Modern Defense: Pterodactyl Variation|rnb1k1nr/pp1pppbp/6p1/q1p5/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq -
B27|Pterodactyl Defense: Western, Pterodactyl|rnb1k1nr/pp1pppbp/6p1/q1p5/3PP3/2P2N2/PP3PPP/RNBQKB1R w KQkq -
B27|Pterodactyl Defense: Western, Rhamphorhynchus|rnb1k1nr/pp1pppbp/6p1/q1P5/4P3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense|rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -
B27|Sicilian Defense: Acton Extension|rnbqk1nr/pp1ppp1p/6pb/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Brussels Gambit|rnbqkbnr/pp1pp1pp/8/2p2p2/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Bücker Variation|rnbqkbnr/pp1pppp1/7p/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Double-Dutch Gambit|rnbqkb1r/pp1pp1pp/7n/2p2P2/8/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Frederico Variation|rnbqkbnr/pp1pp2p/6p1/2p2p2/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Hyperaccelerated Dragon|rnbqkbnr/pp1ppp1p/6p1/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Hyperaccelerated Dragon|rnbqkbnr/pp1ppp1p/6p1/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
B27|Sicilian Defense: Hyperaccelerated Pterodactyl|rnbqk1nr/pp1pppbp/6p1/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Jalalabad Variation|rnbqkbnr/pp1p1ppp/8/2p1p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Katalimov Variation|rnbqkbnr/p2ppppp/1p6/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Mongoose Variation|rnb1kbnr/pp1ppppp/8/q1p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Polish Gambit|rnbqkbnr/p2ppppp/8/1pp5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B27|Sicilian Defense: Quinteros Variation|rnb1kbnr/ppqppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation|rnbqkbnr/1p1ppppp/p7/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation, Aronin System|rnbqkbnr/1p1ppppp/p7/2p5/4P3/5N2/PPPPBPPP/RNBQK2R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Kieseritzky System|rnbqkbnr/1p1ppppp/p7/2p5/4P3/1P3N2/P1PP1PPP/RNBQKB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Maróczy Bind|rnbqkbnr/1p1ppppp/p7/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Maróczy Bind, Paulsen Line|rnbqkbnr/1p1p1ppp/p3p3/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation, Maróczy Bind, Robatsch Line|rnbqkbnr/1p2pppp/p2p4/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation, Normal System|rnbqkbnr/1p1ppppp/p7/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Normal System, Cortlever Gambit|rnbqkbnr/1p1ppppp/p7/8/2BpP3/5N2/PPP2PPP/RNBQK2R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Normal System, Smith-Morra Line|rnbqkbnr/1p1ppppp/p7/8/3pP3/2P2N2/PP3PPP/RNBQKB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Normal System, Taimanov Line|rnbqkbnr/1p1p1ppp/p7/4p3/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation, Normal System, Zagorovsky Line|rnbqkbnr/1p1ppppp/p7/8/3QP3/5N2/PPP2PPP/RNB1KB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Quiet System|rnbqkbnr/1p1ppppp/p7/2p5/4P3/3P1N2/PPP2PPP/RNBQKB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Réti System|rnbqkbnr/1p1ppppp/p7/2p5/4P3/5NP1/PPPP1P1P/RNBQKB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Venice System|rnbqkbnr/1p1ppppp/p7/2p5/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Venice System, Barcza Line|rnbqkb1r/1p1ppppp/p4n2/2p5/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation, Venice System, Gambit Line|rnbqkb1r/1p2pppp/p4n2/2pP4/8/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation, Venice System, Ljubojevic Line|rnbqkbnr/3ppppp/p7/1pp5/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation, Venice System, Steiner Line|rnbqkbnr/1p2pppp/p2p4/2p5/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -
B28|Sicilian Defense: O'Kelly Variation, Wing Gambit|rnbqkbnr/1p1ppppp/p7/2p5/1P2P3/5N2/P1PP1PPP/RNBQKB1R b KQkq -
B28|Sicilian Defense: O'Kelly Variation, Yerevan System|rnbqkbnr/1p1ppppp/p7/2p5/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq -
B29|Sicilian Defense: Nimzowitsch Variation|rnbqkb1r/pp1ppppp/5n2/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B29|Sicilian Defense: Nimzowitsch Variation, Advance Variation|rnbqkb1r/pp1ppppp/5n2/2p1P3/8/5N2/PPPP1PPP/RNBQKB1R b KQkq -
B29|Sicilian Defense: Nimzowitsch Variation, Closed Variation|rnbqkb1r/pp1ppppp/5n2/2p5/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq -
B29|Sicilian Defense: Nimzowitsch Variation, Exchange Variation|rnbqkb1r/pp1ppppp/8/2p1P3/8/2n2N2/PPPP1PPP/R1BQKB1R w KQkq -
B30|Sicilian Defense: Closed, Anti-Sveshnikov Variation|r1bqkbnr/pp1p1ppp/2n5/2p1p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq -
B30|Sicilian Defense: Nyezhmetdinov-Rossolimo Attack|r1bqkbnr/pp1ppppp/2n5/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
B30|Sicilian Defense: Nyezhmetdinov-Rossolimo Attack, Brooklyn Retreat Defense|rnbqkbnr/pp1ppppp/8/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
B30|Sicilian Defense: Nyezhmetdinov-Rossolimo Attack, San Francisco Gambit|r1bqkbnr/pp1ppppp/8/nBp5/1P2P3/5N2/P1PP1PPP/RNBQK2R b KQkq -
B30|Sicilian Defense: Old Sicilian|r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B30|Sicilian Defense: Portsmouth Gambit|r1bqkbnr/pp1ppppp/2n5/2p5/1P2P3/5N2/P1PP1PPP/RNBQKB1R b KQkq -
B31|Sicilian Defense: Nyezhmetdinov-Rossolimo Attack, Fianchetto Variation|r1bqkbnr/pp1ppp1p/2n3p1/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
B32|Sicilian Defense: Accelerated Dragon|r1bqkbnr/pp1ppp1p/2n3p1/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B32|Sicilian Defense: Flohr Variation|r1b1kbnr/ppqppppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B32|Sicilian Defense: Franco-Sicilian Variation|r1bqkbnr/pp1p1ppp/2n1p3/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B32|Sicilian Defense: Godiva Variation|r1b1kbnr/pp1ppppp/1qn5/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B32|Sicilian Defense: Kalashnikov Variation|r1bqkbnr/pp3ppp/2np4/1N2p3/4P3/8/PPP2PPP/RNBQKB1R w KQkq -
B32|Sicilian Defense: Löwenthal Variation|r1bqkbnr/pp1p1ppp/2n5/4p3/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B32|Sicilian Defense: Nimzo-American Variation|r1bqkbnr/pp2pppp/2n5/3p4/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B32|Sicilian Defense: Open|r1bqkbnr/pp1ppppp/2n5/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
B32|Sicilian Defense: Open|r1bqkbnr/pp1ppppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B32|Sicilian Defense: Open|r1bqkbnr/pp1ppppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq -
B33|Sicilian Defense: Lasker-Pelikan Variation|r1bqkb1r/pp1p1ppp/2n2n2/4p3/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B33|Sicilian Defense: Open|r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B40|Sicilian Defense: Delayed Alapin Variation, with e6|rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq -
B40|Sicilian Defense: Drazic Variation|rnbqkbnr/1p1p1ppp/p3p3/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B40|Sicilian Defense: French Variation|rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B40|Sicilian Defense: French Variation, Normal|rnbqkb1r/pp1p1ppp/4pn2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B40|Sicilian Defense: French Variation, Open|rnbqkbnr/pp1p1ppp/4p3/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B40|Sicilian Defense: French Variation, Westerinen Attack|rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/1P3N2/P1PP1PPP/RNBQKB1R b KQkq -
B40|Sicilian Defense: Gaw-Paw Variation|rnb1kb1r/pp1p1ppp/1q2pn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B40|Sicilian Defense: Kramnik Variation|rnbqkbnr/pp1p1ppp/4p3/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq -
B40|Sicilian Defense: Kveinis Variation|rnb1kbnr/pp1p1ppp/1q2p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B40|Sicilian Defense: Marshall Counterattack|rnbqkbnr/pp3ppp/4p3/2pp4/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B40|Sicilian Defense: Paulsen-Basman Defense|rnbqk1nr/pp1p1ppp/4p3/2b5/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B40|Sicilian Defense: Pin Variation|rnbqk2r/pp1p1ppp/4pn2/8/1b1NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B40|Sicilian Defense: Smith-Morra Gambit Deferred|rnbqkbnr/pp1p1ppp/4p3/8/3pP3/2P2N2/PP3PPP/RNBQKB1R b KQkq -
B40|Sicilian Defense: Wing Gambit Deferred|rnbqkbnr/pp1p1ppp/4p3/2p5/1P2P3/5N2/P1PP1PPP/RNBQKB1R b KQkq -
B41|Sicilian Defense: Kan Variation|rnbqkbnr/1p1p1ppp/p3p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B44|Sicilian Defense: Taimanov Variation|r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B45|Sicilian Defense: Four Knights Variation|r1bqkb1r/pp1p1ppp/2n1pn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B45|Sicilian Defense: Taimanov Variation|r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq -
B46|Sicilian Defense: Taimanov Variation|r1bqkbnr/1p1p1ppp/p1n1p3/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B50|Sicilian Defense|rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
B50|Sicilian Defense|rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B50|Sicilian Defense: Delayed Alapin Variation, with d6|rnbqkbnr/pp2pppp/3p4/2p5/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq -
B50|Sicilian Defense: Kopec System|rnbqkbnr/pp2pppp/3p4/2p5/4P3/3B1N2/PPPP1PPP/RNBQK2R b KQkq -
B50|Sicilian Defense: Kotov Gambit|rnbqkbnr/p3pppp/3p4/1pp5/4P3/5NP1/PPPP1P1P/RNBQKB1R w KQkq -
B50|Sicilian Defense: Modern Variations|rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
B50|Sicilian Defense: Modern Variations, Anti-Qxd4 Move Order|rnbqkb1r/pp2pppp/3p1n2/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B50|Sicilian Defense: Modern Variations, Anti-Qxd4 Move Order Accepted|rnbqkb1r/pp2pppp/3p4/2P5/4n3/5N2/PPP2PPP/RNBQKB1R w KQkq -
B50|Sicilian Defense: Modern Variations, Tartakower|rnbqkbnr/pp2pppp/3p4/8/3pP3/2P2N2/PP3PPP/RNBQKB1R b KQkq -
B50|Sicilian Defense: Wing Gambit, Deferred Variation|rnbqkbnr/pp2pppp/3p4/2p5/1P2P3/5N2/P1PP1PPP/RNBQKB1R b KQkq -
B51|Sicilian Defense: Moscow Variation|rnbqkbnr/pp2pppp/3p4/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
B52|Sicilian Defense: Moscow Variation, Main Line|rn1qkbnr/pp1bpppp/3p4/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
B53|Sicilian Defense: Chekhover Variation|rnbqkbnr/pp2pppp/3p4/8/3QP3/5N2/PPP2PPP/RNB1KB1R b KQkq -
B54|Sicilian Defense: Dragon Variation, Accelerated Dragon|rnbqkbnr/pp2pp1p/3p2p1/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B54|Sicilian Defense: Modern Variations, Main Line|rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
B54|Sicilian Defense: Prins Variation|rnbqkb1r/pp2pppp/3p1n2/8/3NP3/5P2/PPP3PP/RNBQKB1R b KQkq -
B56|Sicilian Defense: Classical Variation|r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B56|Sicilian Defense: Kupreichik Variation|rn1qkb1r/pp1bpppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B56|Sicilian Defense: Spielmann Variation|r1bqkb1r/pp2pppp/2np1n2/8/4P3/2N5/PPP1NPPP/R1BQKB1R b KQkq -
B56|Sicilian Defense: Venice Attack|rnbqkb1r/pp3ppp/3p1n2/1B2p3/3NP3/2N5/PPP2PPP/R1BQK2R b KQkq -
B57|Sicilian Defense: Magnus Smith Trap|r1bqkb1r/p3pp1p/2pp1np1/4P3/2B5/2N5/PPP2PPP/R1BQK2R b KQkq -
B58|Sicilian Defense: Boleslavsky Variation|r1bqkb1r/pp3ppp/2np1n2/4p3/3NP3/2N5/PPP1BPPP/R1BQK2R w KQkq -
B58|Sicilian Defense: Classical Variation|r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R b KQkq -
B59|Sicilian Defense: Boleslavsky Variation|r1bqkb1r/pp3ppp/2np1n2/4p3/4P3/1NN5/PPP1BPPP/R1BQK2R b KQkq -
B60|Sicilian Defense: Richter-Rauzer Variation|r1bqkb1r/pp2pppp/2np1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R b KQkq -
B62|Sicilian Defense: Richter-Rauzer Variation|r1bqkb1r/pp3ppp/2nppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq -
B62|Sicilian Defense: Richter-Rauzer Variation|r1bqkb1r/pp3ppp/2nppn2/6B1/3NP3/2NQ4/PPP2PPP/R3KB1R b KQkq -
B70|Sicilian Defense: Dragon Variation|rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B72|Sicilian Defense: Dragon Variation|rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq -
B80|Sicilian Defense: Scheveningen Variation|rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B86|Sicilian Defense: Sozin Attack|rnbqkb1r/pp3ppp/3ppn2/8/2BNP3/2N5/PPP2PPP/R1BQK2R b KQkq -
B89|Sicilian Defense: Velimirovic Attack|r1bqk2r/pp2bppp/2nppn2/8/2BNP3/2N1B3/PPP1QPPP/R3K2R b KQkq -
B90|Sicilian Defense: Najdorf Variation|rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -
B94|Sicilian Defense: Najdorf Variation|rnbqkb1r/1p2pppp/p2p1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R b KQkq -
B95|Sicilian Defense: Najdorf Variation|rnbqkb1r/1p3ppp/p2ppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq -
B96|Sicilian Defense: Najdorf Variation|rnbqkb1r/1p3ppp/p2ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R b KQkq -
B98|Sicilian Defense: Najdorf Variation|rnbqk2r/1p2bppp/p2ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R w KQkq -
C00|French Defense|rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
C00|French Defense|rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
C00|French Defense: Alapin Gambit|rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/4B3/PPP2PPP/RN1QKBNR b KQkq -
C00|French Defense: Baeuerle Gambit|rnbqkbnr/p1pp1ppp/4p3/1p6/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
C00|French Defense: Banzai-Leong Gambit|rnbqkbnr/pppp1ppp/4p3/8/1P2P3/8/P1PP1PPP/RNBQKBNR b KQkq -
C00|French Defense: Banzai-Leong Gambit, Pinova Gambit|rnbqk1nr/pppp1ppp/4p3/4P3/1b6/8/P1PP1PPP/RNBQKBNR b KQkq -
C00|French Defense: Bird Invitation|rnbqkbnr/pppp1ppp/4p3/1B6/4P3/8/PPPP1PPP/RNBQK1NR b KQkq -
C00|French Defense: Carlson Gambit|rnbqkbnr/ppp2ppp/4p3/4N3/3Pp3/8/PPP2PPP/RNBQKB1R b KQkq -
C00|French Defense: Chigorin Variation|rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPPQPPP/RNB1KBNR b KQkq -
C00|French Defense: Diemer-Duhm Gambit|rnbqkbnr/ppp2ppp/4p3/3p4/2PPP3/8/PP3PPP/RNBQKBNR b KQkq -
C00|French Defense: Diemer-Duhm Gambit Accepted|rnbqkbnr/ppp2ppp/4p3/8/2PPp3/8/PP3PPP/RNBQKBNR w KQkq -
C00|French Defense: Franco-Hiva Gambit|rnbqkbnr/pppp2pp/4p3/5p2/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
C00|French Defense: Franco-Hiva Gambit Accepted|rnbqkbnr/pppp2pp/4p3/5P2/3P4/8/PPP2PPP/RNBQKBNR b KQkq -
C00|French Defense: Franco-Sicilian Defense|rnbqkbnr/pp1p1ppp/4p3/2p5/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
C00|French Defense: Hoffmann Gambit|rnbqkbnr/ppp2ppp/8/3p4/3PPp2/8/PPP1Q1PP/RNB1KBNR w KQkq -
C00|French Defense: Horwitz Attack|rnbqkbnr/pppp1ppp/4p3/8/4P3/1P6/P1PP1PPP/RNBQKBNR b KQkq -
C00|French Defense: Horwitz Attack, Papa-Ticulat Gambit|rnbqkbnr/ppp2ppp/4p3/3p4/4P3/1P6/PBPP1PPP/RN1QKBNR b KQkq -
C00|French Defense: King's Indian Attack|rnbqkbnr/pppp1ppp/4p3/8/4P3/3P4/PPP2PPP/RNBQKBNR b KQkq -
C00|French Defense: King's Indian Attack, Franco-Hiva Gambit|rnbqkbnr/pppp2pp/4p3/5p2/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq -
C00|French Defense: Knight Variation|rnbqkbnr/pppp1ppp/4p3/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -
C00|French Defense: Knight Variation, Franco-Hiva Gambit|rnbqkbnr/pppp2pp/4p3/5p2/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C00|French Defense: La Bourdonnais Variation|rnbqkbnr/pppp1ppp/4p3/8/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -
C00|French Defense: La Bourdonnais Variation, Reuter Gambit|rnbqkbnr/ppp2ppp/4p3/8/4pP2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C00|French Defense: Mediterranean Defense|rnbqkb1r/pppp1ppp/4pn2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
C00|French Defense: Morphy Gambit|rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/7N/PPP2PPP/RNBQKB1R b KQkq -
C00|French Defense: Normal Variation|rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
C00|French Defense: Orthoschnapp Gambit|rnbqkbnr/ppp2ppp/8/3p4/4P3/1Q6/PP1P1PPP/RNB1KBNR b KQkq -
C00|French Defense: Pelikan Variation|rnbqkbnr/ppp2ppp/4p3/3p4/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq -
C00|French Defense: Perseus Gambit|rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
C00|French Defense: Queen's Knight|rnbqkbnr/pppp1ppp/4p3/8/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq -
C00|French Defense: Reversed Philidor Formation|r1bqkb1r/ppp2ppp/2n1pn2/3p4/4P3/3P1N2/PPPNBPPP/R1BQK2R b KQkq -
C00|French Defense: Réti-Spielmann Attack|rnbqkbnr/pppp1ppp/4p3/8/4P3/6P1/PPPP1P1P/RNBQKBNR b KQkq -
C00|French Defense: Schlechter Variation|rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/3B4/PPP2PPP/RNBQK1NR b KQkq -
C00|French Defense: St. George Defense|rnbqkbnr/1ppp1ppp/p3p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
C00|French Defense: St. George Defense, Sanky-George Gambit|rnbqkbnr/2pp1ppp/p3p3/1p6/2PPP3/8/PP3PPP/RNBQKBNR w KQkq -
C00|French Defense: St. George Defense, St. George Gambit|rnbqkbnr/2pp1ppp/4p3/1p6/3PP3/8/PP3PPP/RNBQKBNR w KQkq -
C00|French Defense: St. George Defense, Three Pawn Attack|rnbqkbnr/1ppp1ppp/p3p3/8/2PPP3/8/PP3PPP/RNBQKBNR b KQkq -
C00|French Defense: Steiner Variation|rnbqkbnr/pppp1ppp/4p3/8/2P1P3/8/PP1P1PPP/RNBQKBNR b KQkq -
C00|French Defense: Steinitz Attack|rnbqkbnr/pppp1ppp/4p3/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq -
C00|French Defense: Two Knights Variation|rnbqkbnr/ppp2ppp/4p3/3p4/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq -
C00|French Defense: Wing Gambit|rnbqkbnr/pp3ppp/4p3/2ppP3/1P6/5N2/P1PP1PPP/RNBQKB1R b KQkq -
C00|Rat Defense: Small Center Defense|rnbqkbnr/ppp2ppp/3pp3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
C01|French Defense: Exchange Variation|rnbqkbnr/ppp2ppp/4p3/3P4/3P4/8/PPP2PPP/RNBQKBNR b KQkq -
C01|French Defense: Exchange Variation|rnbqkbnr/ppp2ppp/8/3p4/3P4/5N2/PPP2PPP/RNBQKB1R b KQkq -
C01|French Defense: Exchange Variation|rnbqkbnr/ppp2ppp/8/3p4/3P4/2N5/PPP2PPP/R1BQKBNR b KQkq -
C01|French Defense: Exchange Variation, Monte Carlo Variation|rnbqkbnr/ppp2ppp/8/3p4/2PP4/8/PP3PPP/RNBQKBNR b KQkq -
C02|French Defense: Advance Variation|rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq -
C02|French Defense: Advance Variation|rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
C02|French Defense: Advance Variation|rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR b KQkq -
C02|French Defense: Advance Variation|r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR w KQkq -
C02|French Defense: Advance Variation, Extended Bishop Swap|rn1qkbnr/pppb1ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq -
C02|French Defense: Advance Variation, Frenkel Gambit|rnbqkbnr/pp3ppp/4p3/2ppP3/1P1P4/8/P1P2PPP/RNBQKBNR b KQkq -
C02|French Defense: Advance Variation, Nimzowitsch Attack|rnbqkbnr/pp3ppp/4p3/2ppP3/3P2Q1/8/PPP2PPP/RNB1KBNR b KQkq -
C02|French Defense: Advance Variation, Nimzowitsch System|rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/5N2/PPP2PPP/RNBQKB1R b KQkq -
C02|French Defense: Advance Variation, Steinitz Variation|rnbqkbnr/pp3ppp/4p3/2PpP3/8/8/PPP2PPP/RNBQKBNR b KQkq -
C03|French Defense: Tarrasch Variation|rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR b KQkq -
C03|French Defense: Tarrasch Variation, Guimard Defense|r1bqkbnr/ppp2ppp/2n1p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR w KQkq -
C03|French Defense: Tarrasch Variation, Haberditz Variation|rnbqkbnr/ppp3pp/4p3/3p1p2/3PP3/8/PPPN1PPP/R1BQKBNR w KQkq -
C03|French Defense: Tarrasch Variation, Modern System|rnbqkbnr/1pp2ppp/p3p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR w KQkq -
C03|French Defense: Tarrasch Variation, Morozevich Variation|rnbqk1nr/ppp1bppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR w KQkq -
C04|French Defense: Tarrasch Variation, Guimard Defense, Main Line|r1bqkb1r/ppp2ppp/2n1pn2/3p4/3PP3/5N2/PPPN1PPP/R1BQKB1R w KQkq -
C05|French Defense: Tarrasch Variation, Closed Variation|rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/8/PPPN1PPP/R1BQKBNR w KQkq -
C07|French Defense: Tarrasch Variation, Chistyakov Defense|rnb1kbnr/pp3ppp/4p3/2pq4/3P4/8/PPPN1PPP/R1BQKBNR w KQkq -
C07|French Defense: Tarrasch Variation, Open System|rnbqkbnr/pp3ppp/4p3/2pp4/3PP3/8/PPPN1PPP/R1BQKBNR w KQkq -
C07|French Defense: Tarrasch Variation, Open System, Euwe-Keres Line|rnbqkbnr/pp3ppp/4p3/2pp4/3PP3/5N2/PPPN1PPP/R1BQKB1R b KQkq -
C07|French Defense: Tarrasch Variation, Open System, Shaposhnikov Gambit|rnbqkb1r/pp3ppp/4pn2/2pP4/3P4/8/PPPN1PPP/R1BQKBNR w KQkq -
C07|French Defense: Tarrasch Variation, Open System, Süchting Line|rnbqkbnr/pp3ppp/4p3/2pp4/3PP3/2P5/PP1N1PPP/R1BQKBNR b KQkq -
C08|French Defense: Tarrasch Variation, Open System|rnbqkbnr/pp3ppp/8/2pp4/3P4/8/PPPN1PPP/R1BQKBNR w KQkq -
C10|French Defense: Hecht-Reefschläger Variation|r1bqkbnr/ppp2ppp/2n1p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
C10|French Defense: Marshall Gambit|rnbqkbnr/pp3ppp/4p3/2pp4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
C10|French Defense: Paulsen Variation|rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq -
C10|French Defense: Rubinstein Variation|rnbqkbnr/ppp2ppp/4p3/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -
C10|French Defense: Rubinstein Variation, Blackburne Defense|r1bqkbnr/pppn1ppp/4p3/8/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -
C10|French Defense: Rubinstein Variation, Ellis Gambit|rnbqkbnr/ppp2ppp/8/4p3/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -
C10|French Defense: Rubinstein Variation, Maric Variation|rnb1kbnr/ppp2ppp/4p3/3q4/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -
C11|French Defense: Classical Variation|rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
C11|French Defense: Classical Variation|rnbqkb1r/ppp2ppp/4pn2/3p2B1/3PP3/2N5/PPP2PPP/R2QKBNR b KQkq -
C11|French Defense: Classical Variation, Burn Variation|rnbqkb1r/ppp2ppp/4pn2/6B1/3Pp3/2N5/PPP2PPP/R2QKBNR w KQkq -
C11|French Defense: Classical Variation, Delayed Exchange Variation|rnbqkb1r/ppp2ppp/4pn2/3P4/3P4/2N5/PPP2PPP/R1BQKBNR b KQkq -
C11|French Defense: Classical Variation, Steinitz Variation|rnbqkb1r/ppp2ppp/4pn2/3pP3/3P4/2N5/PPP2PPP/R1BQKBNR b KQkq -
C11|French Defense: Classical Variation, Swiss Variation|rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2NB4/PPP2PPP/R1BQK1NR b KQkq -
C11|French Defense: Henneberger Variation|rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2N1B3/PPP2PPP/R2QKBNR b KQkq -
C11|French Defense: Steinitz Variation|rnbqkb1r/1ppn1ppp/p3p3/3pP3/3P4/2N2N2/PPP2PPP/R1BQKB1R w KQkq -
C11|French Defense: Steinitz Variation|rnbqkb1r/1ppn1ppp/p3p3/3pP3/3P4/P1N2N2/1PP2PPP/R1BQKB1R b KQkq -
C11|French Defense: Steinitz Variation|rnbqkb1r/1ppn1ppp/p3p3/3pP3/3P4/5N2/PPP1NPPP/R1BQKB1R b KQkq -
C11|French Defense: Steinitz Variation|r1bqkb1r/pp1n1ppp/2n1p3/2PpP3/5P2/2N5/PPP3PP/R1BQKBNR w KQkq -
C11|French Defense: Steinitz Variation|rnbqkb1r/pp1n1ppp/4p3/2ppP3/3P1P2/2N2N2/PPP3PP/R1BQKB1R b KQkq -
C12|French Defense: McCutcheon Variation|rnbqk2r/ppp2ppp/4pn2/3p2B1/1b1PP3/2N5/PPP2PPP/R2QKBNR w KQkq -
C13|French Defense: Alekhine-Chatard Attack|rnbqk2r/pppnbppp/4p3/3pP1B1/3P3P/2N5/PPP2PP1/R2QKBNR b KQkq -
C13|French Defense: Classical Variation|rnbqk2r/ppp1bppp/4pn2/6B1/3PN3/8/PPP2PPP/R2QKBNR w KQkq -
C13|French Defense: Classical Variation, Normal Variation|rnbqk2r/ppp1bppp/4pn2/3p2B1/3PP3/2N5/PPP2PPP/R2QKBNR w KQkq -
C14|French Defense: Classical Variation|rnbqkb1r/1ppn1ppp/p3p3/3pP1B1/3P4/2N2N2/PPP2PPP/R2QKB1R b KQkq -
C14|French Defense: Classical Variation|rnb1k2r/pppnqppp/4p3/3pP3/3P4/2N5/PPP2PPP/R2QKBNR w KQkq -
C15|French Defense: Winawer Variation|rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
C15|French Defense: Winawer Variation, Alekhine-Maróczy Gambit|rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP1NPPP/R1BQKB1R b KQkq -
C15|French Defense: Winawer Variation, Delayed Exchange Variation|rnbqk1nr/ppp2ppp/4p3/3P4/1b1P4/2N5/PPP2PPP/R1BQKBNR b KQkq -
C15|French Defense: Winawer Variation, Fingerslip Variation|rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPPB1PPP/R2QKBNR b KQkq -
C16|French Defense: Winawer Variation, Advance Variation|rnbqk1nr/ppp2ppp/4p3/3pP3/1b1P4/2N5/PPP2PPP/R1BQKBNR b KQkq -
C16|French Defense: Winawer Variation, Petrosian Variation|rnb1k1nr/pppq1ppp/4p3/3pP3/1b1P4/2N5/PPP2PPP/R1BQKBNR w KQkq -
C17|French Defense: Winawer Variation, Advance Variation|rnbqk1nr/pp3ppp/4p3/2ppP3/1b1P4/2N5/PPP2PPP/R1BQKBNR w KQkq -
C20|Barnes Opening: Walkerling|rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5P2/PPPP2PP/RNBQK1NR b KQkq -
C20|Bongcloud Attack|rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR b kq -
C20|Center Game|rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
C20|English Opening: The Whale|rnbqkbnr/pppp1ppp/8/4p3/2P1P3/8/PP1P1PPP/RNBQKBNR b KQkq -
C20|King's Pawn Game|rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -
C20|King's Pawn Game: Alapin Opening|rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPPNPPP/RNBQKB1R b KQkq -
C20|King's Pawn Game: Bavarian Gambit|rnbqkbnr/ppp2ppp/8/3pp3/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq -
C20|King's Pawn Game: Beyer Gambit|rnbqkbnr/ppp2ppp/8/3pp3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -
C20|King's Pawn Game: Clam Variation, King's Gambit Reversed|rnbqkbnr/pppp2pp/8/4pp2/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq -
C20|King's Pawn Game: Clam Variation, Radisch Gambit|rnbqk2r/pppp1ppp/5n2/2b1p3/4PP2/3P4/PPP3PP/RNBQKBNR w KQkq -
C20|King's Pawn Game: King's Head Opening|rnbqkbnr/pppp1ppp/8/4p3/4P3/5P2/PPPP2PP/RNBQKBNR b KQkq -
C20|King's Pawn Game: King's Head Opening|rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N2P2/PPPP2PP/R1BQKBNR b KQkq -
C20|King's Pawn Game: Leonardis Variation|rnbqkbnr/pppp1ppp/8/4p3/4P3/3P4/PPP2PPP/RNBQKBNR b KQkq -
C20|King's Pawn Game: MacLeod Attack|rnbqkbnr/pppp1ppp/8/4p3/4P3/2P5/PP1P1PPP/RNBQKBNR b KQkq -
C20|King's Pawn Game: MacLeod Attack, Lasa Gambit|rnbqkbnr/pppp2pp/8/4pp2/4P3/2P5/PP1P1PPP/RNBQKBNR w KQkq -
C20|King's Pawn Game: MacLeod Attack, Norwalde Gambit|rnbqk1nr/ppp2ppp/3b4/3pp2Q/4P3/2P5/PP1P1PPP/RNB1KBNR w KQkq -
C20|King's Pawn Game: Mengarini's Opening|rnbqkbnr/pppp1ppp/8/4p3/4P3/P7/1PPP1PPP/RNBQKBNR b KQkq -
C20|King's Pawn Game: Napoleon Attack|rnbqkbnr/pppp1ppp/8/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR b KQkq -
C20|King's Pawn Game: Philidor Gambit|rn1qkbnr/pppb1ppp/3p4/4P3/4P3/8/PPP2PPP/RNBQKBNR w KQkq -
C20|King's Pawn Game: Tortoise Opening|rnbqkbnr/pppp1ppp/8/4p3/4P3/3B4/PPPP1PPP/RNBQK1NR b KQkq -
C20|King's Pawn Game: Wayward Queen Attack|rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq -
C20|King's Pawn Game: Wayward Queen Attack, Kiddie Countergambit|rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq -
C20|King's Pawn Game: Weber Gambit|r1bqkbnr/pp3ppp/2n5/4p3/8/3P4/PPP2PPP/RNBQKBNR w KQkq -
C20|King's Pawn Opening|rnbqkbnr/pppp1ppp/8/4p3/4P3/1P6/P1PP1PPP/RNBQKBNR b KQkq -
C20|King's Pawn Opening: Speers|rnbqkb1r/pppp1ppp/5n2/4pQ2/4P3/8/PPPP1PPP/RNB1KBNR b KQkq -
C20|King's Pawn Opening: Van Hooydoon Gambit|r1bqk2r/pppp1ppp/5n2/2b5/3nP3/5N2/PP2QPPP/RNB1KB1R w KQkq -
C20|Portuguese Opening|rnbqkbnr/pppp1ppp/8/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq -
C20|Portuguese Opening: Miguel Gambit|rnbqk1nr/pppp1ppp/8/1Bb1p3/1P2P3/8/P1PP1PPP/RNBQK1NR b KQkq -
C20|Portuguese Opening: Portuguese Gambit|rnbqkb1r/pppp1ppp/5n2/1B2p3/3PP3/8/PPP2PPP/RNBQK1NR b KQkq -
C21|Center Game|rnbqkbnr/pppp1ppp/8/8/3QP3/8/PPP2PPP/RNB1KBNR b KQkq -
C21|Center Game Accepted|rnbqkbnr/pppp1ppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR w KQkq -
C21|Center Game: Halasz-McDonnell Gambit|rnbqkbnr/pppp1ppp/8/8/3pPP2/8/PPP3PP/RNBQKBNR b KQkq -
C21|Center Game: Kieseritzky Variation|rnbqkbnr/pppp1ppp/8/8/3pP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
C21|Center Game: Kieseritzky Variation|rnbqkbnr/pp1p1ppp/8/2p5/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C21|Center Game: Kieseritzky Variation|rnbqkbnr/pp1p1ppp/8/2p5/2BpP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C21|Center Game: Lanc-Arnold Gambit|rnbqk1nr/pppp1ppp/8/2b5/3pP3/2P2N2/PP3PPP/RNBQKB1R b KQkq -
C21|Center Game: Ross Gambit|rnbqkbnr/pppp1ppp/8/8/3pP3/3B4/PPP2PPP/RNBQK1NR b KQkq -
C21|Center Game: von der Lasa Gambit|rnbqkbnr/pppp1ppp/8/8/2BpP3/8/PPP2PPP/RNBQK1NR b KQkq -
C21|Danish Gambit|rnbqkbnr/pppp1ppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b KQkq -
C21|Danish Gambit Accepted|rnbqkbnr/pppp1ppp/8/8/4P3/2p5/PP3PPP/RNBQKBNR w KQkq -
C21|Danish Gambit Accepted: Chigorin Defense|rnb1kbnr/ppppqppp/8/8/2B1P3/8/PB3PPP/RN1QK1NR w KQkq -
C21|Danish Gambit Accepted: Classical Defense|rnbqkb1r/pppp1ppp/5n2/8/2B1P3/8/PB3PPP/RN1QK1NR w KQkq -
C21|Danish Gambit Accepted: Copenhagen Defense|rnbqk1nr/pppp1ppp/8/8/1bB1P3/8/PB3PPP/RN1QK1NR w KQkq -
C21|Danish Gambit Accepted: Schlechter Defense|rnbqkbnr/ppp2ppp/8/3p4/2B1P3/8/PB3PPP/RN1QK1NR w KQkq -
C21|Danish Gambit Accepted: Svenonius Defense|rnbqkb1r/ppppnppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR w KQkq -
C21|Danish Gambit Declined: Sörensen Defense|rnbqkbnr/ppp2ppp/8/3p4/3pP3/2P5/PP3PPP/RNBQKBNR w KQkq -
C22|Center Game: Berger Variation|r1bqkb1r/pppp1ppp/2n2n2/8/4P3/4Q3/PPP2PPP/RNB1KBNR w KQkq -
C22|Center Game: Charousek Variation|r1bqk1nr/ppppbppp/2n5/8/4P3/2P1Q3/PP3PPP/RNB1KBNR w KQkq -
C22|Center Game: Hall Variation|r1bqkbnr/pppp1ppp/2n5/8/2Q1P3/8/PPP2PPP/RNB1KBNR b KQkq -
C22|Center Game: Kupreichik Variation|r1bqr1k1/ppp2ppp/2np1n2/8/1bB1P3/2N1Q2N/PPPB1PPP/2KR3R b - -
C22|Center Game: Normal Variation|r1bqkbnr/pppp1ppp/2n5/8/3QP3/8/PPP2PPP/RNB1KBNR w KQkq -
C22|Center Game: Paulsen Attack Variation|r1bqkbnr/pppp1ppp/2n5/8/4P3/4Q3/PPP2PPP/RNB1KBNR b KQkq -
C22|Center Game: l'Hermet Variation|r1bqkbnr/pppp2pp/2n5/5p2/4P3/4Q3/PPP2PPP/RNB1KBNR w KQkq -
C23|Bishop's Opening|rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq -
C23|Bishop's Opening: Anderssen Gambit|rnbqkbnr/p2p1ppp/2p5/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR w KQkq -
C23|Bishop's Opening: Boi Variation|rnbqk1nr/pppp1ppp/8/2b1p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq -
C23|Bishop's Opening: Calabrese Countergambit|rnbqkbnr/pppp2pp/8/4pp2/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq -
C23|Bishop's Opening: Calabrese Countergambit, Jaenisch Variation|rnbqkbnr/pppp2pp/8/4pp2/2B1P3/3P4/PPP2PPP/RNBQK1NR b KQkq -
C23|Bishop's Opening: Four Pawns Gambit|rnbqk1nr/pppp1ppp/8/8/2BPP2b/5N2/P1P4p/RNBQ1R1K b kq -
C23|Bishop's Opening: Khan Gambit|rnbqkbnr/ppp2ppp/8/3pp3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq -
C23|Bishop's Opening: Lewis Countergambit|rnbqk1nr/ppp2ppp/8/2bpp3/2B1P3/2P5/PP1P1PPP/RNBQK1NR w KQkq -
C23|Bishop's Opening: Lewis Countergambit|rnbqk2r/ppp2ppp/5n2/2bBp3/4P3/2P5/PP1P1PPP/RNBQK1NR w KQkq -
C23|Bishop's Opening: Lewis Gambit|rnbqk1nr/pppp1ppp/8/2b1p3/2BPP3/8/PPP2PPP/RNBQK1NR b KQkq -
C23|Bishop's Opening: Lisitsyn Variation|r2qkbnr/pp3ppp/8/3pn3/8/8/PPP1NPPP/RNBQK2R b KQkq -
C23|Bishop's Opening: Lopez Gambit|r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1PP2/2P5/PP1PQ1PP/RNB1K1NR b KQkq -
C23|Bishop's Opening: Lopez Variation|rnbqk1nr/pppp1ppp/8/2b1p3/2B1P3/8/PPPPQPPP/RNB1K1NR b KQkq -
C23|Bishop's Opening: Lopez Variation, Lopez Gambit|rnbqk2r/pppp1ppp/5n2/2b1p3/2B1PP2/8/PPPPQ1PP/RNB1K1NR b KQkq -
C23|Bishop's Opening: McDonnell Gambit|rnbqk1nr/pppp1ppp/8/2b1p3/1PB1P3/8/P1PP1PPP/RNBQK1NR b KQkq -
C23|Bishop's Opening: McDonnell Gambit, La Bourdonnais-Denker Gambit|rnbqk1nr/pppp1ppp/8/4p3/1bB1P3/2P5/P2P1PPP/RNBQK1NR b KQkq -
C23|Bishop's Opening: McDonnell Gambit, McDonnell Double Gambit|rnbqk1nr/pppp1ppp/8/4p3/1bB1PP2/8/P1PP2PP/RNBQK1NR b KQkq -
C23|Bishop's Opening: Philidor Counterattack|rnbqkbnr/pp1p1ppp/2p5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq -
C23|Bishop's Opening: Philidor Variation|rnbqk1nr/pppp1ppp/8/2b1p3/2B1P3/2P5/PP1P1PPP/RNBQK1NR b KQkq -
C23|Bishop's Opening: Pratt Variation|rnbq1rk1/ppp2ppp/5P2/2b4Q/2pp4/2P5/PP3PPP/RNB1K1NR w KQ -
C23|Bishop's Opening: Stein Gambit|rnbqk1nr/pppp1ppp/8/2b1p3/2B1PP2/8/PPPP2PP/RNBQK1NR b KQkq -
C23|Bishop's Opening: Thorold Gambit|rnbqkbnr/p1pp2pp/8/1B2pp2/4P3/8/PPPP1PPP/RNBQK1NR w KQkq -
C23|Bishop's Opening: del Rio Variation|rnb1k1nr/pppp1ppp/8/2b1p1q1/2B1P3/2P5/PP1P1PPP/RNBQK1NR w KQkq -
C24|Bishop's Opening: Berlin Defense|rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq -
C24|Bishop's Opening: Berlin Defense, Greco Gambit|rnbqkb1r/pppp1ppp/5n2/4p3/2B1PP2/8/PPPP2PP/RNBQK1NR b KQkq -
C24|Bishop's Opening: Kitchener Folly|rnbq1rk1/ppppbppp/5n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQ -
C24|Bishop's Opening: Krejcik Gambit|r1bqk2r/pppp1ppp/2n2n2/2b1p3/1PB1P3/5P2/P1PPN1PP/RNBQK2R b KQkq -
C24|Bishop's Opening: Pachman Gambit|rnbqkb1r/pppp1ppp/8/4p3/2B1n3/2N5/PPPP1PPP/RNBQK2R b KQkq -
C24|Bishop's Opening: Paulsen Defense|rnbqkb1r/pp1p1ppp/2p2n2/4p3/2B1P3/3P4/PPP2PPP/RNBQK1NR w KQkq -
C24|Bishop's Opening: Ponziani Gambit|rnbqkb1r/pppp1ppp/5n2/4p3/2BPP3/8/PPP2PPP/RNBQK1NR b KQkq -
C24|Bishop's Opening: Vienna Hybrid|r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2NP4/PPP2PPP/R1BQK1NR b KQkq -
C24|Bishop's Opening: Warsaw Gambit|rnbqkb1r/pppp1ppp/5n2/8/2BpP3/2P5/PP3PPP/RNBQK1NR b KQkq -
C25|Vienna Gambit, with Max Lange Defense|r1bqkbnr/pppp1ppp/2n5/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq -
C25|Vienna Gambit, with Max Lange Defense: Cunningham Defense|r1bqk1nr/ppppbppp/2n5/8/4Pp2/2N2N2/PPPP2PP/R1BQKB1R w KQkq -
C25|Vienna Gambit, with Max Lange Defense: Knight Variation|r1bqkbnr/pppp1ppp/2n5/8/4Pp2/2N2N2/PPPP2PP/R1BQKB1R b KQkq -
C25|Vienna Gambit, with Max Lange Defense: Quelle Gambit|r1bqk1nr/ppp2ppp/2np4/2b1P3/4P3/2N5/PPPP2PP/R1BQKBNR w KQkq -
C25|Vienna Gambit, with Max Lange Defense: Steinitz Gambit|r1bqkbnr/pppp1ppp/2n5/8/3PPp2/2N5/PPP3PP/R1BQKBNR b KQkq -
C25|Vienna Game|rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq -
C25|Vienna Game: Anderssen Defense|rnbqk1nr/pppp1ppp/8/2b1p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
C25|Vienna Game: Fyfe Gambit|r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq -
C25|Vienna Game: Giraffe Attack|rnbqk1nr/pppp1ppp/8/2b1p3/4P1Q1/2N5/PPPP1PPP/R1B1KBNR b KQkq -
C25|Vienna Game: Hamppe-Meitner Variation|rnbqk1nr/pppp1ppp/8/2b1p3/N3P3/8/PPPP1PPP/R1BQKBNR b KQkq -
C25|Vienna Game: Hamppe-Muzio Gambit|r1bqkbnr/pppp1p1p/2n5/8/2B1Ppp1/2N2N2/PPPP2PP/R1BQ1RK1 b kq -
C25|Vienna Game: Max Lange Defense|r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
C25|Vienna Game: Omaha Gambit|rnbqkbnr/ppp2ppp/3p4/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq -
C25|Vienna Game: Paulsen Variation|r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N3P1/PPPP1P1P/R1BQKBNR b KQkq -
C25|Vienna Game: Paulsen Variation|r1bqk2r/ppp2ppp/2n2n2/2bpp3/4P3/2N3P1/PPPPNPBP/R1BQK2R w KQkq -
C25|Vienna Game: Philidor Countergambit|r1bqkbnr/pppp2pp/2n5/4pp2/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq -
C25|Vienna Game: Zhuravlev Countergambit|rnbqk2r/pppp1ppp/5n2/4p3/1b2P1Q1/2N5/PPPP1PPP/R1B1KBNR w KQkq -
C26|Bishop's Opening: Horwitz Gambit|rnbqkb1r/p1pp1ppp/5n2/1p2p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR w KQkq -
C26|Bishop's Opening: Vienna Hybrid, Spielmann Attack|rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/2NP4/PPP2PPP/R1BQK1NR b KQkq -
C26|Vienna Game: Falkbeer Variation|rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -
C26|Vienna Game: Mengarini Variation|rnbqkb1r/pppp1ppp/5n2/4p3/4P3/P1N5/1PPP1PPP/R1BQKBNR b KQkq -
C26|Vienna Game: Mieses Variation|rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N3P1/PPPP1P1P/R1BQKBNR b KQkq -
C26|Vienna Game: Mieses Variation, Erben Gambit|rnbqkb1r/pp3ppp/2p2n2/3Pp3/8/2N3P1/PPPP1P1P/R1BQKBNR w KQkq -
C26|Vienna Game: Stanley Variation|rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR b KQkq -
C26|Vienna Game: Stanley Variation, Eifel Gambit|rnbqk2r/p1pp1ppp/5n2/1pb1p3/2B1P3/2N5/PPPPNPPP/R1BQK2R w KQkq -
C26|Vienna Game: Stanley Variation, Reversed Spanish|rnbqk2r/pppp1ppp/5n2/4p3/1bB1P3/2N5/PPPP1PPP/R1BQK1NR w KQkq -
C27|Bishop's Opening: Boden-Kieseritzky Gambit|rnbqkb1r/pppp1ppp/8/4p3/2B1n3/2N2N2/PPPP1PPP/R1BQK2R b KQkq -
C27|Bishop's Opening: Boden-Kieseritzky Gambit, Lichtenhein Defense|rnbqkb1r/ppp2ppp/8/3pp3/2B1n3/2N2N2/PPPP1PPP/R1BQK2R w KQkq -
C27|Vienna Game: Adams' Gambit|r1bqkb1r/pppp1ppp/2nn4/4p2Q/3P4/1BN5/PPP2PPP/R1B1K1NR b KQkq -
C27|Vienna Game: Frankenstein-Dracula Variation|rnbqkb1r/pppp1ppp/8/4p3/2B1n3/2N5/PPPP1PPP/R1BQK1NR w KQkq -
C28|Vienna Game: Stanley Variation, Three Knights Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR w KQkq -
C29|Vienna Game: Heyde Variation|rnbqkb1r/ppp3pp/8/3pPp2/3Pn3/2N2Q2/PPP3PP/R1B1KBNR b KQkq -
C29|Vienna Game: Vienna Gambit|rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq -
C29|Vienna Game: Vienna Gambit, Main Line|rnbqkb1r/ppp2ppp/5n2/3pp3/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq -
C29|Vienna Game: Vienna Gambit, Steinitz Variation|rnbqkb1r/ppp2ppp/5n2/3pp3/4PP2/2NP4/PPP3PP/R1BQKBNR b KQkq -
C30|King's Gambit|rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -
C30|King's Gambit Declined: Classical Variation|rnbqk1nr/pppp1ppp/8/2b1p3/4PP2/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Classical Variation|rnbqk1nr/ppp2ppp/3p4/2b1p3/4PP2/2P2N2/PP1P2PP/RNBQKB1R b KQkq -
C30|King's Gambit Declined: Classical Variation, Rotlewi Countergambit|rnbqk1nr/ppp2ppp/3p4/2b1p3/1P2PP2/5N2/P1PP2PP/RNBQKB1R b KQkq -
C30|King's Gambit Declined: Classical Variation, Rubinstein Countergambit|rnbqk1nr/ppp3pp/3p4/2b1pp2/4PP2/2P2N2/PP1P2PP/RNBQKB1R w KQkq -
C30|King's Gambit Declined: Classical Variation, Walthoffen Attack|rnbqk1nr/pppp1ppp/8/2b1p2Q/4PP2/8/PPPP2PP/RNB1KBNR b KQkq -
C30|King's Gambit Declined: Classical, Hanham Variation|r1bqk1nr/pppn1ppp/3p4/2b1p3/4PP2/2N2N2/PPPP2PP/R1BQKB1R w KQkq -
C30|King's Gambit Declined: Classical, Soldatenkov Variation|rnbqk1nr/ppp2ppp/3p4/2b1P3/4P3/5N2/PPPP2PP/RNBQKB1R b KQkq -
C30|King's Gambit Declined: Hobbs-Zilbermints Gambit|r1bqkbnr/pppp1p2/2n4p/4p1P1/4P3/5N2/PPPP2PP/RNBQKB1R w KQkq -
C30|King's Gambit Declined: Keene Defense|rnb1kbnr/ppppqppp/8/4p3/4PP2/6P1/PPPP3P/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Keene's Defense|rnb1kbnr/pppp1ppp/8/4p3/4PP1q/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Keene's Defense|rnb1kbnr/pppp1ppp/8/4p3/4PP1q/6P1/PPPP3P/RNBQKBNR b KQkq -
C30|King's Gambit Declined: Mafia Defense|rnbqkbnr/pp1p1ppp/8/2p1p3/4PP2/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Miles Defense|r1bqkbnr/pppp2pp/2n5/4pp2/4PP2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C30|King's Gambit Declined: Norwalde Variation|rnb1kbnr/pppp1ppp/5q2/4p3/4PP2/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Norwalde Variation, Schubert Variation|rnb1kbnr/pppp1ppp/8/4p3/3PPq2/2N5/PPP3PP/R1BQKBNR b KQkq -
C30|King's Gambit Declined: Panteldakis Countergambit|rnbqkbnr/pppp2pp/8/4pp2/4PP2/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Panteldakis Countergambit, Greco Variation|rnb1kbnr/pppp2pp/8/4pP2/5P1q/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Panteldakis Countergambit, Schiller's Defense|rnbqk1nr/pppp2pp/8/2b1pP2/5P2/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Panteldakis Countergambit, Shirazi Line|rnbq1bnr/ppppk1pp/8/5P1Q/5p2/8/PPPP2PP/RNB1KBNR w KQ -
C30|King's Gambit Declined: Petrov's Defense|rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Queen's Knight Defense|r1bqkbnr/pppp1ppp/2n5/4p3/4PP2/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Senechaud Countergambit|rnbqk1nr/pppp1p1p/8/2b1p1p1/4PP2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C30|King's Gambit Declined: Soller-Zilbermints Gambit|r1bqkbnr/pppp2pp/2n2p2/4P3/4P3/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Zilbermints Double Countergambit|rnbqkbnr/pppp1p1p/8/4p1p1/4PP2/8/PPPP2PP/RNBQKBNR w KQkq -
C30|King's Gambit Declined: Zilbermints Double Gambit|r1bqkbnr/pppp1p1p/2n5/4p1p1/4PP2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit|rnbqkbnr/ppp2ppp/8/3pp3/4PP2/8/PPPP2PP/RNBQKBNR w KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit Accepted|rnbqkbnr/ppp2ppp/8/3Pp3/5P2/8/PPPP2PP/RNBQKBNR b KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Anderssen Attack|rnbqkbnr/ppp2ppp/8/1B1P4/4pP2/8/PPPP2PP/RNBQK1NR b KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Blackburne Attack|rnbqkbnr/ppp2ppp/8/3pp3/4PP2/5N2/PPPP2PP/RNBQKB1R b KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Charousek Gambit|rnbqkbnr/ppp2ppp/8/3P4/4pP2/3P4/PPP3PP/RNBQKBNR b KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Hinrichsen Gambit|rnbqkbnr/ppp2ppp/8/3pp3/3PPP2/8/PPP3PP/RNBQKBNR b KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Miles Gambit|rnbqk1nr/ppp2ppp/8/2bPp3/5P2/8/PPPP2PP/RNBQKBNR w KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Milner-Barry Variation|rnbqkbnr/ppp2ppp/8/3pp3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Modern Transfer|rnbqkbnr/ppp2ppp/8/3P4/5p2/8/PPPP2PP/RNBQKBNR w KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Nimzowitsch-Marshall Countergambit|rnbqkbnr/pp3ppp/2p5/3Pp3/5P2/8/PPPP2PP/RNBQKBNR w KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Pickler Gambit|rnbqk1nr/pp3ppp/2P5/2b1p3/5P2/8/PPPP2PP/RNBQKBNR w KQkq -
C31|King's Gambit Declined: Falkbeer Countergambit, Staunton Line|rnbqkbnr/ppp2ppp/8/3P4/4pP2/8/PPPP2PP/RNBQKBNR w KQkq -
C31|Van Geet Opening: Grünfeld Defense, Steiner Gambit|rnbqkbnr/ppp2ppp/8/4p3/4NP2/8/PPPP2PP/R1BQKBNR b KQkq -
C33|King's Gambit Accepted|rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR w KQkq -
C33|King's Gambit Accepted: Basman Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPPQ1PP/RNB1KBNR b KQkq -
C33|King's Gambit Accepted: Bishop's Gambit|rnbqkbnr/pppp1ppp/8/8/2B1Pp2/8/PPPP2PP/RNBQK1NR b KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Anderssen Defense|rnbqkbnr/pppp1p1p/8/6p1/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Anderssen Variation|rnbqkbnr/pp3ppp/2p5/3B4/4Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Bledow Countergambit|rnbqkb1r/ppp2ppp/5n2/3B4/4Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Bledow Variation|rnbqkbnr/ppp2ppp/8/3p4/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Boden Variation|r1b1kbnr/pppp1ppp/2n5/8/2B1Pp1q/8/PPPP2PP/RNBQ1KNR w kq -
C33|King's Gambit Accepted: Bishop's Gambit, Bogoljubow Defense|rnbqkb1r/pp1p1ppp/2p2n2/8/2B1Pp2/2N5/PPPP2PP/R1BQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Bogoljubow Variation|rnbqkb1r/pppp1ppp/5n2/8/2B1Pp2/2N5/PPPP2PP/R1BQK1NR b KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Bryan Countergambit|rnb1kbnr/p1pp1ppp/8/1p6/2B1Pp1q/8/PPPP2PP/RNBQ1KNR w kq -
C33|King's Gambit Accepted: Bishop's Gambit, Cozio Defense|rnbqkb1r/pppp1ppp/5n2/8/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Cozio Variation|rnb1kbnr/ppp2ppp/3p4/8/2B1Pp1q/8/PPPP2PP/RNBQ1KNR w kq -
C33|King's Gambit Accepted: Bishop's Gambit, First Jaenisch Variation|rnb1kb1r/pppp1ppp/5n2/8/2B1Pp1q/8/PPPP2PP/RNBQ1KNR w kq -
C33|King's Gambit Accepted: Bishop's Gambit, Gianutio Gambit|rnbqkbnr/pppp2pp/8/5p2/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Greco Variation|rnb1k1nr/pppp1ppp/8/2b5/2B1Pp1q/8/PPPP2PP/RNBQ1KNR w kq -
C33|King's Gambit Accepted: Bishop's Gambit, Kieseritzky Gambit|rnbqkbnr/p1pp1ppp/8/1p6/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Lopez Defense|rnbqkbnr/pp1p1ppp/2p5/8/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Lopez Variation|rnb1kbnr/pppp1p1p/8/6p1/2B1Pp1q/8/PPPP2PP/RNBQ1KNR w kq -
C33|King's Gambit Accepted: Bishop's Gambit, Maurian Defense|r1bqkbnr/pppp1ppp/2n5/8/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Bishop's Gambit, Steinitz Defense|rnbqkb1r/ppppnppp/8/8/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Breyer Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/5Q2/PPPP2PP/RNB1KBNR b KQkq -
C33|King's Gambit Accepted: Carrera Gambit|rnbqkbnr/pppp1ppp/8/7Q/4Pp2/8/PPPP2PP/RNB1KBNR b KQkq -
C33|King's Gambit Accepted: Dodo Variation|rnbqkbnr/pppp1ppp/8/8/4PpQ1/8/PPPP2PP/RNB1KBNR b KQkq -
C33|King's Gambit Accepted: Eisenberg Variation|rnbqkbnr/pppp1ppp/8/8/4Pp2/7N/PPPP2PP/RNBQKB1R b KQkq -
C33|King's Gambit Accepted: Gaga Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/6P1/PPPP3P/RNBQKBNR b KQkq -
C33|King's Gambit Accepted: Mason-Keres Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/2N5/PPPP2PP/R1BQKBNR b KQkq -
C33|King's Gambit Accepted: Orsini Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/1P6/P1PP2PP/RNBQKBNR b KQkq -
C33|King's Gambit Accepted: Paris Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPPN1PP/RNBQKB1R b KQkq -
C33|King's Gambit Accepted: Schurig Gambit, with Bb5|rnbqkbnr/pppp1ppp/8/1B6/4Pp2/8/PPPP2PP/RNBQK1NR b KQkq -
C33|King's Gambit Accepted: Schurig Gambit, with Bd3|rnbqkbnr/pppp1ppp/8/8/4Pp2/3B4/PPPP2PP/RNBQK1NR b KQkq -
C33|King's Gambit Accepted: Stamma Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp1P/8/PPPP2P1/RNBQKBNR b KQkq -
C33|King's Gambit Accepted: Tartakower Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPPB1PP/RNBQK1NR b KQkq -
C33|King's Gambit Accepted: Tartakower Gambit, Weiss Defense|rnbqkbnr/ppp3pp/3p4/5P2/5p2/8/PPPPB1PP/RNBQK1NR w KQkq -
C33|King's Gambit Accepted: Tumbleweed|rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP1KPP/RNBQ1BNR b kq -
C33|King's Gambit Accepted: Villemson Gambit|rnbqkbnr/pppp1ppp/8/8/3PPp2/8/PPP3PP/RNBQKBNR b KQkq -
C34|King's Gambit Accepted: Becker Defense|rnbqkbnr/pppp1pp1/7p/8/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C34|King's Gambit Accepted: Bonsch-Osmolovsky Variation|rnbqkb1r/ppppnppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C34|King's Gambit Accepted: Fischer Defense|rnbqkbnr/ppp2ppp/3p4/8/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C34|King's Gambit Accepted: Fischer Defense, Schulder Gambit|rnbqkbnr/ppp2ppp/3p4/8/1P2Pp2/5N2/P1PP2PP/RNBQKB1R b KQkq -
C34|King's Gambit Accepted: Gianutio Countergambit|rnbqkbnr/pppp2pp/8/5p2/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C34|King's Gambit Accepted: Greco Gambit|rnbqk1nr/ppp2pb1/3p3p/6p1/2BPPp1P/5N2/PPP3P1/RNBQK2R w KQkq -
C34|King's Gambit Accepted: King's Knight's Gambit|rnbqkbnr/pppp1p1p/8/6p1/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C34|King's Gambit Accepted: King's Knight's Gambit|rnbqkbnr/pppp1ppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R b KQkq -
C34|King's Gambit Accepted: MacLeod Defense|r1bqkbnr/pppp1ppp/2n5/8/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C34|King's Gambit Accepted: Schallopp Defense|rnbqkb1r/pppp1ppp/5n2/8/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C34|King's Gambit Accepted: Wagenbach Defense|rnbqkbnr/pppp1pp1/8/7p/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C35|King's Gambit Accepted: Cunningham Defense|rnbqk1nr/ppppbppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C35|King's Gambit Accepted: Cunningham Defense, McCormick Defense|rnbqk2r/ppppbppp/5n2/8/2B1Pp2/5N2/PPPP2PP/RNBQK2R w KQkq -
C36|King's Gambit Accepted: Abbazia Defense|rnbqkb1r/ppp2ppp/5n2/3P4/5p2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C36|King's Gambit Accepted: Modern Defense|rnbqkbnr/ppp2ppp/8/3p4/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq -
C36|King's Gambit Accepted: Modern Defense|rnbqkbnr/ppp2ppp/8/3P4/5p2/5N2/PPPP2PP/RNBQKB1R b KQkq -
C37|King's Gambit Accepted: Australian Gambit|rnbqkbnr/pppp1p1p/8/8/2B1PppP/5N2/PPPP2P1/RNBQK2R b KQkq h3
C37|King's Gambit Accepted: Blachly Gambit|r1bqkbnr/pppp1p1p/2n5/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R w KQkq -
C37|King's Gambit Accepted: Double Muzio Gambit|rnb1kbnr/pppp1B1p/8/4q3/5p2/5Q2/PPPP2PP/RNB2RK1 b kq -
C37|King's Gambit Accepted: Ghulam-Kassim Gambit|rnbqkbnr/pppp1p1p/8/8/2BPPpp1/5N2/PPP3PP/RNBQK2R b KQkq -
C37|King's Gambit Accepted: Ghulam-Kassim Gambit|rnbqkbnr/pppp1p1p/8/8/2BPPp2/5Q2/PPP3PP/RNB1K2R b KQkq -
C37|King's Gambit Accepted: King's Knight's Gambit|rnbqkbnr/pppp1p1p/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R b KQkq -
C37|King's Gambit Accepted: Kotov Gambit|rnbqkbnr/pppp1p1p/8/8/2BPPB2/5p2/PPP3PP/RN1QK2R b KQkq -
C37|King's Gambit Accepted: Lolli Gambit|rnbqkbnr/pppp1B1p/8/8/4Ppp1/5N2/PPPP2PP/RNBQK2R b KQkq -
C37|King's Gambit Accepted: McDonnell Gambit|rnbqkbnr/pppp1p1p/8/8/2B1Ppp1/2N2N2/PPPP2PP/R1BQK2R b KQkq -
C37|King's Gambit Accepted: Middleton Countergambit|rn1qkbnr/ppp2p2/3p4/6p1/2B1Ppp1/5N2/PPPP2P1/RNBQ1RK1 w kq -
C37|King's Gambit Accepted: Quaade Gambit|rnbqkbnr/pppp1p1p/8/6p1/4Pp2/2N2N2/PPPP2PP/R1BQKB1R b KQkq -
C37|King's Gambit Accepted: Rosentreter Gambit|rnbqkbnr/pppp1p1p/8/6p1/3PPp2/5N2/PPP3PP/RNBQKB1R b KQkq -
C37|King's Gambit Accepted: Salvio Gambit|rnbqkbnr/pppp1p1p/8/4N3/2B1Ppp1/8/PPPP2PP/RNBQK2R b KQkq -
C37|King's Gambit Accepted: Silberschmidt Gambit|rnb1kb1r/pppp1p1p/7n/4N3/2BPP1pq/5p2/PPP3PP/RNBQ1K1R w kq -
C37|King's Gambit Accepted: Sörensen Gambit|rnbqkbnr/pppp1p1p/8/4N3/3PPpp1/8/PPP3PP/RNBQKB1R b KQkq -
C38|King's Gambit Accepted: Greco Gambit|rnbqk1nb/pp3p2/2pp4/4N1p1/2BPPp2/2N5/PPP3P1/R1BQK3 b Qq -
C38|King's Gambit Accepted: Hanstein Gambit|rnbqk1nr/pppp1pbp/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQ1RK1 b kq -
C38|King's Gambit Accepted: Mayet Gambit|rnbqk1nr/ppp2pbp/3p4/6p1/2BPPp2/2P2N2/PP4PP/RNBQK2R b KQkq -
C38|King's Gambit Accepted: Philidor Gambit|rnbqk1nr/pppp1pbp/8/6p1/2B1Pp1P/5N2/PPPP2P1/RNBQK2R b KQkq -
C38|King's Gambit Accepted: Traditional Variation|rnbqk1nr/pppp1pbp/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R w KQkq -
C39|King's Gambit Accepted: Allgaier Gambit|rnbqkbnr/pppp1p1p/8/6N1/4PppP/8/PPPP2P1/RNBQKB1R b KQkq -
C39|King's Gambit Accepted: Kieseritzky Gambit|rnbqkbnr/pppp1p1p/8/4N3/4PppP/8/PPPP2P1/RNBQKB1R b KQkq -
C39|King's Gambit Accepted: King's Knight's Gambit|rnbqkbnr/pppp1p1p/8/6p1/4Pp1P/5N2/PPPP2P1/RNBQKB1R b KQkq -
C40|Elephant Gambit|rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|Elephant Gambit: Maróczy Gambit|rnbqk1nr/ppp2ppp/3b4/3Pp3/8/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|Elephant Gambit: Paulsen Countergambit|rnbqkbnr/ppp2ppp/8/3P4/4p3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|Elephant Gambit: Wasp Variation|rnb1kbnr/ppp2ppp/8/4N1q1/2B1p3/8/PPPP1PPP/RNBQK2R w KQkq -
C40|Gunderam Defense|rnb1kbnr/ppppqppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|King's Knight Opening|rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -
C40|King's Pawn Game: Busch-Gass Gambit|rnbqk1nr/pppp1ppp/8/2b1p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|King's Pawn Game: Busch-Gass Gambit, Chiodini Gambit|r1bqk1nr/pppp1ppp/2n5/2b1N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq -
C40|King's Pawn Game: Damiano Defense|rnbqkbnr/pppp2pp/5p2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|King's Pawn Game: Damiano Defense, Damiano Gambit, Chigorin Gambit|rnb1kbnr/ppp1q1pp/5p2/3p4/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|King's Pawn Game: Gunderam Defense, Gunderam Gambit|rnb1kbnr/ppppq1pp/8/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C40|King's Pawn Game: Gunderam Gambit|rnbqkbnr/pp1p1ppp/2p5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|King's Pawn Game: La Bourdonnais Gambit|rnb1kbnr/pppp1ppp/6q1/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq -
C40|King's Pawn Game: McConnell Defense|rnb1kbnr/pppp1ppp/5q2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|Latvian Gambit|rnbqkbnr/pppp2pp/8/4pp2/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C40|Latvian Gambit Accepted|rnbqkbnr/pppp2pp/8/4pP2/8/5N2/PPPP1PPP/RNBQKB1R b KQkq -
C40|Latvian Gambit Accepted: Bilguer Variation|rnb1kbnr/ppp3pp/3p1q2/5p2/2NPP3/8/PPP2PPP/RNBQKB1R b KQkq -
C40|Latvian Gambit Accepted: Bronstein Attack|rnb1kbnr/ppp3pp/3p1q2/8/2NPp3/8/PPP1BPPP/RNBQK2R b KQkq -
C40|Latvian Gambit Accepted: Bronstein Gambit|rnb1kbnr/ppp4p/3p1qp1/8/2NPp3/8/PPP1QPPP/RNB1KB1R b KQkq -
C40|Latvian Gambit Accepted: Foltys Variation|rnb1kbnr/pppp2pp/5q2/8/2N1p3/3P4/PPP2PPP/RNBQKB1R b KQkq -
C40|Latvian Gambit Accepted: Foltys-Leonhardt Variation|rnb1kbnr/pppp2pp/5q2/5p2/2N1P3/8/PPPP1PPP/RNBQKB1R b KQkq -
C40|Latvian Gambit Accepted: Leonhardt Variation|rnb1kbnr/pppp2pp/5q2/8/2N1p3/2N5/PPPP1PPP/R1BQKB1R b KQkq -
C40|Latvian Gambit Accepted: Main Line|rnb1kbnr/pppp2pp/5q2/4Np2/3PP3/8/PPP2PPP/RNBQKB1R b KQkq -
C40|Latvian Gambit Accepted: Nimzowitsch Attack|rnb1kbnr/ppp3pp/3p1q2/8/3Pp3/4N3/PPP2PPP/RNBQKB1R b KQkq -
C40|Latvian Gambit: Behting Variation|rnb1kb1N/ppp3pp/5n2/3p4/2B1p3/8/PPPP1PqP/RNBQKR2 w Qq -
C40|Latvian Gambit: Corkscrew Countergambit|rnbqkb1r/pppp2pp/5n2/4N3/2B1p3/8/PPPP1PPP/RNBQK2R w KQkq -
C40|Latvian Gambit: Corkscrew Gambit|rnb1kb1N/ppp1q1pp/5n2/3p4/2B1p3/8/PPPP1PPP/RNBQK2R w KQq -
C40|Latvian Gambit: Diepstraten Countergambit|rnbqkbnr/pppp2pp/8/4pp2/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq -
C40|Latvian Gambit: Fraser Defense|r1bqkbnr/pppp2pp/2n5/4Np2/4P3/8/PPPP1PPP/RNBQKB1R w KQkq -
C40|Latvian Gambit: Greco Variation|rnb1kbnr/ppppq1pp/8/4Np2/4P3/8/PPPP1PPP/RNBQKB1R w KQkq -
C40|Latvian Gambit: Lobster Gambit|rnbqkbnr/pppp2pp/8/4pp2/4P1P1/5N2/PPPP1P1P/RNBQKB1R b KQkq -
C40|Latvian Gambit: Mason Countergambit|rnbqkbnr/pppp2pp/8/4pp2/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
C40|Latvian Gambit: Mayet Attack|rnbqkbnr/pppp2pp/8/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
C40|Latvian Gambit: Mayet Attack, Morgado Defense|rnbqkb1r/pppp2pp/5n2/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C40|Latvian Gambit: Mayet Attack, Polerio-Svedenborg Variation|rnbqkbnr/ppp3pp/8/3pN3/2B1p3/8/PPPP1PPP/RNBQK2R w KQkq -
C40|Latvian Gambit: Mayet Attack, Strautins Gambit|rnbqkbnr/p1pp2pp/8/1p2pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C40|Latvian Gambit: Mlotkowski Variation|rnbqkbnr/pppp2pp/8/4pp2/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq -
C40|Latvian Gambit: Senechaud Gambit|rnbqkbnr/pppp2pp/8/4pp2/1P2P3/5N2/P1PP1PPP/RNBQKB1R b KQkq -
C41|Philidor Defense|rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C41|Philidor Defense|rnbqkbnr/ppp2ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
C41|Philidor Defense|rnbqkbnr/ppp2ppp/3p4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
C41|Philidor Defense|rnbqk1nr/ppp1bppp/3p4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C41|Philidor Defense: Albin-Blackburne Gambit|r2qkbnr/pppn1ppp/3p4/4P3/4P1b1/5N2/PPP2PPP/RNBQKB1R w KQkq -
C41|Philidor Defense: Berger Variation|r2q1rk1/pp2bppp/2npbn2/2p3B1/4P3/2N2N2/PPP1BPPP/R2QR1K1 b - -
C41|Philidor Defense: Bird Gambit|rnbqkbnr/ppp2ppp/3p4/8/3pP3/2P2N2/PP3PPP/RNBQKB1R b KQkq -
C41|Philidor Defense: Boden Variation|rn1qkbnr/pppb1ppp/3p4/8/3QP3/5N2/PPP2PPP/RNB1KB1R w KQkq -
C41|Philidor Defense: Exchange Variation|rnbqkbnr/ppp2ppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C41|Philidor Defense: Exchange Variation|rnbqkbnr/ppp2ppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq -
C41|Philidor Defense: Exchange Variation|rnbqkb1r/ppp2ppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
C41|Philidor Defense: Hanham Variation|r1bqkbnr/pppn1ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C41|Philidor Defense: Hanham Variation, Sharp Variation|r1bqkbnr/ppp2ppp/1n1p4/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R w KQkq -
C41|Philidor Defense: Larsen Variation|rnbqkbnr/ppp2p1p/3p2p1/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
C41|Philidor Defense: Lion Variation|r1bqkb1r/pppn1ppp/3p1n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq -
C41|Philidor Defense: Lopez Countergambit|rnbqkbnr/ppp3pp/3p4/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C41|Philidor Defense: Morphy Gambit|rnbqkbnr/ppp2ppp/3p4/8/2BpP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C41|Philidor Defense: Nimzowitsch Variation|rnbqkb1r/ppp2ppp/3p1n2/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C41|Philidor Defense: Nimzowitsch Variation|rnbqkb1r/ppp2ppp/3p1n2/4P3/4P3/5N2/PPP2PPP/RNBQKB1R b KQkq -
C41|Philidor Defense: Nimzowitsch Variation, Klein Variation|rnbqkb1r/ppp2ppp/3p1n2/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C41|Philidor Defense: Nimzowitsch, Locock Variation|rnbqkb1r/ppp2ppp/3p1n2/4p1N1/3PP3/8/PPP2PPP/RNBQKB1R b KQkq -
C41|Philidor Defense: Paulsen Attack|rnbqkbnr/ppp2ppp/8/3P4/3N4/8/PPP2PPP/RNBQKB1R b KQkq -
C41|Philidor Defense: Philidor Countergambit|rnbqkbnr/ppp3pp/3p4/4pp2/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C41|Philidor Defense: Philidor Countergambit, Zukertort Variation|rnbqkbnr/ppp3pp/3p4/4pp2/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq -
C41|Philidor Defense: Philidor Gambit|rn1qkbnr/pppb1ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C41|Philidor Defense: Steinitz Variation|rnbqk1nr/ppp1bppp/3p4/4p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq -
C42|Petrov's Defense|rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C42|Petrov's Defense|rnbqkb1r/pppp1ppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq -
C42|Petrov's Defense|rnbqkb1r/ppp2ppp/3p1n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq -
C42|Petrov's Defense|rnbqkb1r/ppp2ppp/3p1n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -
C42|Petrov's Defense|rnbqkb1r/ppp2ppp/3p4/8/4n3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C42|Petrov's Defense: Classical Attack|rnbqkb1r/ppp2ppp/3p4/8/3Pn3/5N2/PPP2PPP/RNBQKB1R b KQkq -
C42|Petrov's Defense: Cochrane Gambit|rnbqkb1r/ppp2Npp/3p1n2/8/4P3/8/PPPP1PPP/RNBQKB1R b KQkq -
C42|Petrov's Defense: Cozio Attack|rnbqkb1r/ppp2ppp/3p4/8/4n3/5N2/PPPPQPPP/RNB1KB1R b KQkq -
C42|Petrov's Defense: Damiano Variation|rnbqkb1r/pppp1ppp/8/4N3/4n3/8/PPPP1PPP/RNBQKB1R w KQkq -
C42|Petrov's Defense: Damiano Variation, Kholmov Gambit|rnb1kb1r/ppppqppp/8/4N3/4n3/8/PPPPQPPP/RNB1KB1R w KQkq -
C42|Petrov's Defense: French Attack|rnbqkb1r/ppp2ppp/3p4/8/4n3/3P1N2/PPP2PPP/RNBQKB1R b KQkq -
C42|Petrov's Defense: Italian Variation|rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
C42|Petrov's Defense: Karklins-Martinovsky Variation|rnbqkb1r/ppp2ppp/3p1n2/8/4P3/3N4/PPPP1PPP/RNBQKB1R b KQkq -
C42|Petrov's Defense: Kaufmann Attack|rnbqkb1r/ppp2ppp/3p4/8/2P1n3/5N2/PP1P1PPP/RNBQKB1R b KQkq -
C42|Petrov's Defense: Millennium Attack|rnbqkb1r/ppp2ppp/3p4/8/4n3/3B1N2/PPPP1PPP/RNBQK2R b KQkq -
C42|Petrov's Defense: Moody Gambit|r1bqkb1r/pppp1ppp/2n2n2/4p3/3PP3/5N2/PPP1QPPP/RNB1KB1R b KQkq -
C42|Petrov's Defense: Nimzowitsch Attack|rnbqkb1r/ppp2ppp/3p4/8/4n3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq -
C42|Petrov's Defense: Paulsen Attack|rnbqkb1r/ppp2ppp/3p1n2/8/2N1P3/8/PPPP1PPP/RNBQKB1R b KQkq -
C42|Petrov's Defense: Stafford Gambit|r1bqkb1r/pppp1ppp/2n2n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq -
C42|Petrov's Defense: Stafford Gambit Accepted|r1bqkb1r/ppp2ppp/2p2n2/8/4P3/8/PPPP1PPP/RNBQKB1R w KQkq -
C42|Petrov's Defense: Stafford Gambit Accepted|r1bqk2r/ppp2ppp/2p2n2/2b5/4P3/2N5/PPPP1PPP/R1BQKB1R w KQkq -
C42|Petrov's Defense: Stafford Gambit Accepted|r1bqk2r/ppp2ppp/2p2n2/2b5/4P3/3P4/PPP2PPP/RNBQKB1R w KQkq -
C42|Petrov's Defense: Three Knights Game|rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq -
C43|Bishop's Opening: Urusov Gambit|rnbqkb1r/pppp1ppp/5n2/8/2BpP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C43|Petrov's Defense: Modern Attack|rnbqkb1r/pppp1ppp/5n2/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
C43|Petrov's Defense: Modern Attack|rnbqkb1r/pppp1ppp/5n2/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C43|Petrov's Defense: Modern Attack, Center Variation|rnbqkb1r/pppp1ppp/8/4p3/3Pn3/3B1N2/PPP2PPP/RNBQK2R b KQkq -
C43|Petrov's Defense: Modern Attack, Murrey Variation|r1bqkb1r/pppp1ppp/2n5/4p3/3Pn3/3B1N2/PPP2PPP/RNBQK2R w KQkq -
C43|Petrov's Defense: Modern Attack, Symmetrical Variation|rnbqkb1r/ppp2ppp/5n2/3pp3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C44|Dresden Opening: The Goblin|r1bqkb1r/pppp1ppp/2n2n2/4N3/2P1P3/8/PP1P1PPP/RNBQKB1R b KQkq -
C44|Irish Gambit|r1bqkbnr/pppp1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq -
C44|King's Knight Opening: Konstantinopolsky|r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5NP1/PPPP1P1P/RNBQKB1R b KQkq -
C44|King's Knight Opening: Normal Variation|r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -
C44|King's Pawn Game: Dresden Opening|r1bqkbnr/pppp1ppp/2n5/4p3/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq -
C44|King's Pawn Game: Pachman Wing Gambit|r1bqkbnr/pppp1ppp/2n5/4p3/1P2P3/5N2/P1PP1PPP/RNBQKB1R b KQkq -
C44|King's Pawn Game: Schulze-Müller Gambit|r1bqkbnr/pppp1ppp/8/4n3/3PP3/8/PPP2PPP/RNBQKB1R b KQkq -
C44|King's Pawn Game: Tayler Opening|r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPPBPPP/RNBQK2R b KQkq -
C44|King's Pawn Game: Tayler Opening|r1bqkb1r/pppp1ppp/2n2n2/4p3/3PP3/5N2/PPP1BPPP/RNBQK2R b KQkq -
C44|Latvian Gambit: Clam Gambit|r1bqkbnr/pppp2pp/2n5/4pP2/8/3P1N2/PPP2PPP/RNBQKB1R b KQkq -
C44|Ponziani Opening|r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq -
C44|Ponziani Opening: Caro Gambit|r2qkbnr/pppb1ppp/2n5/3pp3/Q3P3/2P2N2/PP1P1PPP/RNB1KB1R w KQkq -
C44|Ponziani Opening: Jaenisch Counterattack|r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -
C44|Ponziani Opening: Jaenisch Counterattack|r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2PP1N2/PP3PPP/RNBQKB1R b KQkq -
C44|Ponziani Opening: Jaenisch Counterattack|r1bqkb1r/ppp2ppp/2n2n2/3pp3/4P3/2PP1N2/PP3PPP/RNBQKB1R w KQkq -
C44|Ponziani Opening: Jaenisch Counterattack|r1bqkb1r/ppp2ppp/2n2n2/3pp3/4P3/2PP1N2/PP1N1PPP/R1BQKB1R b KQkq -
C44|Ponziani Opening: Leonhardt Variation|r1bqkb1r/ppp2ppp/2n2n2/3pp3/Q3P3/2P2N2/PP1P1PPP/RNB1KB1R w KQkq -
C44|Ponziani Opening: Neumann Gambit|r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq -
C44|Ponziani Opening: Ponziani Countergambit|r1bqkbnr/pppp2pp/2n5/4pp2/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -
C44|Ponziani Opening: Romanishin Variation|r1bqk1nr/ppppbppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -
C44|Ponziani Opening: Réti Variation|r1bqkb1r/ppppnppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -
C44|Ponziani Opening: Spanish Variation|r1bqkbnr/ppp2ppp/2n5/1B1pp3/4P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq -
C44|Ponziani Opening: Steinitz Variation|r1bqkbnr/ppp3pp/2n2p2/3pp3/Q3P3/2P2N2/PP1P1PPP/RNB1KB1R w KQkq -
C44|Ponziani Opening: Vukovic Gambit|r1bqk2r/pppp1ppp/2n5/2bPp3/4n3/2P2N2/PP3PPP/RNBQKB1R w KQkq -
C44|Scotch Game|r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq -
C44|Scotch Game|r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C44|Scotch Game: Benima Defense|r1bqk1nr/ppppbppp/2n5/8/2BpP3/5N2/PPP2PPP/RNBQK2R w KQkq -
C44|Scotch Game: Cochrane Variation|r1bqk1nr/pppp1ppp/2n5/b3P3/2B5/2P2N2/P4PPP/RNBQK2R b KQkq -
C44|Scotch Game: Cochrane-Shumov Defense|r1bq3r/ppp2k1p/2n3p1/2Qp4/3pP3/8/PPP2PPP/RNB1K2R w KQ -
C44|Scotch Game: Göring Gambit|r1bqkbnr/pppp1ppp/2n5/8/3pP3/2P2N2/PP3PPP/RNBQKB1R b KQkq -
C44|Scotch Game: Hanneken Variation|r1bq1rk1/pppp1ppp/5n2/4n1N1/1bB5/8/PB3PPP/RN1Q1RK1 w - -
C44|Scotch Game: Haxo Gambit|r1bqk1nr/pppp1ppp/2n5/2b5/2BpP3/5N2/PPP2PPP/RNBQK2R w KQkq -
C44|Scotch Game: Lolli Variation|r1bqkbnr/pppp1ppp/8/4p3/3nP3/5N2/PPP2PPP/RNBQKB1R w KQkq -
C44|Scotch Game: Lolli Variation|r1bqkbnr/pppp1ppp/8/8/3QP3/8/PPP2PPP/RNB1KB1R b KQkq -
C44|Scotch Game: Napoleon Gambit|r1bqkbnr/pppp1ppp/8/8/2BpP3/8/PPP2PPP/RNBQK2R b KQkq -
C44|Scotch Game: Relfsson Gambit|r1bqkbnr/pppp1ppp/2n5/1B6/3pP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C44|Scotch Game: Scotch Gambit|r1bqkbnr/pppp1ppp/2n5/8/2BpP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C44|Scotch Game: Scotch Gambit, Dubois Réti Defense|r1bqkb1r/pppp1ppp/2n2n2/8/2BpP3/5N2/PPP2PPP/RNBQK2R w KQkq -
C44|Scotch Game: Scotch Gambit, Göring Gambit Declined|r1bqkbnr/ppp2ppp/2n5/3p4/3pP3/2P2N2/PP3PPP/RNBQKB1R w KQkq -
C44|Scotch Game: Scotch Gambit, London Defense|r1bqk1nr/pppp1ppp/2n5/8/1bBpP3/5N2/PPP2PPP/RNBQK2R w KQkq -
C44|Scotch Game: Sea-Cadet Mate|r2q1bnr/ppp1kBpp/3p4/3NN3/4P3/8/PP3PPP/R1Bb1RK1 b - -
C44|Scotch Game: Vitzthum Attack|r1bqk2r/pppp1ppp/2n4n/2b3NQ/2BpP3/8/PPP2PPP/RNB1K2R b KQkq -
C45|Scotch Game|r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq -
C45|Scotch Game|r1b1k1nr/pppp1ppp/2n5/1N6/1b2P2q/8/PPPB1PPP/RN1QKB1R b KQkq -
C45|Scotch Game: Alekhine Gambit|r1bqkb1r/pppp1ppp/2n2n2/4P3/3N4/8/PPP2PPP/RNBQKB1R b KQkq -
C45|Scotch Game: Blumenfeld Attack|r1b1k1nr/pppp1ppp/2n2q2/1Nb5/4P3/4B3/PPP2PPP/RN1QKB1R b KQkq -
C45|Scotch Game: Braune Variation|r1b1kbnr/pppp1ppp/2n5/8/3NP2q/4B3/PPP2PPP/RN1QKB1R b KQkq -
C45|Scotch Game: Classical Variation|r1bqk1nr/pppp1ppp/2n5/2b5/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
C45|Scotch Game: Fraser Variation|r1b1kbnr/pppp1ppp/2n5/8/4P2q/5N2/PPP2PPP/RNBQKB1R b KQkq -
C45|Scotch Game: Ghulam-Kassim Variation|r1bqkbnr/ppp2ppp/3p4/8/3QP3/3B4/PPP2PPP/RNB1K2R b KQkq -
C45|Scotch Game: Gottschall Variation|1rb2rk1/pp3ppp/5q2/3P4/1n6/2P1Q3/PP3PPP/RN2KB1R w KQ -
C45|Scotch Game: Horwitz Attack|r1b1kbnr/pppp1ppp/2n5/1N6/4P2q/8/PPP2PPP/RNBQKB1R b KQkq -
C45|Scotch Game: Malaniuk Variation|r1bqk1nr/pppp1ppp/2n5/8/1b1NP3/8/PPP2PPP/RNBQKB1R w KQkq -
C45|Scotch Game: Meitner Variation|r1b1k2r/ppppnppp/2n2q2/2b5/4P3/2P1B3/PPN2PPP/RN1QKB1R b KQkq -
C45|Scotch Game: Mieses Variation|r1bqkb1r/p1pp1ppp/2p2n2/4P3/8/8/PPP2PPP/RNBQKB1R b KQkq -
C45|Scotch Game: Modern Defense|r1b1k1nr/pppp1ppp/2n5/8/1b1NP2q/2N5/PPP2PPP/R1BQKB1R w KQkq -
C45|Scotch Game: Paulsen Attack|r1b1k2r/ppppnppp/2n2q2/1Bb5/3NP3/2P1B3/PP3PPP/RN1QK2R b KQkq -
C45|Scotch Game: Paulsen Variation|r1b1kbnr/pppp1ppp/2n5/5N2/4P2q/8/PPP2PPP/RNBQKB1R b KQkq -
C45|Scotch Game: Potter Variation|r1bqk1nr/pppp1ppp/2n5/2b5/4P3/1N6/PPP2PPP/RNBQKB1R b KQkq -
C45|Scotch Game: Romanishin Variation|r1bqk1nr/pppp1ppp/2n5/8/1b2P3/1N6/PPP2PPP/RNBQKB1R w KQkq -
C45|Scotch Game: Rosenthal Variation|r1bk2nr/pppp1ppp/2n3q1/1N6/8/8/PPPNBPPP/R2Q1RK1 w - -
C45|Scotch Game: Schmidt Variation|r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -
C45|Scotch Game: Steinitz Variation|r1b1kbnr/pppp1ppp/2n5/8/3NP2q/8/PPP2PPP/RNBQKB1R w KQkq -
C45|Scotch Game: Steinitz Variation|r1b1kbnr/pppp1ppp/2n5/8/3NP2q/2N5/PPP2PPP/R1BQKB1R b KQkq -
C45|Scotch Game: Tartakower Variation|r1bqkb1r/p1pp1ppp/2p2n2/8/4P3/8/PPPN1PPP/R1BQKB1R b KQkq -
C46|Three Knights Opening|r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq -
C46|Three Knights Opening|r1bqk1nr/pppp1ppp/2n5/4p3/1b2P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq -
C46|Three Knights Opening: Schlechter Variation|r1bqk2r/pppp1ppp/2n2n2/3Np3/1b2P3/5N2/PPPP1PPP/R1BQKB1R w KQkq -
C46|Three Knights Opening: Steinitz Defense|r1bqkbnr/pppp1p1p/2n3p1/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq -
C46|Three Knights Opening: Steinitz-Rosenthal Variation|r1bqkbnr/pppp1p1p/2n3p1/3N4/3pP3/5N2/PPP2PPP/R1BQKB1R b KQkq -
C46|Three Knights Opening: Winawer Defense|r1bqkbnr/pppp2pp/2n5/4pp2/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq -
C47|Four Knights Game|r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq -
C47|Four Knights Game: Glek System|r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2NP1/PPPP1P1P/R1BQKB1R b KQkq -
C47|Four Knights Game: Glek System|r1bqkb1r/ppp2ppp/2n5/4p3/8/2P2NP1/P1PP1PBP/R1BQK2R b KQkq -
C47|Four Knights Game: Gunsberg Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/P1N2N2/1PPP1PPP/R1BQKB1R b KQkq -
C47|Four Knights Game: Halloween Gambit|r1bqkb1r/pppp1ppp/2n2n2/4N3/4P3/2N5/PPPP1PPP/R1BQKB1R b KQkq -
C47|Four Knights Game: Italian Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq -
C47|Four Knights Game: Naroditsky Variation|r1bqkb1r/pppp1ppp/2n2n2/3Np3/4P3/5N2/PPPP1PPP/R1BQKB1R b KQkq -
C47|Four Knights Game: Scotch Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq -
C47|Four Knights Game: Scotch Variation Accepted|r1bqkb1r/pppp1ppp/2n2n2/8/3pP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq -
C48|Four Knights Game: Spanish Variation|r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq -
C48|Four Knights Game: Spanish Variation, Classical Variation|r1bqk2r/pppp1ppp/2n2n2/1Bb1p3/4P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq -
C48|Four Knights Game: Spanish Variation, Rubinstein Variation|r1bqkb1r/pppp1ppp/5n2/1B2p3/3nP3/2N2N2/PPPP1PPP/R1BQK2R w KQkq -
C49|Four Knights Game: Spanish Variation|r1bq1rk1/pppp1ppp/2n2n2/1B2p3/4P3/2bP1N2/PPP2PPP/R1BQ1RK1 w - -
C49|Four Knights Game: Spanish Variation, Double Spanish|r1bqk2r/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq -
C50|Four Knights Game: Italian Variation|r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq -
C50|Italian Game|r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
C50|Italian Game: Anti-Fried Liver Defense|r1bqkbnr/pppp1pp1/2n4p/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C50|Italian Game: Blackburne-Kostić Gambit|r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C50|Italian Game: Deutz Gambit|r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/5N2/PPP2PPP/RNBQ1RK1 b kq -
C50|Italian Game: Giuoco Pianissimo|r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq -
C50|Italian Game: Giuoco Pianissimo|r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b kq -
C50|Italian Game: Giuoco Pianissimo|r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - -
C50|Italian Game: Giuoco Pianissimo|r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b - -
C50|Italian Game: Giuoco Pianissimo, Lucchini Gambit|r1bqk1nr/pppp2pp/2n5/2b1pp2/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq -
C50|Italian Game: Giuoco Pianissimo, Normal|r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq -
C50|Italian Game: Giuoco Piano|r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C50|Italian Game: Hungarian Defense|r1bqk1nr/ppppbppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C50|Italian Game: Jerome Gambit|r1bqk1nr/pppp1Bpp/2n5/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
C50|Italian Game: Paris Defense|r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C50|Italian Game: Rosentreter Gambit|r1bqk1nr/pppp1ppp/2n5/2b1p3/2BPP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C50|Italian Game: Rousseau Gambit|r1bqkbnr/pppp2pp/2n5/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C51|Italian Game: Evans Gambit|r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq -
C51|Italian Game: Evans Gambit|r2qk1nr/ppp2ppp/1bnp4/8/2BPP1b1/2N2N2/P4PPP/R1BQ1RK1 w kq -
C51|Italian Game: Evans Gambit Accepted|r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq -
C51|Italian Game: Evans Gambit Declined|r1bqk1nr/pppp1ppp/1bn5/4p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq -
C51|Italian Game: Evans Gambit Declined|r1bqk1nr/pppp1ppp/1bn5/4p3/PPB1P3/5N2/2PP1PPP/RNBQK2R b KQkq -
C51|Italian Game: Evans Gambit, Fontaine Countergambit|r1bqk1nr/p1pp1ppp/2n5/1pb1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq -
C51|Italian Game: Evans Gambit, Hein Countergambit|r1bqk1nr/ppp2ppp/2n5/2bpp3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq -
C52|Italian Game: Evans Gambit|r1bqk1nr/ppp2ppp/2np4/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQ1RK1 w kq -
C53|Italian Game: Bird's Attack|r1bqk2r/pppp1ppp/2n2n2/2b1p3/1PB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq -
C53|Italian Game: Classical Variation|r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq -
C53|Italian Game: Classical Variation, Closed Variation|r1b1k1nr/ppppqppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq -
C54|Italian Game: Classical Variation|r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq -
C55|Italian Game: Two Knights Defense|r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C55|Italian Game: Two Knights Defense|r1bqk2r/ppp2ppp/3p1n2/4p1B1/2BnP3/8/PPP2PPP/RN1Q1RK1 w kq -
C55|Italian Game: Two Knights Defense|r1bqkb1r/ppp2ppp/2n5/3pp3/2B1N3/5N2/PPPP1PPP/R1BQK2R w KQkq -
C55|Italian Game: Two Knights Defense, Modern Bishop's Opening|r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq -
C55|Italian Game: Two Knights Defense, Modern Bishop's Opening|r1bqk2r/ppppbppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq -
C56|Italian Game: Scotch Gambit|r1bqkb1r/pppp1ppp/2n2n2/8/2BpP3/5N2/PPP2PPP/RNBQ1RK1 b kq -
C56|Italian Game: Scotch Invitation Declined|r1bqkb1r/ppp2ppp/2np1n2/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R w KQkq -
C56|Italian Game: Two Knights Defense, Open Variation|r1bqkb1r/pppp1ppp/2n2n2/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C57|Italian Game: Two Knights Defense, Knight Attack|r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq -
C57|Italian Game: Two Knights Defense, Knight Attack, Normal Variation|r1bqkb1r/ppp2ppp/2n2n2/3pp1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq -
C57|Italian Game: Two Knights Defense, Ponziani-Steinitz Gambit|r1bqkb1r/pppp1ppp/2n5/4p1N1/2B1n3/8/PPPP1PPP/RNBQK2R w KQkq -
C57|Italian Game: Two Knights Defense, Traxler Counterattack|r1bqk2r/pppp1ppp/2n2n2/2b1p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq -
C58|Italian Game: Two Knights Defense|r1bqkb1r/p4ppp/2p2n2/n3p1N1/8/8/PPPPBPPP/RNBQK2R b KQkq -
C60|Ruy Lopez|r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
C60|Ruy Lopez: Alapin Defense|r1bqk1nr/pppp1ppp/2n5/1B2p3/1b2P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Brentano Gambit|r1bqkbnr/pppp1p1p/2n5/1B2p1p1/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Bulgarian Variation|r1bqkbnr/1ppp1ppp/2n5/pB2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Cozio Defense|r1bqkb1r/ppppnppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Cozio Defense, Paulsen Variation|r1bqkb1r/ppppnp1p/2n3p1/1B2p3/4P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq -
C60|Ruy Lopez: Fianchetto Defense|r1bqkbnr/pppp1p1p/2n3p1/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Fianchetto Defense, Kevitz Gambit|r1bqkbnr/pppp3p/2n3p1/1B2pp2/4P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Lucena Variation|r1bqk1nr/ppppbppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Nürnberg Variation|r1bqkbnr/pppp2pp/2n2p2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Pollock Defense|r1bqkbnr/pppp1ppp/8/nB2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Retreat Variation|rnbqkbnr/pppp1ppp/8/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Rotary-Albany Gambit|r1bqkbnr/p1pp1ppp/1pn5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Spanish Countergambit|r1bqkbnr/ppp2ppp/2n5/1B1pp3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C60|Ruy Lopez: Vinogradov Variation|r1b1kbnr/ppppqppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C61|Ruy Lopez: Bird Variation|r1bqkbnr/pppp1ppp/8/1B2p3/3nP3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C62|Ruy Lopez: Steinitz Defense|r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C62|Ruy Lopez: Steinitz Defense|r1bqkbnr/ppp2ppp/2np4/1B2p3/3PP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C63|Ruy Lopez: Schliemann Defense|r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C63|Ruy Lopez: Schliemann Defense, Dyckhoff Variation|r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq -
C63|Ruy Lopez: Schliemann Defense, Exchange Variation|r1bqkbnr/pppp2pp/2B5/4pp2/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
C63|Ruy Lopez: Schliemann Defense, Jaenisch Gambit Accepted|r1bqkbnr/pppp2pp/2n5/1B2pP2/8/5N2/PPPP1PPP/RNBQK2R b KQkq -
C63|Ruy Lopez: Schliemann Defense, Schönemann Attack|r1bqkbnr/pppp2pp/2n5/1B2pp2/3PP3/5N2/PPP2PPP/RNBQK2R b KQkq -
C64|Ruy Lopez: Classical Defense, Boden Variation|r1b1k1nr/ppppqppp/2n5/1Bb1p3/4P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq -
C64|Ruy Lopez: Classical Variation|r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C64|Ruy Lopez: Classical Variation, Central Variation|r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq -
C64|Ruy Lopez: Classical Variation, Charousek Variation|r1bqk1nr/pppp1ppp/1bn5/1B2p3/4P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq -
C64|Ruy Lopez: Classical Variation, Cordel Gambit|r1bqk1nr/pppp2pp/2n5/1Bb1pp2/4P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq -
C64|Ruy Lopez: Classical Variation, Konikowski Gambit|r1bqk1nr/ppp2ppp/2n5/1Bbpp3/4P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq -
C64|Ruy Lopez: Classical Variation, Spanish Wing Gambit|r1bqk1nr/pppp1ppp/2n5/1Bb1p3/1P2P3/5N2/P1PP1PPP/RNBQK2R b KQkq -
C65|Ruy Lopez: Berlin Defense|r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C65|Ruy Lopez: Berlin Defense|r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq -
C65|Ruy Lopez: Berlin Defense, Anti-Berlin Variation|r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/3P1N2/PPP2PPP/RNBQK2R b KQkq -
C65|Ruy Lopez: Berlin Defense, Anti-Berlin Variation, Mortimer Variation|r1bqkb1r/ppppnppp/5n2/1B2p3/4P3/3P1N2/PPP2PPP/RNBQK2R w KQkq -
C65|Ruy Lopez: Berlin Defense, Beverwijk Variation|r1bqk2r/pppp1ppp/2n2n2/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 w kq -
C65|Ruy Lopez: Berlin Defense, Fishing Pole Variation|r1bqkb1r/pppp1ppp/2n5/1B2p3/4P1n1/5N2/PPPP1PPP/RNBQ1RK1 w kq -
C65|Ruy Lopez: Halloween Attack|r1bqkb1r/pppp1ppp/2n2n2/1B2N3/4P3/8/PPPP1PPP/RNBQK2R b KQkq -
C66|Ruy Lopez: Berlin Defense, Improved Steinitz Defense|r1bqkb1r/ppp2ppp/2np1n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 w kq -
C67|Ruy Lopez: Berlin Defense, Rio Gambit Accepted|r1bqkb1r/pppp1ppp/2n5/1B2p3/4n3/5N2/PPPP1PPP/RNBQ1RK1 w kq -
C68|Ruy Lopez: Exchange Variation|r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -
C68|Ruy Lopez: Exchange Variation, Lutikov Variation|r1bqkbnr/2pp1ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C70|Ruy Lopez: Bird's Defense Deferred|r1bqkbnr/1ppp1ppp/p7/4p3/B2nP3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C70|Ruy Lopez: Morphy Defense|r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C70|Ruy Lopez: Morphy Defense, Alapin's Defense Deferred|r1bqk1nr/1ppp1ppp/p1n5/4p3/Bb2P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C70|Ruy Lopez: Morphy Defense, Caro Variation|r1bqkbnr/2pp1ppp/p1n5/1p2p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C70|Ruy Lopez: Morphy Defense, Classical Defense Deferred|r1bqk1nr/1ppp1ppp/p1n5/2b1p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C70|Ruy Lopez: Morphy Defense, Cozio Defense|r1bqkb1r/1pppnppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C70|Ruy Lopez: Morphy Defense, Fianchetto Defense Deferred|r1bqkbnr/1ppp1p1p/p1n3p1/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C70|Ruy Lopez: Morphy Defense, Schliemann Defense Deferred|r1bqkbnr/1ppp2pp/p1n5/4pp2/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C71|Ruy Lopez: Morphy Defense, Modern Steinitz Defense|r1bqkbnr/1pp2ppp/p1np4/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq -
C71|Ruy Lopez: Noah's Ark Trap|r1bqkbnr/5ppp/p2p4/1pp5/3QP3/1B6/PPP2PPP/RNB1K2R w KQkq -
C78|Ruy Lopez: Brix Variation|r1bqkb1r/1ppp1p1p/p1n2np1/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq -
C78|Ruy Lopez: Central Countergambit|r1bqkb1r/1pp2ppp/p1n2n2/3pp3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq -
C78|Ruy Lopez: Morphy Defense|r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq -
C78|Ruy Lopez: Morphy Defense|r1bqkb1r/2p2ppp/p1np1n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQ1RK1 w kq -
C78|Ruy Lopez: Rabinovich Variation|r1bq1k1r/2p2ppp/p4n2/1pbPR1N1/3n4/1B6/PPPP1PPP/RNBQ2K1 w - -
C80|Ruy Lopez: Open|r1bqkb1r/1ppp1ppp/p1n5/4p3/B3n3/5N2/PPPP1PPP/RNBQ1RK1 w kq -
C80|Ruy Lopez: Open|r1bqkb1r/1ppp1ppp/p1n5/4p3/B2Pn3/5N2/PPP2PPP/RNBQ1RK1 b kq -
C80|Ruy Lopez: Open|r1bqkb1r/2pp1ppp/p1n5/1p2p3/3Pn3/1B3N2/PPP2PPP/RNBQ1RK1 b kq -
C80|Ruy Lopez: Open|r1bqkb1r/2p2ppp/p1n5/1p1pP3/4n3/1B3N2/PPP2PPP/RNBQ1RK1 b kq -
C82|Ruy Lopez: Open|r2qkb1r/2p2ppp/p1n1b3/1p1pP3/4n3/1BP2N2/PP3PPP/RNBQ1RK1 b kq -
C84|Ruy Lopez: Closed|r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq -
C88|Ruy Lopez: Closed|r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq -
C88|Ruy Lopez: Closed|r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w - -
C88|Ruy Lopez: Noah's Ark Trap|r1bqk2r/4bppp/p2p1n2/1pp5/3QP3/1B6/PPP2PPP/RNB1R1K1 w kq -
C89|Ruy Lopez: Marshall Attack|r1bq1rk1/2p1bppp/p1n2n2/1p1pp3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - -
C89|Ruy Lopez: Marshall Attack|r2q1rk1/1bp1bppp/p1n5/1p1np3/P7/1BP2N2/1P1P1PPP/RNBQR1K1 w - -
C90|Ruy Lopez: Closed|r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - -
C92|Ruy Lopez: Closed|r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1 b - -
D00|Amazon Attack|rnbqkbnr/ppp1pppp/8/3p4/3P4/3Q4/PPP1PPPP/RNB1KBNR b KQkq -
D00|Blackmar-Diemer Gambit|rnbqkbnr/ppp1pppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -
D00|Blackmar-Diemer Gambit|rnbqkb1r/ppp1pppp/5n2/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Accepted|rnbqkb1r/ppp1pppp/5n2/8/3P4/2N2p2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Bogoljubow Defense|rnbqkb1r/ppp1pp1p/5np1/8/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Euwe Defense|rnbqkb1r/ppp2ppp/4pn2/8/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Gunderam Defense|rn1qkb1r/ppp1pppp/5n2/5b2/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Holwell Defense|rnb1kb1r/ppp1pppp/3q1n2/8/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Kaulich Defense|rnbqkb1r/pp2pppp/5n2/2p5/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Pietrowsky Defense|r1bqkb1r/ppp1pppp/2n2n2/8/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Ritter Defense|rnbqkb1r/p1p1pppp/1p3n2/8/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Ryder Gambit|rnbqkb1r/ppp1pppp/5n2/8/3P4/2N2Q2/PPP3PP/R1B1KBNR b KQkq -
D00|Blackmar-Diemer Gambit Accepted: Schlutter Defense|r1bqkb1r/pppnpppp/5n2/8/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Teichmann Defense|rn1qkb1r/ppp1pppp/5n2/8/3P2b1/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Accepted: Ziegler Defense|rnbqkb1r/pp2pppp/2p2n2/8/3P4/2N2N2/PPP3PP/R1BQKB1R w KQkq -
D00|Blackmar-Diemer Gambit Declined: Brombacher Countergambit|rnbqkb1r/pp2pppp/5n2/2p5/3Pp3/2N2P2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Declined: Elbert Countergambit|rnbqkb1r/ppp2ppp/5n2/4p3/3Pp3/2N2P2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Declined: Gedult Defense|rnbqkb1r/1pp1pppp/p4n2/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Declined: Lamb Defense|r1bqkb1r/ppp1pppp/2n2n2/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Declined: Langeheinicke Defense|rnbqkb1r/ppp1pppp/5n2/8/3P4/2N1pP2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Declined: O'Kelly Defense|rnbqkb1r/pp2pppp/2p2n2/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Declined: Vienna Defense|rn1qkb1r/ppp1pppp/5n2/5b2/3Pp3/2N2P2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit Declined: Weinsbach Defense|rnbqkb1r/ppp2ppp/4pn2/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit: Blackmar Gambit|rnbqkbnr/ppp1pppp/8/8/3Pp3/5P2/PPP3PP/RNBQKBNR b KQkq -
D00|Blackmar-Diemer Gambit: Diemer-Rosenberg Attack|rnbqkbnr/ppp1pppp/8/8/3Pp3/4B3/PPP2PPP/RN1QKBNR b KQkq -
D00|Blackmar-Diemer Gambit: Fritz Attack|rnbqkbnr/ppp1pppp/8/8/2BPp3/8/PPP2PPP/RNBQK1NR b KQkq -
D00|Blackmar-Diemer Gambit: Lemberger Countergambit|rnbqkbnr/ppp2ppp/8/4p3/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit: Lemberger Countergambit, Endgame Variation|rnbqkbnr/ppp2ppp/8/4P3/4p3/2N5/PPP2PPP/R1BQKBNR b KQkq -
D00|Blackmar-Diemer Gambit: Lemberger Countergambit, Lange Gambit|rnbqkbnr/ppp2ppp/8/4p3/3PN3/8/PPP2PPP/R1BQKBNR b KQkq -
D00|Blackmar-Diemer Gambit: Lemberger Countergambit, Rasmussen Attack|rnbqkbnr/ppp2ppp/8/4p3/3Pp3/2N5/PPP1NPPP/R1BQKB1R b KQkq -
D00|Blackmar-Diemer Gambit: Lemberger Countergambit, Sneiders Attack|rnbqkbnr/ppp2ppp/8/4p2Q/3Pp3/2N5/PPP2PPP/R1B1KBNR b KQkq -
D00|Blackmar-Diemer Gambit: Lemberger Countergambit, Soller Attack|rnbqkbnr/ppp2ppp/8/4p3/3Pp3/2N1B3/PPP2PPP/R2QKBNR b KQkq -
D00|Blackmar-Diemer Gambit: Netherlands Variation|rnbqkbnr/ppp1p1pp/8/5p2/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit: Rasa-Studier Gambit|rnbqkb1r/ppp1pppp/5n2/8/3Pp3/2N1B3/PPP2PPP/R2QKBNR b KQkq -
D00|Blackmar-Diemer Gambit: Reversed Albin Countergambit|rnbqkbnr/pp2pppp/8/2p5/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit: Zeller Defense|rn1qkbnr/ppp1pppp/8/5b2/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -
D00|Blackmar-Diemer Gambit: von Popiel Gambit|rnbqkb1r/ppp1pppp/5n2/6B1/3Pp3/2N5/PPP2PPP/R2QKBNR b KQkq -
D00|Queen's Pawn Game|rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -
D00|Queen's Pawn Game|rnbqkbnr/ppp1pppp/8/3p4/3P4/4P3/PPP2PPP/RNBQKBNR b KQkq -
D00|Queen's Pawn Game|rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4P3/PPP2PPP/RNBQKBNR w KQkq -
D00|Queen's Pawn Game: Accelerated London System|rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq -
D00|Queen's Pawn Game: Accelerated London System, Steinitz Countergambit|rnbqkbnr/pp2pppp/8/2pp4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq -
D00|Queen's Pawn Game: Accelerated London System, Steinitz Countergambit Accepted|rnbqkbnr/pp2pppp/8/2Pp4/5B2/8/PPP1PPPP/RN1QKBNR b KQkq -
D00|Queen's Pawn Game: Accelerated London System, Steinitz Countergambit, Morris Countergambit|rnbqkbnr/pp2pppp/8/2pp4/3PPB2/8/PPP2PPP/RN1QKBNR b KQkq -
D00|Queen's Pawn Game: Accelerated London System, Steinitz Countergambit, Morris Countergambit Accepted|rnbqkbnr/pp2pppp/8/2p5/3PpB2/8/PPP2PPP/RN1QKBNR w KQkq -
D00|Queen's Pawn Game: Chigorin Variation|rnbqkbnr/ppp1pppp/8/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR b KQkq -
D00|Queen's Pawn Game: Chigorin Variation|rnbqkbnr/ppp2ppp/4p3/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
D00|Queen's Pawn Game: Chigorin Variation, Alburt Defense|rn1qkbnr/ppp1pppp/8/3p1b2/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
D00|Queen's Pawn Game: Chigorin Variation, Anti-Veresov|rn1qkbnr/ppp1pppp/8/3p4/3P2b1/2N5/PPP1PPPP/R1BQKBNR w KQkq -
D00|Queen's Pawn Game: Chigorin Variation, Fianchetto Defense|rnbqk1nr/ppp1ppbp/6p1/3p4/3P4/2N2N2/PPP1PPPP/R1BQKB1R w KQkq -
D00|Queen's Pawn Game: Chigorin Variation, Irish Gambit|rnbqkbnr/pp2pppp/8/2pp4/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
D00|Queen's Pawn Game: Chigorin Variation, Shaviliuk Gambit|rnbqkbnr/ppp2ppp/8/3pp3/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
D00|Queen's Pawn Game: Chigorin Variation, Shropshire Defense|rnbqkbnr/ppp1ppp1/8/3p3p/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq -
D00|Queen's Pawn Game: Hübsch Gambit|rnbqkb1r/ppp1pppp/5n2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq -
D00|Queen's Pawn Game: Levitsky Attack|rnbqkbnr/ppp1pppp/8/3p2B1/3P4/8/PPP1PPPP/RN1QKBNR b KQkq -
D00|Queen's Pawn Game: Levitsky Attack, Welling Variation|rn1qkbnr/ppp1pppp/8/3p2B1/3P2b1/8/PPP1PPPP/RN1QKBNR w KQkq -
D00|Queen's Pawn Game: Mason Attack|rnbqkbnr/ppp1pppp/8/3p4/3P1P2/8/PPP1P1PP/RNBQKBNR b KQkq -
D00|Queen's Pawn Game: Stonewall Attack|rnbqkb1r/ppp1pppp/5n2/3p4/3P4/3BP3/PPP2PPP/RNBQK1NR b KQkq -
D00|Queen's Pawn Game: Zurich Gambit|rnbqkbnr/ppp1pppp/8/3p4/3P2P1/8/PPP1PP1P/RNBQKBNR b KQkq -
D01|Rapport-Jobava System|rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR b KQkq -
D01|Rapport-Jobava System|rnbqkb1r/ppp2ppp/4pn2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq -
D01|Rapport-Jobava System|rnbqkb1r/ppp1pp1p/5np1/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq -
D01|Rapport-Jobava System, with e6|rnbqkbnr/ppp2ppp/4p3/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR b KQkq -
D01|Richter-Veresov Attack|rnbqkb1r/ppp1pppp/5n2/3p2B1/3P4/2N5/PPP1PPPP/R2QKBNR b KQkq -
D01|Richter-Veresov Attack|rn1qkb1r/ppp1pppp/5n2/3p1bB1/3P4/2N5/PPP1PPPP/R2QKBNR w KQkq -
D01|Richter-Veresov Attack: Boyce Defense|rnbqkb1r/ppp1pppp/8/3p2B1/3Pn3/2N5/PPP1PPPP/R2QKBNR w KQkq -
D01|Richter-Veresov Attack: Malich Gambit|rnbqkb1r/pp2pp1p/5p2/2pP4/4p3/2N5/PPP2PPP/R2QKBNR b KQkq -
D01|Richter-Veresov Attack: Richter Variation|rn1qkb1r/ppp1pppp/5n2/3p1bB1/3P4/2N2P2/PPP1P1PP/R2QKBNR b KQkq -
D01|Richter-Veresov Attack: Two Knights System|r1bqkb1r/pppnpppp/5n2/3p2B1/3P4/2N2N2/PPP1PPPP/R2QKB1R b KQkq -
D01|Richter-Veresov Attack: Two Knights System, Grünfeld Defense|r1bqkb1r/pppnpp1p/5np1/3p2B1/3P4/2N2N2/PPP1PPPP/R2QKB1R w KQkq -
D01|Richter-Veresov Attack: Veresov Variation|rn1qkb1r/ppp1pppp/5B2/3p1b2/3P4/2N5/PPP1PPPP/R2QKBNR b KQkq -
D02|London System: Poisoned Pawn Variation|rnb1kb1r/pp2pppp/1q3n2/2pp4/3P1B2/2N1PN2/PPP2PPP/R2QKB1R b KQkq -
D02|Queen's Gambit Declined: Baltic Defense, Pseudo-Slav|rn1qkbnr/pp3ppp/2p1p3/3p1b2/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D02|Queen's Pawn Game: Anti-Torre|rn1qkbnr/ppp1pppp/8/3p4/3P2b1/5N2/PPP1PPPP/RNBQKB1R w KQkq -
D02|Queen's Pawn Game: Chandler Gambit|rnbqkbnr/pp2pppp/8/3p4/3p4/5NP1/PPP1PPBP/RNBQK2R b KQkq -
D02|Queen's Pawn Game: Chigorin Variation|r1bqkbnr/ppp1pppp/2n5/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
D02|Queen's Pawn Game: Krause Variation|rnbqkbnr/pp2pppp/8/2pp4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
D02|Queen's Pawn Game: Levitsky Attack, Euwe Variation, Modern Line|rnb1kbnr/pp2ppp1/1qp4p/3p4/3P3B/5N2/PPP1PPPP/RN1QKB1R w KQkq -
D02|Queen's Pawn Game: London System|rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq -
D02|Queen's Pawn Game: London System|rnbqkb1r/pp2pppp/5n2/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq -
D02|Queen's Pawn Game: London System|r1bqkb1r/pp2pppp/2n2n2/2pp4/3P1B2/4PN2/PPPN1PPP/R2QKB1R b KQkq -
D02|Queen's Pawn Game: London System|r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P1B2/2P1PN2/PP1N1PPP/R2QKB1R b KQkq -
D02|Queen's Pawn Game: London System, with e6|rnbqkbnr/ppp2ppp/4p3/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq -
D02|Queen's Pawn Game: London System, with e6|rnbqkb1r/ppp2ppp/4pn2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R w KQkq -
D02|Queen's Pawn Game: Symmetrical Variation|rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq -
D02|Queen's Pawn Game: Symmetrical Variation, Pseudo-Catalan|rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5NP1/PPP1PP1P/RNBQKB1R b KQkq -
D02|Queen's Pawn Game: Symmetrical Variation, Pseudo-Catalan|rn1qkb1r/pp2pppp/2p2n2/3p4/3P2b1/5NP1/PPP1PPBP/RNBQK2R w KQkq -
D02|Queen's Pawn Game: Zilbermints Countergambit|rnbqkb1r/p1p1pppp/5n2/1p1p4/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D02|Queen's Pawn Game: Zukertort Variation|rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq -
D03|Queen's Pawn Game: Torre Attack|rnbqkb1r/ppp1pppp/5n2/3p2B1/3P4/5N2/PPP1PPPP/RN1QKB1R b KQkq -
D03|Queen's Pawn Game: Torre Attack|rnbqkb1r/pp3ppp/4pn2/2pp2B1/3P4/4PN2/PPPN1PPP/R2QKB1R b KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqkb1r/pp3ppp/2n1pn2/2pp2B1/3P4/2P1PN2/PP1N1PPP/R2QKB1R b KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqkb1r/pp1n1ppp/4pn2/2pp2B1/3P4/2P1PN2/PP3PPP/RN1QKB1R w KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqkb1r/pp1n1ppp/4pn2/2pp2B1/3P4/2P1PN2/PP1N1PPP/R2QKB1R b KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqk2r/pp1n1ppp/3bpn2/2pp2B1/3P4/2P1PN2/PP1N1PPP/R2QKB1R w KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqk2r/pp1nbppp/4pn2/2pp2B1/3P4/2P1PN2/PP1N1PPP/R2QKB1R w KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqkb1r/pp3ppp/2n1pn2/2pp2B1/3P4/2P1PN2/PP3PPP/RN1QKB1R w KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqkb1r/pp3ppp/2n1pn2/2pp2B1/3P4/2PBPN2/PP3PPP/RN1QK2R b KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqkb1r/pppn1ppp/4pn2/3p2B1/3P4/3BPN2/PPP2PPP/RN1QK2R b KQkq -
D03|Queen's Pawn Game: Torre Attack|r1bqk2r/pppnbppp/4pn2/3p2B1/3P4/2P1PN2/PP1N1PPP/R2QKB1R b KQkq -
D03|Queen's Pawn Game: Torre Attack, Gossip Variation|rnbqkb1r/ppp1pppp/8/3p2B1/3Pn3/5N2/PPP1PPPP/RN1QKB1R w KQkq -
D03|Queen's Pawn Game: Torre Attack, Grünfeld Variation|rnbqkb1r/ppp1pp1p/5np1/3p2B1/3P4/5N2/PPP1PPPP/RN1QKB1R w KQkq -
D03|Queen's Pawn Game: Torre Attack, Grünfeld Variation|rnbqkb1r/ppp1pp1p/5np1/3p2B1/3P4/4PN2/PPP2PPP/RN1QKB1R b KQkq -
D04|Queen's Pawn Game: Colle System|rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq -
D04|Queen's Pawn Game: Colle System, Anti-Colle|rn1qkb1r/ppp1pppp/5n2/3p1b2/3P4/4PN2/PPP2PPP/RNBQKB1R w KQkq -
D04|Queen's Pawn Game: Colle System, Grünfeld Formation|rnbqk2r/ppp1ppbp/5np1/3p4/3P4/3BPN2/PPP2PPP/RNBQK2R w KQkq -
D05|Queen's Pawn Game: Colle System|rnbqkb1r/ppp2ppp/4pn2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R w KQkq -
D05|Queen's Pawn Game: Colle System|rnbqkb1r/ppp2ppp/4pn2/3p4/3P4/3BPN2/PPP2PPP/RNBQK2R b KQkq -
D05|Queen's Pawn Game: Colle System|rnbqkb1r/ppp2ppp/4pn2/3p4/3P4/1P2PN2/P1P2PPP/RNBQKB1R b KQkq -
D05|Queen's Pawn Game: Colle System|r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P4/1P2PN2/PBP2PPP/RN1QKB1R w KQkq -
D05|Queen's Pawn Game: Colle System|r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P4/1P1BPN2/PBP2PPP/RN1QK2R b KQkq -
D05|Queen's Pawn Game: Colle System|r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P4/1P2PN2/PBPN1PPP/R2QKB1R b KQkq -
D05|Queen's Pawn Game: Colle System|rn1q1rk1/pb2bppp/1p2pn2/2pp4/3P4/1P1BPN2/PBPN1PPP/R2Q1RK1 w - -
D05|Queen's Pawn Game: Zukertort Variation|rnbqkb1r/pp3ppp/4pn2/2pp4/3P4/1P2PN2/P1PN1PPP/R1BQKB1R b KQkq -
D05|Rubinstein Opening|rnbqkb1r/pp3ppp/4pn2/2pp4/3P4/1P1BPN2/P1P2PPP/RNBQK2R b KQkq -
D05|Rubinstein Opening: Bogoljubow Defense|r1bq1rk1/pp3ppp/2nbpn2/2pp4/3P4/1P1BPN2/PBP2PPP/RN1Q1RK1 w - -
D05|Rubinstein Opening: Classical Defense|r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/1P1BPN2/PBP2PPP/RN1Q1RK1 w - -
D05|Rubinstein Opening: Semi-Slav Defense|r1bq1rk1/pppn1ppp/3bpn2/3p4/3P4/1P1BPN2/PBP2PPP/RN1Q1RK1 b - -
D05|Rubinstein Opening: Semi-Slav Defense|r1bq1rk1/pp1n1ppp/2pbpn2/3p4/3P4/1P1BPN2/PBP2PPP/RN1Q1RK1 w - -
D05|Rubinstein Opening: Semi-Slav Defense|r1bq1rk1/pp1n1ppp/2pbpn2/3p4/3P4/1P1BPN2/PBPN1PPP/R2Q1RK1 b - -
D06|Queen's Gambit|rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -
D06|Queen's Gambit Declined: Austrian Attack, Salvio Countergambit|rnbqkbnr/pp2pppp/8/2P5/2Pp4/8/PP2PPPP/RNBQKBNR w KQkq -
D06|Queen's Gambit Declined: Austrian Defense|rnbqkbnr/pp2pppp/8/2pp4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
D06|Queen's Gambit Declined: Austrian Defense, Gusev Countergambit|rnbqkb1r/pp2pppp/5n2/2pP4/3P4/8/PP2PPPP/RNBQKBNR w KQkq -
D06|Queen's Gambit Declined: Baltic Defense|rn1qkbnr/ppp1pppp/8/3p1b2/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
D06|Queen's Gambit Declined: Baltic Defense, Pseudo-Chigorin|r2qkbnr/ppp2ppp/2n1p3/3p1b2/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D06|Queen's Gambit Declined: Baltic Defense, Queen Attack|rn1qkbnr/ppp1pppp/8/3p1b2/2PP4/1Q6/PP2PPPP/RNB1KBNR b KQkq -
D06|Queen's Gambit Declined: Baltic Defense, Queen Attack Deferred|rn1qkbnr/ppp2ppp/4p3/3p1b2/2PP4/1QN5/PP2PPPP/R1B1KBNR b KQkq -
D06|Queen's Gambit Declined: Marshall Defense|rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
D06|Queen's Gambit Declined: Marshall Defense, Tan Gambit|rnbqkb1r/pp2pppp/2p2n2/3P4/3P4/8/PP2PPPP/RNBQKBNR w KQkq -
D06|Queen's Gambit Declined: Zilbermints Gambit|rnbqkbnr/p1p1pppp/8/1p1p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
D07|Queen's Gambit Declined: Chigorin Defense|r1bqkbnr/ppp1pppp/2n5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
D07|Queen's Gambit Declined: Chigorin Defense|r1bqkbnr/ppp1pppp/2n5/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -
D07|Queen's Gambit Declined: Chigorin Defense|r1bqkbnr/ppp1pppp/2n5/8/2pP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D07|Queen's Gambit Declined: Chigorin Defense, Exchange Variation|r1b1kbnr/ppp1pppp/2n5/3q4/3P4/8/PP2PPPP/RNBQKBNR w KQkq -
D07|Queen's Gambit Declined: Chigorin Defense, Janowski Variation|r1bqkbnr/ppp1pppp/2n5/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
D07|Queen's Gambit Declined: Chigorin Defense, Lazard Gambit|r1bqkbnr/ppp2ppp/2n5/3pp3/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D07|Queen's Gambit Declined: Chigorin Defense, Main Line|r2qkbnr/ppp1pppp/2n5/3p4/2PP2b1/5N2/PP2PPPP/RNBQKB1R w KQkq -
D07|Queen's Gambit Declined: Chigorin Defense, Main Line, Alekhine Variation|r2qkbnr/ppp1pppp/2n5/3p4/Q1PP2b1/5N2/PP2PPPP/RNB1KB1R b KQkq -
D07|Queen's Gambit Declined: Chigorin Defense, Modern Gambit|r1bqkb1r/ppp1pppp/2n2n2/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D07|Queen's Gambit Declined: Chigorin Defense, Tartakower Gambit|r1bqkbnr/ppp2ppp/2n5/3pp3/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D08|Queen's Gambit Declined: Albin Countergambit|rnbqkbnr/ppp2ppp/8/3pp3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
D08|Queen's Gambit Declined: Albin Countergambit, Normal Line|rnbqkbnr/ppp2ppp/8/4P3/2Pp4/5N2/PP2PPPP/RNBQKB1R b KQkq -
D08|Queen's Gambit Declined: Albin Countergambit, Spassky Variation|rnbqkbnr/ppp2ppp/8/4P3/2PpP3/8/PP3PPP/RNBQKBNR b KQkq e3
D08|Queen's Gambit Declined: Albin Countergambit, Tartakower Defense|rnbqkbnr/pp3ppp/8/2p1P3/2Pp4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D10|Slav Defense|rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
D10|Slav Defense|rnbqkbnr/pp2pppp/2p5/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -
D10|Slav Defense|rnbqkbnr/pp2pppp/2p5/8/2pP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D10|Slav Defense: Diemer Gambit|rnbqkbnr/pp2pppp/2p5/3p4/2PPP3/8/PP3PPP/RNBQKBNR b KQkq -
D10|Slav Defense: Exchange Variation|rnbqkbnr/pp2pppp/2p5/3P4/3P4/8/PP2PPPP/RNBQKBNR b KQkq -
D10|Slav Defense: Slav Gambit, Alekhine Attack|rnbqkbnr/pp2pppp/2p5/8/2pPP3/2N5/PP3PPP/R1BQKBNR b KQkq -
D10|Slav Defense: Winawer Countergambit|rnbqkbnr/pp3ppp/2p5/3pp3/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D10|Slav Defense: Winawer Countergambit, Anti-Winawer Gambit|rnbqkbnr/pp3ppp/2p5/3pp3/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq -
D11|Slav Defense: Bonet Gambit|rnbqkb1r/pp2pppp/2p2n2/3p2B1/2PP4/5N2/PP2PPPP/RN1QKB1R b KQkq -
D11|Slav Defense: Breyer Variation|rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/5N2/PP1NPPPP/R1BQKB1R b KQkq -
D11|Slav Defense: Modern Line|rnbqkbnr/pp2pppp/2p5/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq -
D11|Slav Defense: Modern Line|rnbqkb1r/pp2pp1p/2p2np1/8/2pP4/5NP1/PP2PPBP/RNBQK2R w KQkq -
D11|Slav Defense: Modern Line|rn1qkb1r/pp3ppp/2p1pn2/3p4/2PP2b1/5NP1/PP2PPBP/RNBQ1RK1 b kq -
D11|Slav Defense: Modern Line|r2qkb1r/pp1npppp/2p2n2/3p4/2PP2b1/5NP1/PP2PPBP/RNBQ1RK1 b kq -
D11|Slav Defense: Quiet Variation|rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/4PN2/PP3PPP/RNBQKB1R b KQkq -
D11|Slav Defense: Quiet Variation, Pin Defense|rn1qkb1r/pp2pppp/2p2n2/3p4/2PP2b1/4PN2/PP3PPP/RNBQKB1R w KQkq -
D12|Slav Defense: Quiet Variation, Schallopp Defense|rn1qkb1r/pp2pppp/2p2n2/3p1b2/2PP4/4PN2/PP3PPP/RNBQKB1R w KQkq -
D13|Slav Defense: Exchange Variation|rnbqkb1r/pp2pppp/5n2/3p4/3P4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D15|Slav Defense: Alekhine Variation|rnbqkb1r/pp2pppp/2p2n2/8/2pP4/2N1PN2/PP3PPP/R1BQKB1R b KQkq -
D15|Slav Defense: Chebanenko Variation|rnbqkb1r/1p2pppp/p1p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D15|Slav Defense: Chebanenko Variation|rn1qkb1r/1p2pppp/p1p2n2/3p1b2/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq -
D15|Slav Defense: Geller Gambit|rnbqkb1r/pp2pppp/2p2n2/8/2pPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq -
D15|Slav Defense: Geller Gambit|rnbqkb1r/p3pppp/2p2n2/1p2P3/2pP4/2N2N2/PP3PPP/R1BQKB1R b KQkq -
D15|Slav Defense: Schlechter Variation|rnbqkb1r/pp2pp1p/2p2np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D15|Slav Defense: Süchting Variation|rnb1kb1r/pp2pppp/1qp2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D15|Slav Defense: Three Knights Variation|rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
D15|Slav Defense: Two Knights Attack|rnbqkb1r/pp2pppp/2p2n2/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D16|Slav Defense: Alapin Variation|rnbqkb1r/pp2pppp/2p2n2/8/P1pP4/2N2N2/1P2PPPP/R1BQKB1R b KQkq -
D16|Slav Defense: Smyslov Variation|r1bqkb1r/pp2pppp/n1p2n2/8/P1pP4/2N2N2/1P2PPPP/R1BQKB1R w KQkq -
D16|Slav Defense: Soultanbeieff Variation|rnbqkb1r/pp3ppp/2p1pn2/8/P1pP4/2N2N2/1P2PPPP/R1BQKB1R w KQkq -
D16|Slav Defense: Steiner Variation|rn1qkb1r/pp2pppp/2p2n2/8/P1pP2b1/2N2N2/1P2PPPP/R1BQKB1R w KQkq -
D17|Slav Defense: Czech Variation|rn1qkb1r/pp2pppp/2p2n2/5b2/P1pP4/2N2N2/1P2PPPP/R1BQKB1R w KQkq -
D20|Queen's Gambit Accepted|rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq -
D20|Queen's Gambit Accepted: Accelerated Mannheim Variation|rnbqkbnr/ppp1pppp/8/8/Q1pP4/8/PP2PPPP/RNB1KBNR b KQkq -
D20|Queen's Gambit Accepted: Central Variation, Alekhine System|rnbqkb1r/ppp1pppp/5n2/8/2pPP3/8/PP3PPP/RNBQKBNR w KQkq -
D20|Queen's Gambit Accepted: Central Variation, Greco Variation|rnbqkbnr/p1p1pppp/8/1p6/2pPP3/8/PP3PPP/RNBQKBNR w KQkq -
D20|Queen's Gambit Accepted: Central Variation, McDonnell Defense|rnbqkbnr/ppp2ppp/8/4p3/2pPP3/8/PP3PPP/RNBQKBNR w KQkq -
D20|Queen's Gambit Accepted: Central Variation, McDonnell Defense, Somov Gambit|rnbqkbnr/ppp2ppp/8/4p3/2BPP3/8/PP3PPP/RNBQK1NR b KQkq -
D20|Queen's Gambit Accepted: Central Variation, Modern Defense|r1bqkbnr/ppp1pppp/2n5/8/2pPP3/8/PP3PPP/RNBQKBNR w KQkq -
D20|Queen's Gambit Accepted: Central Variation, Rubinstein Defense|rnbqkbnr/pp2pppp/8/2p5/2pPP3/8/PP3PPP/RNBQKBNR w KQkq -
D20|Queen's Gambit Accepted: Central Variation, Rubinstein Defense, Yefimov Gambit|rnbqkbnr/p3pppp/8/1ppP4/2p1P3/8/PP3PPP/RNBQKBNR w KQkq -
D20|Queen's Gambit Accepted: Linares Variation|rnbqkb1r/p3pppp/5n2/1ppP4/2p1P3/2N5/PP3PPP/R1BQKBNR w KQkq -
D20|Queen's Gambit Accepted: Old Variation|rnbqkbnr/ppp1pppp/8/8/2pP4/4P3/PP3PPP/RNBQKBNR b KQkq -
D20|Queen's Gambit Accepted: Saduleto Variation|rnbqkbnr/ppp1pppp/8/8/2pPP3/8/PP3PPP/RNBQKBNR b KQkq -
D20|Queen's Gambit Accepted: Schwartz Defense|rnbqkbnr/ppp1p1pp/8/5p2/2pPP3/8/PP3PPP/RNBQKBNR w KQkq -
D21|Queen's Gambit Accepted: Alekhine Defense, Borisenko-Furman Variation|rnbqkbnr/1pp1pppp/p7/8/2pPP3/5N2/PP3PPP/RNBQKB1R b KQkq -
D21|Queen's Gambit Accepted: Godes Variation|r1bqkbnr/pppnpppp/8/8/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D21|Queen's Gambit Accepted: Gunsberg Defense|rnbqkbnr/pp2pppp/8/2p5/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D21|Queen's Gambit Accepted: Normal Variation|rnbqkbnr/ppp1pppp/8/8/2pP4/5N2/PP2PPPP/RNBQKB1R b KQkq -
D21|Queen's Gambit Accepted: Rosenthal Variation|rnbqkbnr/ppp2ppp/4p3/8/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D21|Queen's Gambit Accepted: Slav Gambit|rnbqkbnr/p1p1pppp/8/1p6/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D22|Queen's Gambit Accepted: Alekhine Defense|rnbqkbnr/1pp1pppp/p7/8/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D22|Queen's Gambit Accepted: Alekhine Defense, Haberditz Variation|rnbqkbnr/2p1pppp/p7/1p6/2pP4/4PN2/PP3PPP/RNBQKB1R w KQkq -
D23|Queen's Gambit Accepted|rnbqkb1r/ppp1pppp/5n2/8/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D23|Queen's Gambit Accepted: Mannheim Variation|rnbqkb1r/ppp1pppp/5n2/8/Q1pP4/5N2/PP2PPPP/RNB1KB1R b KQkq -
D24|Queen's Gambit Accepted|rnbqkb1r/ppp2ppp/4pn2/8/2pPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq -
D24|Queen's Gambit Accepted|rnbqkb1r/ppp2ppp/4pn2/6B1/2pP4/2N2N2/PP2PPPP/R2QKB1R b KQkq -
D24|Queen's Gambit Accepted: Bogoljubow Defense|rnbqkb1r/1pp1pppp/p4n2/8/2pPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq -
D24|Queen's Gambit Accepted: Showalter Variation|rnbqkb1r/ppp1pppp/5n2/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
D25|Queen's Gambit Accepted: Janowski-Larsen Variation|rn1qkb1r/ppp1pppp/5n2/8/2pP2b1/4PN2/PP3PPP/RNBQKB1R w KQkq -
D25|Queen's Gambit Accepted: Normal Variation|rnbqkb1r/ppp1pppp/5n2/8/2pP4/4PN2/PP3PPP/RNBQKB1R b KQkq -
D25|Queen's Gambit Accepted: Smyslov Variation|rnbqkb1r/ppp1pp1p/5np1/8/2pP4/4PN2/PP3PPP/RNBQKB1R w KQkq -
D25|Queen's Gambit Accepted: Winawer Defense|rn1qkb1r/ppp1pppp/4bn2/8/2pP4/4PN2/PP3PPP/RNBQKB1R w KQkq -
D26|Queen's Gambit Accepted: Classical Defense|rnbqkb1r/pp3ppp/4pn2/2p5/2BP4/4PN2/PP3PPP/RNBQK2R w KQkq -
D26|Queen's Gambit Accepted: Normal Variation, Traditional System|rnbqkb1r/ppp2ppp/4pn2/8/2pP4/4PN2/PP3PPP/RNBQKB1R w KQkq -
D27|Queen's Gambit Accepted: Furman Variation|rnbqk2r/1p3ppp/p3pn2/2b5/2B5/4PN2/PP3PPP/RNBQ1RK1 w kq -
D30|Queen's Gambit Declined|rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
D30|Queen's Gambit Declined: Capablanca Variation|rnbqkb1r/ppp2pp1/4pn1p/3p2B1/2PP4/5N2/PP2PPPP/RN1QKB1R w KQkq -
D30|Queen's Gambit Declined: Capablanca Variation|r1bqkb1r/pp1n1ppp/2p1pn2/3p2B1/2PP4/4PN2/PP1N1PPP/R2QKB1R b KQkq -
D30|Queen's Gambit Declined: Semmering Variation|r1bqkb1r/pp1n1ppp/4pn2/2pp4/2PP4/3BPN2/PP1N1PPP/R1BQK2R w KQkq -
D30|Queen's Gambit Declined: Spielmann Variation|rnbqkb1r/pp3p1p/2p1pnp1/3p4/2PP4/4PN2/PP1N1PPP/R1BQKB1R w KQkq -
D30|Queen's Gambit Declined: Stonewall Variation|rnbqkb1r/pp4pp/2p1p3/3p1p2/2PPn3/3BPN2/PP1N1PPP/R1BQK2R w KQkq -
D30|Queen's Gambit Declined: Tarrasch Defense, Pseudo-Tarrasch|rnbqkbnr/pp3ppp/4p3/2pp4/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D30|Queen's Gambit Declined: Traditional Variation|rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/5N2/PP2PPPP/RN1QKB1R b KQkq -
D30|Queen's Gambit Declined: Vienna Variation|rnbqk2r/ppp2ppp/4pn2/3p2B1/1bPP4/5N2/PP2PPPP/RN1QKB1R w KQkq -
D30|Semi-Slav Defense: Quiet Variation|rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/4PN2/PP1N1PPP/R1BQKB1R b KQkq -
D30|Semi-Slav Defense: Quiet Variation|r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/4PN2/PP1N1PPP/R1BQKB1R w KQkq -
D31|Queen's Gambit Declined: Alapin Variation|rnbqkbnr/p1p2ppp/1p2p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D31|Queen's Gambit Declined: Charousek Variation|rnbqk1nr/ppp1bppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D31|Queen's Gambit Declined: Janowski Variation|rnbqkbnr/1pp2ppp/p3p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D31|Queen's Gambit Declined: Queen's Knight Variation|rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -
D31|Semi-Slav Defense: Accelerated Move Order|rnbqkbnr/pp3ppp/2p1p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D31|Semi-Slav Defense: Anti-Noteboom, Stonewall Variation|rnbqkbnr/pp4pp/2p1p3/3p1p2/2PP4/2N1P3/PP3PPP/R1BQKBNR w KQkq -
D31|Semi-Slav Defense: Gunderam Gambit|rnbqkbnr/pp3ppp/2p1p3/8/2PPp3/2N2P2/PP4PP/R1BQKBNR b KQkq -
D31|Semi-Slav Defense: Marshall Gambit|rnbqkbnr/pp3ppp/2p1p3/3p4/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq -
D31|Semi-Slav Defense: Noteboom Variation|rnbqkbnr/pp3ppp/2p1p3/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D32|Queen's Gambit Declined: Tarrasch Defense|rnbqkbnr/pp3ppp/8/2pp4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D32|Queen's Gambit Declined: Tarrasch Defense|r1bqk1nr/pp2bppp/2n5/2pp2B1/3P4/2N2N2/PP2PPPP/R2QKB1R w KQkq -
D32|Queen's Gambit Declined: Tarrasch Defense|r1bqk2r/pp2nppp/2n5/2pp4/3P4/2N2N2/PP2PPPP/R2QKB1R w KQkq -
D32|Queen's Gambit Declined: Tarrasch Defense|r1bqkb1r/1p3ppp/p1n2n2/2pp4/3P4/2N1PN2/PP2BPPP/R1BQK2R w KQkq -
D32|Tarrasch Defense|rnbqkbnr/pp3ppp/4p3/2pp4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D32|Tarrasch Defense: Grünfeld Gambit|r1bqkbnr/p4ppp/2n5/1pP5/N2p4/5N2/PP2PPPP/R1BQKB1R w KQkq b6
D32|Tarrasch Defense: Marshall Gambit|rnbqkbnr/pp3ppp/8/2pp4/3PP3/2N5/PP3PPP/R1BQKBNR b KQkq -
D32|Tarrasch Defense: Schara Gambit|rnbqkbnr/pp3ppp/4p3/3P4/3p4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D32|Tarrasch Defense: Symmetrical Variation|r1bqkb1r/pp3ppp/2n1pn2/2pp4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq -
D32|Tarrasch Defense: Symmetrical Variation|r1bqkb1r/pp3ppp/2n2n2/2pp4/3P4/2N1PN2/PP3PPP/R1BQKB1R w KQkq -
D32|Tarrasch Defense: Tarrasch Gambit|rnbqkbnr/p4ppp/8/1pP5/N2p4/8/PP2PPPP/R1BQKBNR w KQkq b6
D32|Tarrasch Defense: Two Knights Variation|rnbqkbnr/pp3ppp/8/2pp4/3P4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
D32|Tarrasch Defense: von Hennig Gambit|r2qkbnr/pp3ppp/2n1b3/3Q4/8/2N5/PP2PPPP/R1B1KBNR w KQkq -
D33|Tarrasch Defense: Dubov Tarrasch|r1bqk2r/pp3ppp/2n2n2/2bp4/3N4/2N3P1/PP2PPBP/R1BQK2R w KQkq -
D33|Tarrasch Defense: Prague Variation|r1bqkb1r/pp3ppp/2n2n2/2pp4/3P4/2N2NP1/PP2PP1P/R1BQKB1R w KQkq -
D33|Tarrasch Defense: Rubinstein System|r1bqkbnr/pp3ppp/2n5/2pp4/3P4/2N2NP1/PP2PP1P/R1BQKB1R b KQkq -
D33|Tarrasch Defense: Swedish Variation|r1bqkbnr/pp3ppp/2n5/3p4/2pP4/2N2NP1/PP2PP1P/R1BQKB1R w KQkq -
D33|Tarrasch Defense: Wagner Variation|r2qkb1r/pp3ppp/2n2n2/2pp4/3P2b1/2N2NP1/PP2PPBP/R1BQK2R w KQkq -
D34|Tarrasch Defense: Classical Variation|r1bq1rk1/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQ1RK1 w - -
D35|Queen's Gambit Declined: Exchange Variation|rnbqkb1r/ppp2ppp/4pn2/3P4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq -
D35|Queen's Gambit Declined: Exchange Variation|rnbqk2r/p1p2ppp/1p1b1n2/3p4/3P4/2N1PN2/PP3PPP/R1BQKB1R w KQkq -
D35|Queen's Gambit Declined: Exchange Variation|rnbq1rk1/pp2bppp/2p2n2/3p4/3P4/2NBPN2/PP3PPP/R1BQK2R w KQ -
D35|Queen's Gambit Declined: Harrwitz Attack|rnbqkb1r/ppp2ppp/4pn2/3p4/2PP1B2/2N5/PP2PPPP/R2QKBNR b KQkq -
D35|Queen's Gambit Declined: Normal Defense|rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D37|Queen's Gambit Declined: Barmen Variation|r1bqkb1r/pppn1ppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D37|Queen's Gambit Declined: Harrwitz Attack|rnbqk2r/ppp1bppp/4pn2/3p4/2PP1B2/2N2N2/PP2PPPP/R2QKB1R b KQkq -
D37|Queen's Gambit Declined: Harrwitz Attack|r1b2rk1/pp3ppp/2n1pn2/q1bp4/2P2B2/P1N1PN2/1PQ2PPP/3RKB1R b K -
D37|Queen's Gambit Declined: Harrwitz Attack|r1b2rk1/pp3ppp/2n1pn2/q1bp4/2P2B2/P1N1PN2/1PQ2PPP/2KR1B1R b - -
D37|Queen's Gambit Declined: Miles Variation|rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N2N2/PPQ1PPPP/R3KB1R b KQ -
D37|Queen's Gambit Declined: Three Knights Variation|rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
D37|Queen's Gambit Declined: Three Knights Variation|rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQ -
D37|Queen's Gambit Declined: Three Knights, Vienna Variation|rnbqkb1r/ppp2ppp/4pn2/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D38|Queen's Gambit Declined: Ragozin Defense|rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D38|Queen's Gambit Declined: Westphalian Variation|r1bqk2r/pp1n1ppp/4pn2/2pp2B1/1bPP4/2N1PN2/PP3PPP/R2QKB1R w KQkq -
D40|Queen's Gambit Declined: Semi-Tarrasch Defense|rnbqkb1r/pp3ppp/4pn2/2pp4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D40|Queen's Gambit Declined: Semi-Tarrasch Defense|r1bqk2r/pp3ppp/2nbpn2/3p4/2PP4/P1N2N2/1P3PPP/R1BQKB1R w KQkq -
D41|Queen's Gambit Declined: Semi-Tarrasch Defense|r1bqkb1r/pp3ppp/2n1pn2/2pp4/2PP4/2N2NP1/PP2PP1P/R1BQKB1R w KQkq -
D41|Queen's Gambit Declined: Semi-Tarrasch Defense|rnbqkb1r/pp3ppp/4pn2/2pP4/3P4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
D41|Queen's Gambit Declined: Semi-Tarrasch Defense|rnbqkb1r/pp3ppp/4p3/2pn4/3P4/2N2NP1/PP2PP1P/R1BQKB1R b KQkq -
D41|Queen's Gambit Declined: Semi-Tarrasch Defense|r1bqkb1r/pp3ppp/2n1p3/2pn4/3P4/2N2NP1/PP2PPBP/R1BQK2R b KQkq -
D43|Semi-Slav Defense|rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D43|Semi-Slav Defense: Anti-Moscow Gambit|rnbqkb1r/pp3pp1/2p1pn1p/3p4/2PP3B/2N2N2/PP2PPPP/R2QKB1R b KQkq -
D43|Semi-Slav Defense: Hastings Variation|rnb1kb1r/pp3pp1/2p1pq1p/3p4/2PP4/1QN2N2/PP2PPPP/R3KB1R b KQkq -
D43|Semi-Slav Defense: Moscow Variation|rnb1kb1r/pp3pp1/2p1pq1p/3p4/2PP4/2N2N2/PP2PPPP/R2QKB1R w KQkq -
D44|Semi-Slav Defense Accepted|rnbqkb1r/pp3ppp/2p1pn2/6B1/2pP4/2N2N2/PP2PPPP/R2QKB1R w KQkq -
D44|Semi-Slav Defense: Botvinnik Variation|rnbqkb1r/pp3ppp/2p1pn2/6B1/2pPP3/2N2N2/PP3PPP/R2QKB1R b KQkq -
D44|Semi-Slav Defense: Botvinnik Variation|rnbqkb1r/p4p2/2p1pn1p/1p2P1N1/2pP3B/2N5/PP3PPP/R2QKB1R b KQkq -
D45|Semi-Slav Defense: Accelerated Meran Variation|rnbqkb1r/1p3ppp/p1p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq -
D45|Semi-Slav Defense: Main Line|rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R b KQkq -
D45|Semi-Slav Defense: Normal Variation|r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq -
D45|Semi-Slav Defense: Normal Variation|r1bq1rk1/pp1n1ppp/2pbpn2/3p4/2PP4/1PN1PN2/PB3PPP/R2QKB1R w KQ -
D45|Semi-Slav Defense: Normal Variation|r1bq1rk1/pp1n1ppp/2pbpn2/3p4/2PP4/1PN1PN2/PB2BPPP/R2QK2R b KQ -
D45|Semi-Slav Defense: Rubinstein System|r1bqkb1r/pp1n1ppp/2p1pn2/3pN3/2PP4/2N1P3/PP3PPP/R1BQKB1R b KQkq -
D45|Semi-Slav Defense: Stoltz Variation|r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2N1PN2/PPQ2PPP/R1B1KB1R b KQkq -
D45|Semi-Slav Defense: Stoltz Variation|r1bqkb1r/p2n1ppp/1pp1pn2/3p4/2PP4/1PN1PN2/P1Q2PPP/R1B1KB1R b KQkq -
D45|Semi-Slav Defense: Stoltz Variation|r2qkb1r/pb1n1ppp/1pp1pn2/3p4/2PP4/1PN1PN2/P1Q2PPP/R1B1KB1R w KQkq -
D45|Semi-Slav Defense: Stoltz Variation|r1bqk2r/pp1n1ppp/2pbpn2/3p4/2PP4/1PN1PN2/P1Q2PPP/R1B1KB1R b KQkq -
D45|Semi-Slav Defense: Stoltz Variation|r1bq1rk1/pp1n1ppp/2pbpn2/3p4/2PP4/1PN1PN2/PBQ2PPP/R3KB1R b KQ -
D45|Semi-Slav Defense: Stonewall Defense|rnbqkb1r/pp4pp/2p1p3/3p1p2/2PPn3/2NBPN2/PP3PPP/R1BQK2R w KQkq -
D46|Semi-Slav Defense: Bogoljubow Variation|r1bqk2r/pp1nbppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQkq -
D46|Semi-Slav Defense: Chigorin Defense|r1bqk2r/pp1n1ppp/2pbpn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQkq -
D46|Semi-Slav Defense: Chigorin Defense|r1bqk2r/pp1n1ppp/2pbpn2/3p4/2PP4/2NBPN2/PPQ2PPP/R1B1K2R b KQkq -
D46|Semi-Slav Defense: Chigorin Defense|r1bq1rk1/pp1n1ppp/2pbpn2/3p4/2PP4/1PNBPN2/PB3PPP/R2QK2R b KQ -
D46|Semi-Slav Defense: Chigorin Defense|r2qkb1r/pb1n1ppp/1pp1pn2/3p4/2PP4/1PNBPN2/P1Q2PPP/R1B1K2R b KQkq -
D46|Semi-Slav Defense: Chigorin Defense|r1bqr1k1/pp1n1ppp/2pbpn2/3p4/2PP4/1PNBPN2/PBQ2PPP/R3K2R b KQ -
D46|Semi-Slav Defense: Chigorin Defense|r1b2rk1/pp1nqppp/2pbpn2/3p4/2PP4/1PNBPN2/PBQ2PPP/R3K2R b KQ -
D46|Semi-Slav Defense: Chigorin Defense|r1bq1rk1/p2n1ppp/2pbpn2/1p6/3P4/2NBPN2/PPQ2PPP/R1B2RK1 b - -
D46|Semi-Slav Defense: Chigorin Defense|r2q1rk1/pb1n1ppp/2pbpn2/1p6/3P4/P1NBPN2/1PQ2PPP/R1B2RK1 b - -
D46|Semi-Slav Defense: Main Line|r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R b KQkq -
D46|Semi-Slav Defense: Main Line|r2q1rk1/pb1nbppp/1pp1pn2/3p4/2PP4/1PNBPN2/PBQ2PPP/R4RK1 b - -
D46|Semi-Slav Defense: Romih Variation|r1bqk2r/pp1n1ppp/2p1pn2/3p4/1bPP4/2NBPN2/PP3PPP/R1BQK2R w KQkq -
D47|Semi-Slav Defense: Meran Variation|r1bqkb1r/p2n1ppp/2p1pn2/1p6/2BP4/2N1PN2/PP3PPP/R1BQK2R w KQkq -
D47|Semi-Slav Defense: Semi-Meran Variation|r1bqkb1r/pp1n1ppp/2p1pn2/8/2BP4/2N1PN2/PP3PPP/R1BQK2R b KQkq -
D48|Semi-Slav Defense: Meran Variation|r1bqkb1r/3n1ppp/p1p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R w KQkq -
D48|Semi-Slav Defense: Meran Variation|r1bqkb1r/3n1ppp/p3pn2/1pp5/3PP3/2NB1N2/PP3PPP/R1BQK2R w KQkq -
D50|Queen's Gambit Declined: Been-Koomen Variation|rnbqkb1r/pp3ppp/4pn2/2pp2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq -
D50|Queen's Gambit Declined: Modern Variation|rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq -
D50|Queen's Gambit Declined: Pseudo-Tarrasch Variation|rnbqkb1r/pp3ppp/4pn2/2pP2B1/3P4/2N5/PP2PPPP/R2QKBNR b KQkq -
D51|Queen's Gambit Declined: Alekhine Variation|r1bqkb1r/pp1n1ppp/2p1pn2/3p2B1/2PPP3/2N2N2/PP3PPP/R2QKB1R b KQkq -
D51|Queen's Gambit Declined: Manhattan Variation|r1bqk2r/pppn1ppp/4pn2/3p2B1/1bPP4/2N1P3/PP3PPP/R2QKBNR w KQkq -
D51|Queen's Gambit Declined: Modern Variation, Knight Defense|r1bqkb1r/pppn1ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq -
D51|Queen's Gambit Declined: Rochlin Variation|r1b1kb1r/pp1n1ppp/2p1pn2/q2p4/2PP4/2N2N2/PP1BPPPP/2RQKB1R b Kkq -
D52|Queen's Gambit Declined|r1bqkb1r/pp1n1ppp/2p1pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R b KQkq -
D52|Queen's Gambit Declined: Cambridge Springs Defense|r1b1kb1r/pp1n1ppp/2p1pn2/q2p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQkq -
D52|Queen's Gambit Declined: Cambridge Springs Defense|r1b1kb1r/pp1n1ppp/2p1pn2/q2P2B1/3P4/2N1PN2/PP3PPP/R2QKB1R b KQkq -
D53|Queen's Gambit Declined|rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq -
D53|Queen's Gambit Declined|rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N2N2/PP2PPPP/R2QKB1R b KQkq -
D53|Queen's Gambit Declined|rnbqk2r/pp2bppp/2p1pn2/6B1/2BP4/2N1PN2/PP3PPP/R2QK2R b KQkq -
D53|Queen's Gambit Declined|rnbqk2r/ppp1bppp/4pn2/6B1/2pP4/2N2N2/PP2PPPP/R2QKB1R w KQkq -
D53|Queen's Gambit Declined|rnbqk2r/ppp1bppp/4pn2/6B1/2pPP3/2N2N2/PP3PPP/R2QKB1R b KQkq -
D53|Queen's Gambit Declined|r1bq1rk1/ppp1bppp/2n1pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ -
D53|Queen's Gambit Declined: Lasker Defense|rnbqk2r/ppp1bppp/4p3/3p2B1/2PPn3/2N1P3/PP3PPP/R2QKBNR w KQkq -
D53|Queen's Gambit Declined: Uhlmann Variation|rnbq1rk1/ppp1bpp1/4pn1p/8/2pP3B/2N2N2/PP2PPPP/2RQKB1R w K -
D54|Queen's Gambit Declined: Neo-Orthodox Variation|rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/2RQKBNR b K -
D55|Queen's Gambit Declined: Anti-Tartakower Variation|rnbq1rk1/ppp1bpp1/4pB1p/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R b KQ -
D55|Queen's Gambit Declined: Neo-Orthodox Variation|rnbq1rk1/ppp1bpp1/4pn1p/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ -
D55|Queen's Gambit Declined: Pillsbury Attack|rn1q1rk1/pbp1bppp/1p3n2/3pN1B1/3P4/2NBP3/PP3PPP/R2QK2R b KQ -
D56|Queen's Gambit Declined|r1bq1rk1/ppp1bpp1/2n1pn1p/3p4/2PP3B/2N1PN2/PP3PPP/2RQKB1R b K -
D56|Queen's Gambit Declined: Lasker Defense|rnbq1rk1/ppp1bpp1/4p2p/3p4/2PPn2B/2N1PN2/PP3PPP/R2QKB1R w KQ -
D56|Queen's Gambit Declined: Lasker Defense|r1bq1rk1/ppp1bpp1/2n1p2p/3p4/2PPn2B/2N1PN2/PP3PPP/2RQKB1R w K -
D58|Queen's Gambit Declined: Tartakower Defense|rnbq1rk1/p1p1bpp1/1p2pn1p/3p4/2PP3B/2N1PN2/PP3PPP/R2QKB1R w KQ -
D59|Queen's Gambit Declined: Tartakower Defense|rn3rk1/p1p1qpp1/1p2b2p/3p4/3P4/4PN2/PP3PPP/2RQKB1R w K -
D60|Queen's Gambit Declined: Orthodox Defense|r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ -
D70|Neo-Grünfeld Defense: Goglidze Attack|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/5P2/PP2P1PP/RNBQKBNR w KQkq -
D70|Neo-Grünfeld Defense: with Nf3|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
D70|Neo-Grünfeld Defense: with g3|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/6P1/PP2PP1P/RNBQKBNR w KQkq -
D71|Neo-Grünfeld Defense: Exchange Variation|rnbqk2r/ppp1ppbp/6p1/3n4/3P4/6P1/PP2PPBP/RNBQK1NR w KQkq -
D71|Neo-Grünfeld Defense: Exchange Variation|rnbqk2r/ppp1ppbp/6p1/3n4/3P4/5NP1/PP2PPBP/RNBQK2R b KQkq -
D72|Neo-Grünfeld Defense: with g3|rnbqk2r/ppp1ppbp/1n4p1/8/3PP3/6P1/PP2NPBP/RNBQK2R b KQkq -
D73|Neo-Grünfeld Defense: with g3|rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R b KQkq -
D74|Neo-Grünfeld Defense: Delayed Exchange Variation|rnbq1rk1/ppp1ppbp/6p1/3n4/3P4/5NP1/PP2PPBP/RNBQ1RK1 b - -
D75|Neo-Grünfeld Defense: Delayed Exchange Variation|rnbq1rk1/pp2ppbp/6p1/2pn4/3P4/2N2NP1/PP2PPBP/R1BQ1RK1 b - -
D75|Neo-Grünfeld Defense: Delayed Exchange Variation|rnbq1rk1/pp2ppbp/6p1/2Pn4/8/5NP1/PP2PPBP/RNBQ1RK1 b - -
D76|Neo-Grünfeld Defense: Delayed Exchange Variation|rnbq1rk1/ppp1ppbp/1n4p1/8/3P4/5NP1/PP2PPBP/RNBQ1RK1 w - -
D77|Neo-Grünfeld Defense: Classical Variation|rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1 b - -
D79|Neo-Grünfeld Defense: Ultra-Delayed Exchange Variation|rnbq1rk1/pp2ppbp/5np1/3p4/3P4/5NP1/PP2PPBP/RNBQ1RK1 w - -
D80|Grünfeld Defense|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D80|Grünfeld Defense: Gibbon Gambit|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP2P1/2N5/PP2PP1P/R1BQKBNR b KQkq -
D80|Grünfeld Defense: Lundin Variation|rnbqkb1r/pp2pp1p/6p1/2p3B1/2PPp3/8/PP1QPPPP/R3KBNR w KQkq -
D80|Grünfeld Defense: Lutikov Variation|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N2P2/PP2P1PP/R1BQKBNR b KQkq -
D80|Grünfeld Defense: Stockholm Variation|rnbqkb1r/ppp1pp1p/5np1/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq -
D80|Grünfeld Defense: Zaitsev Gambit|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP3P/2N5/PP2PPP1/R1BQKBNR b KQkq -
D81|Grünfeld Defense: Russian Variation, Accelerated Variation|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/1QN5/PP2PPPP/R1B1KBNR b KQkq -
D82|Grünfeld Defense: Brinckmann Attack|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP1B2/2N5/PP2PPPP/R2QKBNR b KQkq -
D85|Grünfeld Defense: Exchange Variation|rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq -
D90|Grünfeld Defense: Flohr Variation|rnbqk2r/ppp1ppbp/5np1/3p4/Q1PP4/2N2N2/PP2PPPP/R1B1KB1R b KQkq -
D90|Grünfeld Defense: Three Knights Variation|rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
D90|Grünfeld Defense: Three Knights Variation|rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -
D94|Grünfeld Defense: Flohr Defense|rn1q1rk1/pp2ppbp/2p2np1/3p1b2/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 w - -
D94|Grünfeld Defense: Makogonov Variation|rnbq1rk1/ppp1ppbp/5np1/3p4/1PPP4/2N1PN2/P4PPP/R1BQKB1R b KQ -
D94|Grünfeld Defense: Opocensky Variation|rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/2N1PN2/PP1B1PPP/R2QKB1R b KQ -
D94|Grünfeld Defense: Smyslov Defense|rn1q1rk1/pp2ppbp/2p2np1/3p4/2PP2b1/2NBPN2/PP3PPP/R1BQ1RK1 w - -
D95|Grünfeld Defense: Botvinnik Variation|rnbq1rk1/ppp2pbp/4pnp1/3p4/2PP4/1QN1PN2/PP3PPP/R1B1KB1R w KQ -
D95|Grünfeld Defense: Pachman Variation|r1bq1rk1/pppnppbp/5np1/6N1/2BP4/1QN1P3/PP3PPP/R1B1K2R b KQ -
D96|Grünfeld Defense: Russian Variation|rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/1QN2N2/PP2PPPP/R1B1KB1R b KQkq -
D97|Grünfeld Defense: Russian Variation|rnbq1rk1/ppp1ppbp/5np1/8/2QPP3/2N2N2/PP3PPP/R1B1KB1R b KQ -
E00|Catalan Opening|rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq -
E00|Catalan Opening|rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PP1P/RNBQKBNR w KQkq -
E00|Catalan Opening: Hungarian Gambit|rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/6P1/PP2PP1P/RNBQKBNR w KQkq -
E00|Indian Defense|rnbqkb1r/pppp1ppp/4pn2/8/2PP4/1Q6/PP2PPPP/RNB1KBNR b KQkq -
E00|Indian Defense: Devin Gambit|rnbqkb1r/pppp1ppp/4pn2/8/2PP2P1/8/PP2PP1P/RNBQKBNR b KQkq -
E00|Indian Defense: Seirawan Attack|rnbqkb1r/pppp1ppp/4pn2/6B1/2PP4/8/PP2PPPP/RN1QKBNR b KQkq -
E01|Catalan Opening: Open Defense|rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR b KQkq -
E01|Catalan Opening: Tarrasch Defense|r1bqkb1r/pp3ppp/2n1pn2/2pp4/2PP4/5NP1/PP2PPBP/RNBQK2R w KQkq -
E02|Catalan Opening: Open Defense|rnbqkb1r/ppp2ppp/4pn2/8/2pP4/6P1/PP2PPBP/RNBQK1NR w KQkq -
E03|Catalan Opening: Open Defense|r1bqkb1r/pppn1ppp/4pn2/8/2QP4/6P1/PP2PPBP/RNB1K1NR b KQkq -
E04|Catalan Opening: Open Defense|rnbqkb1r/ppp2ppp/4pn2/8/2pP4/5NP1/PP2PPBP/RNBQK2R b KQkq -
E04|Catalan Opening: Open Defense|rnbqkb1r/pp3ppp/2p1pn2/8/2pP4/5NP1/PP2PPBP/RNBQK2R w KQkq -
E06|Catalan Opening: Closed|rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R b KQkq -
E06|Catalan Opening: Closed|rnbq1rk1/pp2bppp/2p1pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1 w - -
E06|Catalan Opening: Closed|rnbq1rk1/p3bppp/1pp1pn2/3p4/2PP1B2/5NP1/PP2PPBP/RN1Q1RK1 w - -
E06|Catalan Opening: Closed|r2q1rk1/pb2bppp/npp1pn2/3p4/2PPP3/5NP1/PPQN1PBP/R1B2RK1 w - -
E07|Catalan Opening: Closed|r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1 w - -
E08|Catalan Opening: Closed|r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/5NP1/PPQ1PPBP/RNB2RK1 b - -
E08|Catalan Opening: Closed|r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/1P3NP1/P1Q1PPBP/RNB2RK1 b - -
E08|Catalan Opening: Closed|r1bq1rk1/p2nbppp/1pp1pn2/3p4/2PP4/1P3NP1/P1Q1PPBP/RNB2RK1 w - -
E08|Catalan Opening: Closed|r1bq1rk1/p2nbppp/1pp1pn2/3p4/2PP1B2/5NP1/PPQ1PPBP/RN1R2K1 b - -
E08|Catalan Opening: Closed|r2q1rk1/pb1nbppp/1pp1pn2/3p4/2PPPB2/5NP1/PPQN1PBP/R4RK1 b - -
E10|Blumenfeld Countergambit|rnbqkb1r/p2p1ppp/4pn2/1ppP4/2P5/5N2/PP2PPPP/RNBQKB1R w KQkq -
E10|Blumenfeld Countergambit Accepted|rnbqkb1r/p5pp/4pn2/1Ppp4/8/5N2/PP2PPPP/RNBQKB1R w KQkq -
E10|Blumenfeld Countergambit: Duz-Khotimirsky Variation|rnbqkb1r/p2p1ppp/4pn2/1ppP2B1/2P5/5N2/PP2PPPP/RN1QKB1R b KQkq -
E10|Blumenfeld Countergambit: Spielmann Variation|rnbqkb1r/p2p1pp1/5n1p/1ppP2B1/8/5N2/PP2PPPP/RN1QKB1R w KQkq -
E10|Indian Defense: Anti-Nimzo-Indian|rnbqkb1r/pppp1ppp/4pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq -
E10|Indian Defense: Dzindzi-Indian Defense|rnbqkb1r/1ppp1ppp/p3pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
E10|Indian Defense: Döry Indian|rnbqkb1r/pppp1ppp/4p3/8/2PPn3/5N2/PP2PPPP/RNBQKB1R w KQkq -
E11|Bogo-Indian Defense|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
E11|Bogo-Indian Defense: Exchange Variation|rnbqk2r/pppp1ppp/4pn2/8/2PP4/5N2/PP1bPPPP/RN1QKB1R w KQkq -
E11|Bogo-Indian Defense: Grünfeld Variation|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/5N2/PP1NPPPP/R1BQKB1R b KQkq -
E11|Bogo-Indian Defense: Haiti Variation|r1bqk2r/pppp1ppp/2n1pn2/8/1bPP4/5N2/PP1BPPPP/RN1QKB1R w KQkq -
E11|Bogo-Indian Defense: Monticelli Trap|rn1q1rk1/pbpp1ppp/1p2p3/6N1/2PP4/2n3P1/PPQ1PPBP/R3K2R b KQ -
E11|Bogo-Indian Defense: New England Variation|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/8/PP1NPPPP/RNBQKB1R b KQkq -
E11|Bogo-Indian Defense: Nimzowitsch Variation|rnb1k2r/ppppqppp/4pn2/8/1bPP4/5N2/PP1BPPPP/RN1QKB1R w KQkq -
E11|Bogo-Indian Defense: Retreat Variation|rnbqk2r/ppppbppp/4pn2/8/2PP4/5N2/PP1BPPPP/RN1QKB1R w KQkq -
E11|Bogo-Indian Defense: Retreat Variation|rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP1BPPBP/RN1QK2R b KQkq -
E11|Bogo-Indian Defense: Retreat Variation|rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP1BPPBP/RN1QK2R w KQ -
E11|Bogo-Indian Defense: Retreat Variation|rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP1BPPBP/RN1Q1RK1 b - -
E11|Bogo-Indian Defense: Retreat Variation|rnbq1rk1/pp2bppp/2p1pn2/3p4/2PP4/5NP1/PPQBPPBP/RN3RK1 b - -
E11|Bogo-Indian Defense: Retreat Variation|r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/5NP1/PPQBPPBP/RN3RK1 w - -
E11|Bogo-Indian Defense: Retreat Variation|r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/1P3NP1/P1QBPPBP/RN3RK1 b - -
E11|Bogo-Indian Defense: Retreat Variation|r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/5NP1/PPQBPPBP/RNR3K1 b - -
E11|Bogo-Indian Defense: Retreat Variation|r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/5NP1/PPQBPPBP/RN1R2K1 b - -
E11|Bogo-Indian Defense: Retreat Variation|r1bq1rk1/pp1nbpp1/2p1pn1p/3p4/2PP4/5NP1/PPQBPPBP/RN1R2K1 w - -
E11|Bogo-Indian Defense: Retreat Variation|r1bq1rk1/p2nbppp/1pp1pn2/3p4/2PP1B2/5NP1/PPQNPPBP/R4RK1 b - -
E11|Bogo-Indian Defense: Retreat Variation|r2q1rk1/p2nbppp/bpp1pn2/3p4/2PP1B2/5NP1/PPQNPPBP/R4RK1 w - -
E11|Bogo-Indian Defense: Vitolins Variation|rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/5N2/PP1BPPPP/RN1QKB1R w KQkq -
E11|Bogo-Indian Defense: Wade-Smyslov Variation|rnbqk2r/1ppp1ppp/4pn2/p7/1bPP4/5N2/PP1BPPPP/RN1QKB1R w KQkq -
E12|Queen's Indian Defense|rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -
E12|Queen's Indian Defense: Kasparov Variation|rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
E12|Queen's Indian Defense: Kasparov-Petrosian Variation|rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/P1N2N2/1P2PPPP/R1BQKB1R b KQkq -
E12|Queen's Indian Defense: Miles Variation|rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP1B2/5N2/PP2PPPP/RN1QKB1R b KQkq -
E12|Queen's Indian Defense: Petrosian Variation|rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/P4N2/1P2PPPP/RNBQKB1R b KQkq -
E13|Queen's Indian Defense: Kasparov Variation|rn1qk2r/pbpp1pp1/1p2pn1p/8/1bPP3B/2N2N2/PP2PPPP/R2QKB1R w KQkq -
E14|Queen's Indian Defense, with e3|rn1qkb1r/pb1p1ppp/1p2pn2/2p5/2PP4/3BPN2/PP3PPP/RNBQ1RK1 b kq -
E14|Queen's Indian Defense, with e3|rn1qk2r/pb1pbppp/1p2pn2/2p5/2PP4/3BPN2/PP3PPP/RNBQ1RK1 w kq -
E14|Queen's Indian Defense, with e3|rn1qkb1r/pb1p1p1p/1p2pnp1/2p5/2PP4/3BPN2/PP3PPP/RNBQ1RK1 w kq -
E14|Queen's Indian Defense, with e3|rn1q1rk1/pbppbppp/1p2pn2/8/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 b - -
E14|Queen's Indian Defense, with e3|rn1q1rk1/pb2bppp/1p1ppn2/2p5/2PP4/1P1BPN2/PB1N1PPP/R2Q1RK1 b - -
E14|Queen's Indian Defense, with e3|rn1qkb1r/pbp2ppp/1p2pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq -
E14|Queen's Indian Defense, with e3|rnbqk2r/p1p2ppp/1p1bpn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R b KQkq -
E14|Queen's Indian Defense, with e3|rn1q1rk1/pbp2ppp/1p1bpn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 w - -
E14|Queen's Indian Defense, with e3|rnbq1rk1/p1p1bppp/1p2pn2/3p4/2PP4/1PN1PN2/P4PPP/R1BQKB1R w KQ -
E14|Queen's Indian Defense, with e3|rnbq1rk1/p1p1bppp/1p2pn2/3p4/2PP4/1P1BPN2/P4PPP/RNBQK2R w KQ -
E14|Queen's Indian Defense, with e3|rn1q1rk1/pbp1bppp/1p2pn2/3p4/2PP4/1P1BPN2/PB1N1PPP/R2QK2R b KQ -
E14|Queen's Indian Defense, with e3|rn1qk2r/pbpp1ppp/1p2pn2/8/2PP4/P3PN2/1P1Q1PPP/R1B1KB1R b KQkq -
E14|Queen's Indian Defense, with e3|rn1q1rk1/pbp1bppp/1p3n2/3p4/3P4/1PNBPN2/PB3PPP/R2QK2R b KQ -
E14|Queen's Indian Defense, with e3|r2q1rk1/pbpn1ppp/1p1bpn2/3p4/2PP4/1P1BPN2/PB1N1PPP/R2Q1RK1 b - -
E14|Queen's Indian Defense: Averbakh Variation|rn1q1rk1/pb1pbppp/1p2pn2/8/2PN4/1P1BP3/PB3PPP/RN1Q1RK1 b - -
E14|Queen's Indian Defense: Spassky System|rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/4PN2/PP3PPP/RNBQKB1R b KQkq -
E14|Queen's Indian Defense: Spassky System|rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/4PN2/PP3PPP/RNBQKB1R w KQkq -
E14|Queen's Indian Defense: Spassky System|rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/3BPN2/PP3PPP/RNBQK2R b KQkq -
E14|Queen's Indian Defense: Spassky System|rn1qkb1r/pbp2ppp/1p2pn2/3p4/2PP4/3BPN2/PP3PPP/RNBQK2R w KQkq -
E14|Queen's Indian Defense: Spassky System3|rn1qkb1r/pb1p1ppp/1p2pn2/2p5/2PP4/3BPN2/PP3PPP/RNBQK2R w KQkq -
E14|Queen's Indian Defense: Spassky System3|rn1qk2r/pb2bppp/1p2p3/3n4/3P4/2NB1N2/PP3PPP/R1BQ1RK1 w kq -
E15|Queen's Indian Defense: Buerger Variation|rn1qkb1r/pb1p1ppp/1p3n2/2pp2N1/2P5/6P1/PP2PPBP/RNBQK2R b KQkq -
E15|Queen's Indian Defense: Fianchetto Variation|rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R b KQkq -
E15|Queen's Indian Defense: Fianchetto Variation, Nimzowitsch Variation|rn1qkb1r/p1pp1ppp/bp2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R w KQkq -
E15|Queen's Indian Defense: Fianchetto Variation, Traditional Line|rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R w KQkq -
E16|Queen's Indian Defense: Capablanca Variation|rn1qk2r/pbpp1ppp/1p2pn2/8/1bPP4/5NP1/PP2PPBP/RNBQK2R w KQkq -
E16|Queen's Indian Defense: Capablanca Variation|rn1q1rk1/pbpp1ppp/1p2pn2/8/1bPP4/5NP1/PP1NPPBP/R1BQ1RK1 b - -
E16|Queen's Indian Defense: Capablanca Variation|rn1q1rk1/pbp2ppp/1p2pn2/3p4/1bPP4/5NP1/PP1NPPBP/R1BQ1RK1 w - -
E16|Queen's Indian Defense: Capablanca Variation|rn1q1rk1/1bpp1ppp/1p2pn2/p7/1bPP4/5NP1/PP1NPPBP/R1BQ1RK1 w - -
E16|Queen's Indian Defense: Riumin Variation|rn1qk2r/pbppbppp/1p2pn2/8/2PP4/5NP1/PP1BPPBP/RN1QK2R w KQkq -
E16|Queen's Indian Defense: Riumin Variation|rn1q1rk1/pbppbppp/1p2pn2/8/2PP4/2N2NP1/PP1BPPBP/R2Q1RK1 b - -
E16|Queen's Indian Defense: Riumin Variation|rn1q1rk1/pbp1bppp/1p2pn2/3p4/2PP4/2N2NP1/PP1BPPBP/R2Q1RK1 w - -
E16|Queen's Indian Defense: Yates Variation|rn1qk2r/1bpp1ppp/1p2pn2/p7/1bPP4/5NP1/PP1BPPBP/RN1QK2R w KQkq -
E17|Queen's Indian Defense: Anti-Queen's Indian System|rn1qk2r/pbppbppp/1p2pn2/8/2PP4/2N2NP1/PP2PPBP/R1BQK2R b KQkq -
E17|Queen's Indian Defense: Classical Variation|rn1qk2r/pbppbppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQ1RK1 b kq -
E17|Queen's Indian Defense: Euwe Variation|rn1q1rk1/pbppbppp/1p2pn2/8/2PP4/1P3NP1/P3PPBP/RNBQ1RK1 b - -
E17|Queen's Indian Defense: Opocensky Variation|rn1qk2r/pbppbppp/1p2p3/8/2PPn3/2N2NP1/PP1BPPBP/R2QK2R b KQkq -
E17|Queen's Indian Defense: Traditional Variation|rn1qk2r/pbppbppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQK2R w KQkq -
E20|Nimzo-Indian Defense|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq -
E20|Nimzo-Indian Defense: Dilworth Gambit|rnbqk2r/pppp1ppp/4pn2/8/1bPPP3/2N5/PP3PPP/R1BQKBNR b KQkq -
E20|Nimzo-Indian Defense: Kmoch Variation|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N2P2/PP2P1PP/R1BQKBNR b KQkq -
E20|Nimzo-Indian Defense: Mikenas Attack|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2NQ4/PP2PPPP/R1B1KBNR b KQkq -
E20|Nimzo-Indian Defense: Romanishin Variation|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N3P1/PP2PP1P/R1BQKBNR b KQkq -
E20|Nimzo-Indian Defense: Romanishin Variation|rnbq1rk1/pp1p1ppp/4pn2/2p5/1bPP4/2N2NP1/PP2PPBP/R1BQK2R b KQ -
E21|Nimzo-Indian Defense: Three Knights Variation|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -
E22|Nimzo-Indian Defense: Spielmann Variation|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/1QN5/PP2PPPP/R1B1KBNR b KQkq -
E24|Nimzo-Indian Defense: Sämisch Variation|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/P1N5/1P2PPPP/R1BQKBNR b KQkq -
E25|Nimzo-Indian Defense: Sämisch Variation|rnbqk2r/pp3ppp/4pn2/2pP4/3P4/P1P2P2/4P1PP/R1BQKBNR b KQkq -
E26|Nimzo-Indian Defense: Sämisch Variation|rnbqk2r/pp1p1ppp/4pn2/2p5/2PP4/P1P1P3/5PPP/R1BQKBNR b KQkq -
E27|Nimzo-Indian Defense: Sämisch Variation|rnbq1rk1/pppp1ppp/4pn2/8/2PP4/P1P5/4PPPP/R1BQKBNR w KQ -
E28|Nimzo-Indian Defense: Sämisch Variation|rnbq1rk1/pppp1ppp/4pn2/8/2PP4/P1P1P3/5PPP/R1BQKBNR b KQ -
E29|Nimzo-Indian Defense: Sämisch Variation|r1bq1rk1/pp1p1ppp/2n1pn2/2p5/2PP4/P1PBP3/5PPP/R1BQK1NR w KQ -
E30|Nimzo-Indian Defense: Leningrad Variation|rnbqk2r/pppp1ppp/4pn2/6B1/1bPP4/2N5/PP2PPPP/R2QKBNR b KQkq -
E32|Nimzo-Indian Defense: Classical Variation|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR b KQkq -
E33|Nimzo-Indian Defense: Classical Variation, Zurich Variation|r1bqk2r/pppp1ppp/2n1pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR w KQkq -
E34|Nimzo-Indian Defense: Classical Variation, Noa Variation|rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N5/PPQ1PPPP/R1B1KBNR w KQkq -
E38|Nimzo-Indian Defense: Classical Variation, Berlin Variation|rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/2N5/PPQ1PPPP/R1B1KBNR w KQkq -
E40|Nimzo-Indian Defense: Rubinstein System|rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR b KQkq -
E40|Nimzo-Indian Defense: Rubinstein System, Taimanov Variation|r1bqk2r/pppp1ppp/2n1pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQkq -
E41|Nimzo-Indian Defense: Rubinstein System|rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQkq -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rnbqk2r/p1pp1ppp/1p2pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQkq -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn1qk2r/pbpp1ppp/1p2pn2/8/1bPP4/2NBPN2/PP3PPP/R1BQK2R b KQkq -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn1q1rk1/pbpp1ppp/1p2pn2/8/1bPP4/2NBPN2/PP3PPP/R1BQK2R w KQ -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn1q1rk1/pbpp1ppp/1p2pn2/8/1bPP4/2NBPN2/PP3PPP/R1BQ1RK1 b - -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn1q1rk1/pb1p1ppp/1p2pn2/2p5/1bPP4/2NBPN2/PP3PPP/R1BQ1RK1 w - -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn1q1rk1/pb1pbppp/1p2pn2/8/N1Pp4/P2BPN2/1P3PPP/R1BQ1RK1 w - -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn1qk2r/pbpp2pp/1p2p3/5p2/1bPPn3/2NBPN2/PPQ2PPP/R1B1K2R w KQkq -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn3rk1/pb1pqppp/1p2pn2/2p5/NbPP4/3BPN2/PP3PPP/R1BQ1RK1 w - -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn1q1rk1/pbpp1ppp/1p2pn2/8/2PP4/2PBPN2/P4PPP/R1BQ1RK1 b - -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rnbqk2r/p1pp1ppp/1p2p3/8/1bPPn3/2N1PN2/PPQ2PPP/R1B1KB1R b KQkq -
E43|Nimzo-Indian Defense: St. Petersburg Variation|rn1qk2r/pbpp2pp/1p2p3/5p2/2PPn3/2PBPN2/P1Q2PPP/R1B2RK1 b kq -
E44|Nimzo-Indian Defense: St. Petersburg Variation|rnbqk2r/p1pp1ppp/1p2pn2/8/1bPP4/2N1P3/PP2NPPP/R1BQKB1R b KQkq -
E46|Nimzo-Indian Defense: Normal Variation|rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQ -
E46|Nimzo-Indian Defense: Reshevsky Variation|rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP2NPPP/R1BQKB1R b KQ -
E46|Nimzo-Indian Defense: Simagin Variation|rnbq1rk1/ppp2ppp/3bpn2/3p4/2PP4/P1N1P3/1P2NPPP/R1BQKB1R w KQ -
E47|Nimzo-Indian Defense: Normal Variation|rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2NBP3/PP3PPP/R1BQK1NR b KQ -
E48|Nimzo-Indian Defense: Ragozin Defense|r1bq1rk1/ppp2ppp/2n1pn2/3p4/1bPP4/2NBPN2/PP3PPP/R1BQ1RK1 b - -
E50|Nimzo-Indian Defense|rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1PN2/PP3PPP/R1BQKB1R b KQ -
E51|Nimzo-Indian Defense: Ragozin Variation|r1bq1rk1/ppp2ppp/2n1pn2/8/1bpP4/2NBPN2/PP3PPP/R1BQ1RK1 w - -
E60|Grünfeld Defense: Counterthrust Variation|rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR w KQkq -
E60|Indian Defense: Anti-Grünfeld, Adorjan Gambit|rnbqkb1r/p1pppp1p/5np1/1p1P4/2P5/8/PP2PPPP/RNBQKBNR w KQkq -
E60|Indian Defense: Anti-Grünfeld, Advance Variation|rnbqkb1r/pppppp1p/5np1/3P4/2P5/8/PP2PPPP/RNBQKBNR b KQkq -
E60|Indian Defense: Anti-Grünfeld, Alekhine Variation|rnbqkb1r/pppppp1p/5np1/8/2PP4/5P2/PP2P1PP/RNBQKBNR b KQkq -
E60|Indian Defense: Anti-Grünfeld, Alekhine Variation, Leko Gambit|rnbqkb1r/pppp1p1p/5np1/4p3/2PP4/5P2/PP2P1PP/RNBQKBNR w KQkq -
E60|Indian Defense: Anti-Grünfeld, Basman-Williams Attack|rnbqkb1r/pppppp1p/5np1/8/2PP3P/8/PP2PPP1/RNBQKBNR b KQkq -
E60|Indian Defense: West Indian Defense|rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -
E60|King's Indian Defense: Fianchetto Variation|rnbqk2r/ppppppbp/5np1/8/2PP4/5NP1/PP2PP1P/RNBQKB1R b KQkq -
E60|King's Indian Defense: Fianchetto Variation, Immediate Fianchetto|rnbqkb1r/pppppp1p/5np1/8/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq -
E60|King's Indian Defense: Normal Variation, King's Knight Variation|rnbqkb1r/pppppp1p/5np1/8/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq -
E60|King's Indian Defense: Santasiere Variation|rnbqk2r/ppppppbp/5np1/8/1PPP4/5N2/P3PPPP/RNBQKB1R b KQkq -
E60|Queen's Pawn, Mengarini Attack|rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PPQ1PPPP/RNB1KBNR b KQkq -
E61|King's Indian Defense|rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -
E61|King's Indian Defense: Semi-Classical Variation|rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/2N1PN2/PP2BPPP/R1BQK2R b KQ -
E61|King's Indian Defense: Smyslov Variation|rnbqk2r/ppp1ppbp/3p1np1/6B1/2PP4/2N2N2/PP2PPPP/R2QKB1R b KQkq -
E70|King's Indian Defense: Accelerated Averbakh Variation|rnbqk2r/ppp1ppbp/3p1np1/6B1/2PPP3/2N5/PP3PPP/R2QKBNR b KQkq -
E70|King's Indian Defense: Kramer Variation|rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP2NPPP/R1BQKB1R b KQkq -
E70|King's Indian Defense: Normal Variation|rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq -
E70|King's Indian Defense: Normal Variation|rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq -
E71|King's Indian Defense: Karpov System|rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N1B2P/PP3PP1/R2QKBNR b KQ -
E71|King's Indian Defense: Makogonov Variation|rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N4P/PP3PP1/R1BQKBNR b KQkq -
E72|King's Indian Defense: Pomar System|rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N3P1/PP2NPBP/R1BQK2R b KQ -
E73|King's Indian Defense: Averbakh Variation|rnbq1rk1/ppp1ppbp/3p1np1/6B1/2PPP3/2N5/PP2BPPP/R2QK1NR b KQ -
E73|King's Indian Defense: Semi-Averbakh System|rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N1B3/PP2BPPP/R2QK1NR b KQ -
E76|King's Indian Defense: Four Pawns Attack|rnbqk2r/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP4PP/R1BQKBNR b KQkq -
E77|King's Indian Defense: Four Pawns Attack|rnbq1rk1/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP2B1PP/R1BQK1NR b KQ -
E77|King's Indian Defense: Six Pawns Attack|r1bq1rk1/pp4bp/2nppnp1/2p5/2P1PPPP/2N5/PP2B3/R1BQK1NR b KQ -
E80|King's Indian Defense: Sämisch Variation|rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP4PP/R1BQKBNR b KQkq -
E81|King's Indian Defense: Steiner Attack|rnbq1rk1/ppp1ppbp/3p1np1/6B1/2PPP3/2N2P2/PP4PP/R2QKBNR b KQ -
E81|King's Indian Defense: Steiner Attack|rnbq1rk1/pp2ppb1/3p1npp/2pP4/2P1PB2/2N2P2/PP4PP/R2QKBNR b KQ -
E81|King's Indian Defense: Steiner Attack|rnbq1rk1/pp3pbp/3p1np1/2pN2B1/2P1P3/5P2/PP1Q2PP/R3KBNR b KQ -
E81|King's Indian Defense: Steiner Attack|rnbq1rk1/pp3pb1/3ppnpB/2pP4/2P1P3/2N2P2/PP1Q2PP/R3KBNR b KQ -
E86|King's Indian Defense: Sämisch Variation|rnbq1rk1/pp3pbp/2pp1np1/4p3/2PPP3/2N1BP2/PP2N1PP/R2QKB1R w KQ -
E90|King's Indian Defense: Larsen Variation|rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N1BN2/PP3PPP/R2QKB1R b KQ -
E90|King's Indian Defense: Zinnowitz Variation|rnbq1rk1/ppp1ppbp/3p1np1/6B1/2PPP3/2N2N2/PP3PPP/R2QKB1R b KQ -
E91|King's Indian Defense: Kazakh Variation|r1bq1rk1/ppp1ppbp/n2p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ -
E91|King's Indian Defense: Orthodox Variation|rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ -
E92|King's Indian Defense: Exchange Variation|rnbq1rk1/ppp2pbp/3p1np1/4P3/2P1P3/2N2N2/PP2BPPP/R1BQK2R b KQ -
E92|King's Indian Defense: Orthodox Variation|rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ -
E92|King's Indian Defense: Petrosian Variation|rnbq1rk1/ppp2pbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQK2R b KQ -
E94|King's Indian Defense: Orthodox Variation|rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 b - -
E95|King's Indian Defense: Orthodox Variation|r1bq1rk1/pppn1pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQR1K1 b - -`
