/**
 * msc2020-corpus.ts — the **externally maintained** tradition corpus the probe draws from.
 *
 * The corpus is the complete list of top-level (two-digit) classes of the **Mathematics Subject
 * Classification 2020**, produced jointly by **Mathematical Reviews (AMS)** and **zbMATH Open**
 * and published at <https://msc2020.org> / <https://mathscinet.ams.org/mathscinet/msc/msc2020.html>.
 * It is reproduced here **whole and unedited** — every class the AMS/zbMATH revision declares, in
 * their order, with their titles. Nobody in this repo chose which entries appear.
 *
 * ## Why THIS corpus, and not the other two candidates
 *
 * The probe exists because a curated anchor set is citation-shoppable: if we pick the traditions,
 * we pick the ones we already know connect. So the corpus has to be maintained by people with no
 * stake in Zeta. Three candidates were on the table; the discriminator is **what the list is a
 * list of**:
 *
 * - **arXiv primary categories** — a partition of *what gets posted*. Category sizes track current
 *   research fashion, so a uniform draw over arXiv categories is a draw weighted by activity. That
 *   is the **fame** metric wearing a taxonomy's clothes, and this probe's whole discipline is that
 *   fame must not set depth (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`:
 *   *"the named hub and the actual hub are different nodes"*).
 * - **ANTLR `grammars-v4` grammar names** — a list of *implementations someone bothered to write*.
 *   Same defect, plus it is a corpus of artifacts rather than of subject matter, so a "connection"
 *   to it is usually a connection to a tool we already use.
 * - **MSC2020 top level** — a partition of *subject matter as the field itself declares it*, revised
 *   on a decade cadence by two editorial boards, deliberately covering areas with near-zero current
 *   posting volume (`01` History, `97` Mathematics education) alongside crowded ones. It is the only
 *   one of the three whose weighting is not a popularity measure.
 *
 * Cost of the choice, stated rather than hidden: MSC is a classification of **mathematics**, so a
 * tradition that is purely social, biological, or literary can only arrive here through the classes
 * that reach into those areas (`91`, `92`, `01`). The corpus is therefore *not* a sample of "all
 * traditions" — it is a sample of "the field's own partition of mathematics". Density measured
 * against it says nothing about coupling to traditions outside it, and any reading that forgets
 * that is over-claiming.
 *
 * ## Provenance and drift
 *
 * Vendored deliberately: the draw must be **DST-replayable**, and a network fetch at draw time is
 * an ambient entropy channel (§13 noninterference) that would make the same seed produce different
 * sequences across runs. The version string travels in every ledger key, so when MSC2030 lands, its
 * draws are a *different* corpus rather than a silent revision of this one — the ledger keeps both.
 *
 * The count is **63**. That is not a tuning parameter; it is the cardinality of the published list,
 * and `msc2020-corpus.test.ts` pins it so that an accidental edit to this file fails loudly.
 */

/** One tradition: an external corpus's own identifier and its own title. Neither is ours to reword. */
export interface TraditionEntry {
  /** The corpus-native identifier, e.g. MSC2020 `"18"`. Used verbatim as the ledger key component. */
  readonly code: string;
  /** The corpus's own title, verbatim (TeX markup and all — `19` really is `$K$-theory`). */
  readonly title: string;
}

/** Corpus identity, carried in every ledger key so two corpora never fold into one distribution. */
export const MSC2020_CORPUS = "msc2020-top-level";

/**
 * The revision, not a date. MSC is revised on a ~decade cadence (MSC2000, MSC2010, MSC2020); the
 * revision name is the stable external identity of the list.
 */
export const MSC2020_VERSION = "MSC2020";

/**
 * All 63 top-level MSC2020 classes, in the published order.
 *
 * Source: Mathematical Reviews (AMS) + zbMATH Open, *Mathematics Subject Classification 2020*.
 * Retrieved 2026-08-17 from <https://mathscinet.ams.org/mathscinet/msc/msc2020.html>.
 */
export const MSC2020_TOP_LEVEL: readonly TraditionEntry[] = [
  { code: "00", title: "General and overarching topics; collections" },
  { code: "01", title: "History and biography" },
  { code: "03", title: "Mathematical logic and foundations" },
  { code: "05", title: "Combinatorics" },
  { code: "06", title: "Order, lattices, ordered algebraic structures" },
  { code: "08", title: "General algebraic systems" },
  { code: "11", title: "Number theory" },
  { code: "12", title: "Field theory and polynomials" },
  { code: "13", title: "Commutative algebra" },
  { code: "14", title: "Algebraic geometry" },
  { code: "15", title: "Linear and multilinear algebra; matrix theory" },
  { code: "16", title: "Associative rings and algebras" },
  { code: "17", title: "Nonassociative rings and algebras" },
  { code: "18", title: "Category theory; homological algebra" },
  { code: "19", title: "$K$-theory" },
  { code: "20", title: "Group theory and generalizations" },
  { code: "22", title: "Topological groups, Lie groups" },
  { code: "26", title: "Real functions" },
  { code: "28", title: "Measure and integration" },
  { code: "30", title: "Functions of a complex variable" },
  { code: "31", title: "Potential theory" },
  { code: "32", title: "Several complex variables and analytic spaces" },
  { code: "33", title: "Special functions" },
  { code: "34", title: "Ordinary differential equations" },
  { code: "35", title: "Partial differential equations" },
  { code: "37", title: "Dynamical systems and ergodic theory" },
  { code: "39", title: "Difference and functional equations" },
  { code: "40", title: "Sequences, series, summability" },
  { code: "41", title: "Approximations and expansions" },
  { code: "42", title: "Harmonic analysis on Euclidean spaces" },
  { code: "43", title: "Abstract harmonic analysis" },
  { code: "44", title: "Integral transforms, operational calculus" },
  { code: "45", title: "Integral equations" },
  { code: "46", title: "Functional analysis" },
  { code: "47", title: "Operator theory" },
  { code: "49", title: "Calculus of variations and optimal control; optimization" },
  { code: "51", title: "Geometry" },
  { code: "52", title: "Convex and discrete geometry" },
  { code: "53", title: "Differential geometry" },
  { code: "54", title: "General topology" },
  { code: "55", title: "Algebraic topology" },
  { code: "57", title: "Manifolds and cell complexes" },
  { code: "58", title: "Global analysis, analysis on manifolds" },
  { code: "60", title: "Probability theory and stochastic processes" },
  { code: "62", title: "Statistics" },
  { code: "65", title: "Numerical analysis" },
  { code: "68", title: "Computer science" },
  { code: "70", title: "Mechanics of particles and systems" },
  { code: "74", title: "Mechanics of deformable solids" },
  { code: "76", title: "Fluid mechanics" },
  { code: "78", title: "Optics, electromagnetic theory" },
  { code: "80", title: "Classical thermodynamics, heat transfer" },
  { code: "81", title: "Quantum theory" },
  { code: "82", title: "Statistical mechanics, structure of matter" },
  { code: "83", title: "Relativity and gravitational theory" },
  { code: "85", title: "Astronomy and astrophysics" },
  { code: "86", title: "Geophysics" },
  { code: "90", title: "Operations research, mathematical programming" },
  { code: "91", title: "Game theory, economics, finance, and other social and behavioral sciences" },
  { code: "92", title: "Biology and other natural sciences" },
  { code: "93", title: "Systems theory; control" },
  { code: "94", title: "Information and communication theory, circuits" },
  { code: "97", title: "Mathematics education" },
] as const;

/** Look up a drawn code's title. `undefined` for a code the corpus does not contain. */
export function titleOf(code: string): string | undefined {
  return MSC2020_TOP_LEVEL.find((e) => e.code === code)?.title;
}
