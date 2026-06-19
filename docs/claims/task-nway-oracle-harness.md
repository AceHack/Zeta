# Claim - task-nway-oracle-harness

- **Status:** DONE / MERGED (PR #8585, merged 2026-06-19T15:00:08Z, commit `7aba327bd`).
  Companion research note landed on main (commit `f9a1e7edc`); Lumen memory updated (`6cc13fefe`).
- **Session ID:** manus/20260619T145445Z-73b7d221
- **Harness:** manus
- **Claimed at:** 2026-06-19T14:54:45Z
- **Completed at:** 2026-06-19T15:00:08Z (same-session)
- **Scope:** Extract a shared N-way cross-language byte-diff oracle harness
  (`tests/cross-verification/_harness/nway-diff.ts`) from the per-primitive
  `compare.ts` copies, wire SplitMix64 as the first primitive on it, add a
  divergence self-test that proves the harness bites, and frame the harness as
  transitional toward IR-generated oracles.
- **Durable target:** `tests/cross-verification/_harness/` (the differ +
  self-test), `tests/cross-verification/splitmix64/{compare.ts,vectors.yaml,*-output.json,_gen/}`,
  and a one-line skip-`_`-dirs fix in
  `src/Core.TypeScript/ci/cross-verify-all.ts`.
- **Platform mirror:** PR on this host (the only working land mechanism here);
  acknowledged direction is native observation entries, not PRs.

## Notes

- **What the harness is.** One generic N-way differ replaces the ten drifting
  ~160-line hand-rolled `compare.ts` copies. No privileged oracle: every
  `<lang>-output.json` is a PEER; the harness finds the common fixed point all
  present oracles agree on AND asserts it against the canonical vectors
  (`vectors.{yaml,json}`), so a unanimous-but-wrong result (a shared-bug Sybil of
  oracles) still fails. Divergence yields a structured report naming the
  dissenting oracle(s); a missing canonical, zero oracles, or an empty vector set
  is a FAILURE, never a silent pass (assert-don't-skip,
  `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md`).

- **SplitMix64 as first primitive.** Six independently-computed oracles
  (TS/F#/C#/Rust/Python/Go) agree with each other and with the 10 canonical
  vectors. `compare.ts` is now a three-line delegate to the shared harness.
  Per-language generator scripts live in `splitmix64/_gen/`.

- **Divergence self-test (the green must be able to turn red).**
  `_harness/nway-diff.test.ts` copies the fixture to a temp dir, injects a
  single-byte mutation into one oracle, and asserts the harness exits non-zero and
  names the culprit; a second case deletes a key and asserts `MISSING`; a control
  case asserts the unmutated fixture passes. This catches the Bonsai-bug class —
  one port silently wrong — that per-oracle unit tests structurally cannot, since
  each oracle only ever checks itself.

- **Codegen-forward framing (tier: aspirational target, honestly labelled).**
  The harness header documents that diffing hand-ports is transitional. The
  target state is oracles EMITTED from the homoiconic IR (`src/Core/DynamicValue.fs`)
  via registered generators (`src/Core/GeneratorRegistry.fs`), where agreement is
  TRUE BY CONSTRUCTION. The reframe (Aaron, 2026-06-19): **GeneratorRegistry is
  one schema-registry-over-DBSP relation, not a sibling mechanism — DBSP + Rx is
  the tiny core; everything else is a view over it.** A registry entry
  (name@version → content-addressed ZetaId) is a row in a Z-set; registering or
  superseding a generator is a Z-set delta; rollback is Z-set retraction. So the
  generator registry is evolved with the SAME zero-downtime machinery as schema
  evolution: `src/Core/SchemaEvolution.fs` (B-0930), the `full == incremental`
  theorem = DBSP incrementalization soundness (`src/Core/IndexedZSet.fs`,
  `src/Core/ZSet.fs`), and the "Evolution" proof obligation
  (`docs/research/2026-06-07-evolution-schema-and-index-as-proven-projections-...`,
  `...-ddl-as-branchable-canary-...`). In that future this harness becomes the
  GENERATOR-FIDELITY / byte-lock check on that pipeline, with Kestrel's
  homoiconicity proof as the backstop.

- **Provenance field.** Each oracle output carries `_source` (`"hand-port"` vs
  `"generated-from-ir"`), defaulting to `hand-port`; the harness prints it per
  oracle so the migration to generated oracles is observable per primitive.

- **Where this lands — ACE (the package-manager-of-package-managers).** ACE is
  built on this exact substrate (DBSP+Rx + schema evolution + generators +
  ZetaIds). An ACE "package" is a distributed deterministic QUASI-TIME-CRYSTAL:
  content-addressed identity + replayable Z-set deltas hold structure stable
  across nodes; the package, its versions, its forks, and the negotiation/merge of
  forked changes are all the SAME object (a DBSP relation under an Eve fusion
  contract: `GSet.fs`/`ZSet.fs`/`Reconcile.fs`). Per
  `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`, "the generator IS the ECC across
  BOTH axes — gen(gen) corrects drift across SPACE (N-oracle byte-lock), DST
  corrects drift across TIME (replicated data = quasi-time-crystal)." **This
  harness IS the space-axis ECC check** the register's discharge obligation #1
  names. Honest peel (verbatim): "the agent/intelligence is the FREE layer (not a
  time-crystal), only the DATA is the quasi-time-crystal." Anchors:
  `src/Core.TypeScript/ace/`, `src/Core.FSharp.AceCanonical/AceCanonical.fs`
  (already a cross-verification primitive at `tests/cross-verification/canonical-json/`),
  `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`,
  `docs/agendas/ace-package-manager/`.

- **The other axis — territory/data is a soft/Bayesian uncertainty hierarchy.**
  This harness is the STRUCTURE axis (gen(gen), zero-uncertainty by construction).
  The complementary TERRITORY/DATA axis — the part that rides ACE replication and
  must NOT regenerate from seed — is a soft/Bayesian geospatial memory hierarchy
  keyed on UNCERTAINTY over RELATIVISTIC (traveler-frame / lightlike-consensus-
  gravity) distance: Stanford Sequoia's hierarchy shape but keyed on "how sure?"
  not "where are the bytes?". Anchors: `src/Core/UncertainClock.fs` (HLC +
  uncertainty window, never-falsely-certain partial order), `src/Bayesian/BayesianAggregate.fs`
  (conjugate-prior updates as DBSP stream operators), `src/Core/Hierarchy.fs` /
  `MemoryLens.fs` / `MemorySense.fs` (the levels), B-0994 earth-twin
  "lightlike curves over consensus-gravity". Tier: engine pieces built/proven; the
  unified "Sequoia keyed on uncertainty-over-relativistic-distance" synthesis is
  architecture/research tier (V8 spec + B-0994).

- **Tier honesty.** PROVEN: the 6-oracle byte-lock on 10 vectors; the divergence
  self-test bites and names the culprit. CONJECTURE (§B, named falsifier "if nodes
  drift apart despite gen(gen)/DST → it is metaphor"): the full
  self-regeneration-from-seed quasi-time-crystal. ASPIRATIONAL: the codegen-forward state
  (generated-from-ir oracles) — the discipline exists (`gen/README.md`:
  generator = total `interface → artifact`, DST-deterministic, byte-lockable) but
  the splitmix64 oracles are still hand-ports today.
- No name attribution in any committed file per AGENT-BEST-PRACTICES; opaque
  session ID only.
