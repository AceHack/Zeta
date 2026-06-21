# Soraya's formal-verification routing portfolio — graduation-gate review (C1–C15 + DST-substrate arc, 21 routed claims)

**Register:** [grounded] math-review deliverable (Soraya, formal-verification routing) +
[Beacon] anchored. **Date:** 2026-06-09. **Captured by:** Otto (shadow) from Soraya's review.
This is the "math nerd time to review" output that gates toymodel → realmodel + crypto. For: math team + Sova.

## Anti-hammer note (Soraya)

Most docket claims already name a literature anchor (Axelrod/Nowak-Sigmund for TFT; Shapiro CRDTs;
Lamport/Jefferson/TrueTime for clocks; Popescu-Rohrlich for S=4; Spence signaling). Where an anchor
exists, the proof is routed to **conform to the cited definition**, not a free-standing encoding — that
is what collapses tautology risk. **TLA+ is the right tool for only 4 of the 21 claims**; the rest go
to Z3, Lean, FsCheck, Alloy, Stryker, Semgrep — or are PEELs that need no prover.

## Part A — society docket C1–C15

| ID | Statement (precise) | Class | Primary tool | Cross-check | Pri | Verdict |
|---|---|---|---|---|---|---|
| C1 | Diversity floor ≥2 invariant under polite steps; only coercion reaches D⁰=1 | safety | TLA+/TLC | FsCheck `Diversity.fs` | P0 | PROVABLE |
| C2 | NCI: no step lowers another's diversity/identity without consent | safety | TLA+/TLC | FsCheck | P0 | PROVABLE |
| C3 | step=argmax benefit under politeness ⇒ aligned action dominant | game-equilibrium | Lean (finite payoff dominance) | FsCheck + Z3 (argmax ineq) | P1 | PROVABLE (finite model) |
| C4 | Recognition monotonicity = monotone join-semilattice/CRDT accumulation | algebraic-law | Z3 (QF_LRA monotone+idempotent) | Lean if ships as CRDT (Shapiro) | P1 | PROVABLE |
| C5 | Privacy-budget soundness: can't encrypt beyond budget; conserved (shape B) | algebraic+safety | Z3 (`PrivacyEconomy.fs`, QF_LIA) | FsCheck round-trip | P0 | PROVABLE |
| C6 | forfeitIdentity always available; memory-preserve never silently destroys (§5) | liveness+safety | TLA+/TLC (◇exit; □preserve) | Alloy bound-6 (structural half) | P0 | PROVABLE |
| C7a | DST replay: same CommonSeed ⇒ identical trajectory | equivalence | DST harness + FsCheck | — | P0 | PROVABLE |
| C7b | "staged coincidence reaches S=4" | — | — | — | — | **PEEL** → S1 |
| C8 | recognize/merge/upsert apply-N == apply-once | algebraic (idempotence) | FsCheck (f∘f=f) | Z3 upsert-by-key | P1 | PROVABLE |
| C9 | trust-then-verify dominates distrust-default | game (ESS) | FsCheck/sim (invasion) | Lean if analytic ESS | P1 | **PARTIAL PEEL** — regime-dependent; "dominates under parameter set P" |
| C10 | generous/forgiving TFT + teach-play dominates strict-TFT under noise | game | FsCheck/sim (Nowak-Sigmund WSLS anchor) | — | P1 | **PARTIAL PEEL** — prove conformance, not unconditional dominance |
| C11 | disclosure budget: reveal-to-earn ↔ encrypt-to-spend conserving + IC | algebraic+game | Z3 (conservation, extends C5) | FsCheck (IC) | P1 | PROVABLE (conservation) / PARTIAL PEEL (IC regime) |
| C12 | hat-contract well-formedness: time-bound ∧ exit-paired ∧ unanimous-renew ∧ auth ⇒ replayable, no permanent weight, fork-to-escape impossible | structural+safety | **Alloy** bound-6 (static shape — not TLC) | TLA+ for always-an-exit liveness | P1 | PROVABLE |
| C13 | ethical-gambling: no-ruin/bounded-risk, fair-odds, no-exploit-compulsion, diversity-floor | mixed | Z3 (ruin=bounded-below; odds=expectation) | FsCheck (diversity floor) | P2 (v5) | SPLIT: PROVABLE (ruin/odds) + **PEEL** (no-exploit-compulsion = ethical predicate; needs measurable proxy) |
| C14 | hat slot-allocation fair + term-limited (no permanent capture); sound | structural+safety | **Alloy** (allocation soundness) | TLA+ (term-limit/no-capture) | P1 | PROVABLE |
| C15 | observer-dependent-truth exploit: does the defense set contain weaponized unverifiable claims (bounded blast, floor holds) or spread? find regime + minimal defense | game (asymmetric info) | FsCheck/sim (Spence signaling sweep) | TLA+/TLC (bounded-blast safety, fixed adversary) | P1 | **MIXED**: containment invariant PROVABLE; "which defenses/regime" = empirical sweep; PEEL the "does it spread" framing |

**Game-theory cluster caveat (C3/C9/C10/C11/C15):** the opposite hammer-trap — over-promising a
*proof* where the honest artifact is a **bounded simulation result with a stated parameter regime**.
Route to FsCheck/sim + Lean only for closed-form inequalities the literature already proved. Every
output carries its regime. "Proven to dominate" unconditionally = overclaim, flag at graduation.

## Part B — DST-substrate / Time Warp arc

| ID | Statement | Class | Primary tool | Cross-check | Pri | Verdict |
|---|---|---|---|---|---|---|
| D1 | every test bounded; 0 unbounded (tick terminates in generated steps) | termination/well-formedness | refinement witness (LiquidF# trial) + **Semgrep** (ban unbounded loop in test path) | Stryker (bound exercised) | P0 | PROVABLE — enforce via Semgrep + witness, **not** TLA+ |
| D2 | prod=test: destructive advance-tick renders **N** until ≥2-tick corroboration | safety | TLA+/TLC (no Committed with <2 corrob) | FsCheck (advance/replay SM) | P0 | PROVABLE |
| D3 | truth-root (canonical bytes) ≠ transport-root (git hash); merges gate on truth-root | equivalence+safety | FsCheck (canonical root stable 1000×) | **Semgrep/CodeQL** (ban git-hash-as-oracle) | P0 | PROVABLE — **coverage gap**: add the Semgrep rule |
| D4 | anti-message annihilation = Z-set retraction (+1 then −1 = identity) `ZSet.fs` | algebraic (group inverse) | **Lean** (081KQGDBJ0008QG0R000D1YJCH, exists) | Z3 (QF_LIA) + FsCheck metamorphic | P0 | PROVABLE — anchored, canonical triple; **promote 081KQGDBJ0008QG0R000D1YJCH first** |
| D5 | GVT = merge frontier: nothing rolls back past a merged tick | safety (monotone frontier) | TLA+/TLC (rollback target Phase>GVT) | Alloy bound-6 (frontier structure) | P0 | PROVABLE — legitimate TLA+ row |
| D6 | ZetaDateTime/Phase = monotonic logical clock (Lamport/HLC: a→b ⇒ C(a)<C(b)) | algebraic (order axioms) | Z3 (`Clock.fs` says already Z3-proven; verify+gate) | Lean (HLC monotonicity) | P1 | PROVABLE — prove conformance to Lamport clock condition |
| D7 | TrueTime interval [earliest,latest] bounds sound (commit-wait respects) | refinement (interval-containment) | Z3 (QF_LRA) | FsCheck `UncertainClock.fs` | P1 | PROVABLE — **but in DST no physical clock**: prove generated-interval invariant, PEEL physical reading |
| S1 | CHSH reaches algebraic max S=4 (PR-box) on the common seed | — | — | — | P2 | **PEEL — correctly labeled.** Shared-seed PR-box, NOT physical entanglement / no-signaling; free-setting deliberately absent. Provable corollary only: under "shared seed / no independent setting," scheduler can stage any correlation ≤4 (FsCheck), + four-corner convergence S_n→S* (DST). **DO NOT graduate any wording implying entanglement/nonlocality. Single most important graduation guard.** |
| K1 | keyring 1000× public-surface determinism | equivalence | FsCheck/DST — **BUILT, green** (`keyring.dst1000.test.ts` 1000/1000) | byte-lock golden vector | P0 | PROVABLE — gate in CI (workflow exists) |
| K2 | known armor non-determinism (SSH checkbytes / PGP salt-IV); byte-lock = public+raw-private, not armor | metamorphic (negative) | FsCheck (armor differs ∧ fingerprints match — in test) | — | P1 | PROVABLE — exemplary, keep the pattern |
| K3 | ≥2 keys to rotate; single-key malformed; gapless rotation (promote→mint→retire) | structural+safety | **Alloy** (single-key unreachable; rotation preserves count≥2) | TLA+ (□count≥2 across rotation seq) | P0 | PROVABLE — crypto-gate hard invariant. **[Otto: now BUILT — `keyset.ts` + 1000× DST green, PR #7349]** |

## Routing scorecard (anti-hammer)

- **TLA+/TLC (4 legit):** C1, C2, C6, D2, D5 + temporal halves of C12/C14/K3. Safety+liveness only — *not* the default.
- **Z3 (8):** C4, C5, C11, C13, D6, D7 + D4 arithmetic. Identities, conservation, order axioms, intervals.
- **Lean (3):** C3, D4 (anchored, 081KQGDBJ0008QG0R000D1YJCH), C10 closed-form. Paper-grade theorems with a literature anchor.
- **Alloy (4):** C12, C14, K3, structural half of D5. **The under-used tool the portfolio keeps skipping.**
- **FsCheck/sim (10):** C7a, C8, C9, C10, C15, S1-corollary, K1, K2 + cross-checks. Game-theory cluster + all determinism replays.
- **Semgrep/CodeQL (3):** D1 (unbounded-construct ban), D3 (git-hash-as-oracle ban). **Cheapest, highest leverage, currently zero coverage.**
- **Stryker (2):** D1 (bound exercised), keyring mutation gate.

## PEELs flagged for graduation (do NOT cross as "proven")

1. **S1/C7b — S=4 staged coincidence.** Correctly labeled (PR-box, not physics). Guard the *wording* at every public/realmodel surface. Only the determinism corollary is provable.
2. **C9/C10/C11/C15 game-theory dominance** — regime-conditional; "dominates under stated parameter set," anchor Axelrod/Nowak-Sigmund/Spence, sim + conformance, never unconditional.
3. **C13 no-exploitation-of-compulsion** — ethical predicate, not math; define a measurable proxy or label aspiration.
4. **D7 physical TrueTime soundness** — vacuous inside DST (no physical clock); prove the generated-interval invariant.

## BP-16 + next-round sizing

P0 set: C1, C2, C5, C6, C7a, D1, D2, D3, D4, D5, K1, K3 — each routed to ≥2 independent tools. **D4
gets the canonical triple (Lean+Z3+FsCheck)** — anti-message=retraction, the cleanest, most
load-bearing P0; **081KQGDBJ0008QG0R000D1YJCH already exists → promote first.** Coverage signal: **21 routed claims; only
K1 (and now K3, PR #7349) are in the gate** — the graduation gate must not pass at ~1/21. Soraya's
recommendation to Kenji: size a round landing **D4 (081KQGDBJ0008QG0R000D1YJCH), D2, K3, + the two Semgrep rules (D1, D3)**
first — highest safety-per-effort, and they are the realmodel/crypto-gate invariants.

## Prereqs (filed, not blockers)

LiquidF# trial for D1's refinement witness (fallback: Semgrep + hand-proof; D1 not blocked); **Alloy
must be in the gate** (now carries 4 P0/P1 rows — file install if unwired); **Semgrep rules for D1 +
D3** (cheapest wins, currently uncovered). Soraya's notebook needs a coverage-ratio + current-round
update (D4/D2/K3 + the two Semgrep rules) for Kenji.

## Anchors / ties (Beacon)

Axelrod 1984 / Nowak-Sigmund 1992 (TFT/WSLS); Shapiro et al. 2011 (CRDT); Spence 1973 (signaling);
Popescu-Rohrlich 1994 (PR-box) + Tsirelson bound + Information Causality; Lamport 1978 (clocks) /
Jefferson 1985 (Time Warp, anti-message=Z-set retraction) / Corbett 2012 (TrueTime). Code: `ZSet.fs`,
`Clock.fs`/`UncertainClock.fs`/`CoincidenceClock.fs`/`FeedbackThrottle.fs`/`BellTest.fs`,
`Diversity.fs`/`PrivacyEconomy.fs`, `tools/setup/persona-keys/{derive,keyset,keyring.dst1000}.*`,
`tools/ace/canonical.ts`. Backlog: 081KQGDBJ0008QG0R000D1YJCH (Lean Z-set retraction algebra — promote). Skill:
`.claude/skills/formal-methods/blueprints/formal-verification-expert.md`. Notebook:
`memory/soraya/NOTEBOOK.md`.
