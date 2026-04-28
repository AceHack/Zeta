---
name: Skill-library vocabulary usage scan 2026-04-22 — top-of-glossary terms by skill-file coverage; first data point for the skill-DAG / lattice prototype
description: Reference snapshot taken 2026-04-22 immediately after the kernel+catalyst+lattice memory triad landed. Started as a 29-term hand-sampled grep across 237 `.claude/skills/*/SKILL.md`; extended same-tick to the full 67-term glossary scan (all h3 headings in `docs/GLOSSARY.md`) across 234 skill files (3 retired between sample and full scan). Produces the first empirical view of the factory's **de-facto skill-library kernel** — which glossary terms are close to the lattice's bottom element (used almost everywhere) vs mid-tier (load-bearing domain terms) vs leaves (specialized / fragmented) vs zero-coverage (three-way: ontology-home-elsewhere, separation-of-concerns, retirement candidates). Surfaces that {Hat, Skill, Persona} is the current skill-library kernel (appears in 200+/234 skills), {Expert, Round, Agent, AX} is the near-kernel tier (144-196 — AX at 144 a surprise revealed by the full scan, confirming agent-experience is load-bearing), {Operator, Retraction, Delta, DBSP, Role, Z3, UX} is the domain-kernel (40-112), and that the NEW kernel candidates from Aaron's 2026-04-22 absorption (carpenter, gardener, kernel, lattice, cleave, combine, The Map) are ZERO-coverage — expected because they landed this tick, but flagged as propagation work. The zero-coverage cluster (18 terms = 27% of glossary) has three distinct causes: ontology-home violations (Wake/Harsh-critic/Tick/Free-time/User-persona), correct separation-of-concerns (DBSP algorithmic tail, sketch cluster), and retirement candidates. Gravity's drift-slowing effect strongest at kernel, weakest at DBSP-technical tail — expected and structurally correct. Useful as the baseline for future lattice-completion audits and as the first empirical anchor for the skill-DAG prototype the lattice memory stages.
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Scan parameters:**

- Date: 2026-04-22 (extended same-tick to full glossary)
- Surface: `.claude/skills/*/SKILL.md` (234 files total — note:
  count changed from 237 to 234 between the 29-term sample
  and this full-term scan; 3 skills were retired intra-tick.
  Interpretation uses 234 as the denominator for the full scan)
- Terms scanned: 67 (all h3 headings in `docs/GLOSSARY.md` —
  the complete set, parsed with `grep "^### "`. Originally
  documented as "77" in the summary; actual h3 count is 67)
- Method: `grep -rli <term> .claude/skills/*/SKILL.md | wc -l`
  after stripping parenthetical clarifications from h3 headings
  (e.g. `Persona (overloaded — always qualify)` → `Persona`)
- Caveat: single-term scan; does not capture multi-term
  co-occurrence, does not distinguish introduction from
  consumption, does not count "Persona" separately from
  "persona-name" references.

**Raw counts — full 67-term scan (sorted descending):**

| Term | Skill files mentioning | Tier |
|---|---|---|
| Hat | 234 / 234 | kernel (⊥ — universal) |
| Skill | 232 / 234 | kernel |
| Persona (overloaded — always qualify) | 200 / 234 | kernel |
| Expert | 196 / 234 | near-kernel |
| Round (as in "round N") | 163 / 234 | near-kernel |
| Agent (not "bot") | 148 / 234 | near-kernel |
| AX (agent experience) | 144 / 234 | near-kernel (surprise) |
| Operator | 112 / 234 | domain-kernel |
| Retraction | 106 / 234 | domain-kernel |
| Delta | 86 / 234 | domain-mid |
| DBSP | 71 / 234 | domain-mid |
| Role | 52 / 234 | structural-mid |
| Z3 | 44 / 234 | domain-mid |
| UX (user experience) | 40 / 234 | structural-mid |
| Notebook | 39 / 234 | structural-mid |
| Z-set | 36 / 234 | domain-mid |
| OpenSpec | 36 / 234 | structural-mid |
| Retire | 31 / 234 | structural-mid |
| Spine | 30 / 234 | domain-low |
| ACL (access control list) | 23 / 234 | structural-low |
| Permission | 19 / 234 | structural-low |
| Hook | 19 / 234 | structural-low |
| Frontmatter | 18 / 234 | structural-low |
| Circuit | 18 / 234 | domain-low |
| Evolve | 15 / 234 | structural-low |
| Checkpoint | 13 / 234 | domain-low |
| HyperLogLog (HLL) | 12 / 234 | domain-low |
| DX (developer experience) | 11 / 234 | structural-low |
| fsync | 10 / 234 | domain-low |
| WDC (Witness-Durable Commit) | 9 / 234 | leaf |
| LFP (least fixed point) | 7 / 234 | leaf |
| IVM (incremental view maintenance) | 7 / 234 | leaf (**see fragmentation note**) |
| Bloom filter | 6 / 234 | leaf |
| Spawn | 5 / 234 | leaf |
| Formal spec | 5 / 234 | leaf |
| Feature flag | 5 / 234 | leaf |
| Idle (agent time-use class) | 4 / 234 | leaf |
| Cold-start cost | 4 / 234 | leaf |
| TLA+ / TLC | 3 / 234 | leaf (**drop from 54** — see note) |
| Lean 4 + Mathlib | 3 / 234 | leaf |
| Harmonious Division | 3 / 234 | leaf |
| FsCheck property test | 3 / 234 | leaf |
| RBAC (role-based access control) | 2 / 234 | leaf |
| Holistic view | 2 / 234 | leaf |
| Backing store | 2 / 234 | leaf |
| Profile / overlay | 1 / 234 | leaf |
| Orphan skill | 1 / 234 | leaf |
| Durability mode | 1 / 234 | leaf |
| Count-Min sketch | 1 / 234 | leaf |
| Zeta=heaven-on-earth (internal framing) | 0 / 234 | absent |
| Zeta's alignment claim (external framing) | 0 / 234 | absent |
| Wake / Wake-up | 0 / 234 | absent (**ontology-home violation**) |
| User persona | 0 / 234 | absent (**subsumed by Persona**) |
| Unretire | 0 / 234 | absent (CLAUDE.md-only concept) |
| Tick / step | 0 / 234 | absent (**Round wins this axis**) |
| Semi-naïve evaluation | 0 / 234 | absent (DBSP-technical tail) |
| Research preview | 0 / 234 | absent |
| Recursive query | 0 / 234 | absent (DBSP-technical tail) |
| Merkle tree / Merkle root | 0 / 234 | absent (DBSP-technical tail) |
| KLL quantile sketch | 0 / 234 | absent (sketch cluster) |
| Harsh critic / spec zealot / storage specialist / … | 0 / 234 | absent (**persona names win**) |
| Gap-monotone / signed-delta semi-naïve | 0 / 234 | absent |
| Free time | 0 / 234 | absent (**possibly retired**) |
| CQF (Counting Quotient Filter) | 0 / 234 | absent (sketch cluster) |
| Counting Bloom filter | 0 / 234 | absent (sketch cluster) |
| Counting algorithm | 0 / 234 | absent |
| AMQ (approximate membership query) | 0 / 234 | absent (sketch cluster) |

**Note on TLA+ drop (54 → 3):** The original 29-term sample
measured `"TLA+"` (literal plus). The full scan uses the
glossary h3 `"TLA+ / TLC"` with the slash, which grep
case-insensitively matches much less. The real signal is
somewhere between — skills reference TLA+ extensively but
rarely match the exact h3 heading form. This is a **scan
methodology artifact**, not a vocabulary shift. Future scans
should split compound glossary terms before counting; that
refinement is pending.

**Full-scan extensions (new findings from expanding 29 → 67 terms):**

The original 29-term sample captured the kernel and most
domain-kernel terms. Expanding to all 67 glossary h3 terms
adds these findings:

1. **AX at 144/234 is near-kernel tier** (not present in
   original sample, discovered only via full scan). AX = agent
   experience. This term sits alongside Expert(196)/Round(163)/
   Agent(148), making it one of the factory's cross-cutting
   structural terms. Its near-kernel position is EMPIRICAL
   evidence that agent-experience thinking is already
   load-bearing in the skill library, matching the presence
   of the Daya (agent-experience) persona in the roster.

2. **Role at 52/234 joins the structural-mid tier.** Cross-
   cutting with UX(40), DX(11), AX(144) — these four terms
   partition the experience-framing space (user / developer /
   agent / role-as-identity). Their coverage distribution
   (144 >> 40 >> 11 ~ 52 for Role) is a concrete data point
   about which framing modes the skill library has absorbed
   most heavily.

3. **Sketch-cluster zero-coverage is a coherent class.** Five
   data-structure glossary entries have zero skill-file
   coverage: HyperLogLog (12 — the one exception), KLL quantile
   (0), CQF (0), Counting Bloom filter (0), AMQ (0), Count-Min
   sketch (1). This is NOT vocabulary drift — it is a glossary
   section that documents data structures used by the DBSP
   algorithms but not discussed at the skill level. Skills
   focus on orchestration and craft; sketches are
   implementation detail. The zero-coverage here is **correct
   separation of concerns**, not a propagation gap. Candidate
   glossary hygiene: consider a separate "Data structures"
   section so these terms don't appear in skill-coverage scans
   as drift candidates.

4. **Ontology-home violations cluster in 5 terms at 0/234:**
   - **Wake/Wake-up (0)** — skills use specific wake
     mechanism verbs instead of the glossary category.
     Real ontology home is in skill frontmatter triggers,
     not the glossary entry.
   - **Harsh critic / spec zealot / storage specialist (0)**
     — persona names (Kira, Viktor, etc.) win over the
     role-category glossary term, matching the 2/237 finding
     from the original sample's "Harsh critic" entry.
     Ontology home: persona files.
   - **User persona (0)** — subsumed by plain `Persona` (200).
     The modifier "User" is not referenced because skills
     qualify persona type differently (agent persona, role
     persona, etc.). Ontology home: `Persona` alone wins.
   - **Tick / step (0)** — subsumed by `Round` (163). Two
     vocabulary words competed; `Round` won empirically.
     Candidate glossary hygiene: mark Tick/step as
     secondary or historical synonym.
   - **Free time (0)** — possibly retired concept.
     Glossary audit candidate.

5. **DBSP-technical tail zero-coverage** (Semi-naïve,
   Recursive query, Merkle tree, Gap-monotone, Counting
   algorithm, Research preview — all 0/234). These are DBSP
   implementation / research vocabulary. Skills don't
   consume them because skills focus on craft, not
   algorithms. Correct separation. Candidate glossary
   hygiene: possible dedicated "DBSP algorithms" section
   to distinguish from general vocabulary.

6. **TLA+ entry methodology artifact** — the glossary h3 is
   `"TLA+ / TLC"`. The full scan matches that literal,
   returning 3/234. The original 29-term sample matched just
   `"TLA+"` returning 54/234. The true coverage is the 54
   (skills use TLA+ without TLC). Lesson: compound glossary
   h3 entries with separators must be split before counting.

7. **Pattern generalization:** The zero-coverage cluster is
   much larger than the original sample suggested (18 terms
   at 0/234 = 27% of glossary). Three distinct causes:
   - Ontology-home violations (terms with real home
     elsewhere — persona files, frontmatter, triggers)
   - Separation-of-concerns (algorithm/sketch vocab
     appropriately outside the skill layer)
   - Retirement candidates (concept no longer used)
   **Gravity's drift-slowing effect
   (`feedback_seed_kernel_glossary_orthogonal_decider_is_information_density_gravity.md`)
   is strongest at the kernel (Hat/Skill/Persona near 100%)
   and weakest at the DBSP-technical tail (sketch-cluster at
   0%).** This is expected and structurally correct — the
   factory's self-referential kernel is where gravity
   concentrates; specialized technical vocabulary should be
   loosely coupled to the skill library.

**Interpretation through the lattice lens
(`feedback_kernel_structure_is_real_mathematical_lattice.md`):**

1. **Empirical skill-library kernel = {Hat, Skill, Persona}.**
   These three terms appear in 200+/237 skills. In lattice
   terms: they sit near the bottom element `⊥` — every
   skill-element in the library joins up through at least
   one of them. This matches the factory's theoretical frame
   (skills are hats worn by personas) and confirms it is
   *empirically* load-bearing, not just conceptually.

2. **Near-kernel tier {Expert, Round, Agent}** (148-196).
   These are the cross-cutting structural terms — governance
   / cadence / identity. They sit one level above the kernel
   proper.

3. **Domain-kernel tier {Operator, Retraction, Delta,
   DBSP}** (71-112). The DBSP-math kernel — these are the
   load-bearing *technical* terms for the database-research
   work. Their mid-tier position matches their role: widely
   referenced, but only by skills working the DBSP surface
   (not every skill is DBSP-domain).

4. **New kernel candidates from 2026-04-22 = zero
   coverage.** Carpenter, gardener, kernel (in the factory
   sense), lattice, cleave, combine, The Map — NONE appear
   in any SKILL.md yet. This is *expected* (the vocabulary
   landed this tick via three memories) but represents
   **propagation work**: future `skill-creator` passes and
   `skill-improver` passes should gradually migrate skill
   vocabulary to use these kernel generators where they fit.
   The kernel-domain glossary buildout in `docs/GLOSSARY.md`
   is the prerequisite — skills will consume terms only
   after the glossary introduces them.

5. **Leaf anomalies flagged:**

   - **IVM at 2/237** — suspicious. IVM is the top-of-glossary
     concept ("what DBSP actually does"), yet only 2 skills
     mention it by name. Almost certainly skills reference
     *DBSP* (71) where they could reference IVM; DBSP is the
     algorithm, IVM is the technique. In lattice terms:
     `DBSP ≤ IVM` (DBSP is a specific element, IVM is its
     parent in the partial order). Keeping them separate is
     correct; but the 2-vs-71 gap suggests the glossary
     entry for IVM is under-utilized as a reference anchor.
     Candidate: skills referencing DBSP should link back to
     IVM at least once for teaching-track completeness.

   - **Harsh critic at 2/237** — suspicious for a different
     reason. Harsh critic is a PERSONA NAME (Kira). Skills
     probably reference *Kira* by name rather than the
     glossary term *harsh critic*. In lattice terms: the
     persona-name is the concrete instance; the glossary
     term is the role. The 2-vs-many mismatch indicates
     vocabulary fragmentation — which is the PROBLEM the
     kernel memory predicts (conflated terms) and which
     kernel-cleave is meant to resolve.

6. **Structural observations:**

   - **No single term is at 237/237.** Even "Skill" (the
     most universal glossary concept) misses 5 skill files
     (232/237). The 5 non-mentioning SKILL.md files are
     candidates for audit — they may be using a synonym,
     they may be mid-refactor, or they may be genuinely
     orthogonal (meta-skills about skill tooling).
   - **The distribution is heavy-tailed.** The top 3 terms
     cover 200+/237 each; the bottom 3 cover 2-9 each. This
     is the expected shape of a vocabulary lattice — a
     small kernel with high-frequency use, a long tail of
     specialized terms.
   - **Factory-specific terms (Hat, Round, Evolve, Retire,
     Wake) outperform domain terms (IVM, Backing store,
     Formal spec).** The factory's self-referential
     vocabulary is more load-bearing within the skill
     library than the DBSP/research vocabulary. Makes
     sense: skills are infrastructure, research vocabulary
     is content.

**How this informs next-step work:**

1. **Skill-DAG prototype** — this scan is the zero'th pass
   of the vocabulary-extraction substrate. A proper
   prototype would:
   - Extract all h3 glossary terms (77 total, this scan
     sampled 29).
   - Per skill, count mentions of each term (not just
     file-level presence).
   - Identify "introduces" vs "consumes" — skills that
     mention a term in a definitional/authoring way
     (e.g., the persona-file or the canonical skill for
     that concept) vs skills that use the term as already
     defined elsewhere.
   - Emit edges `A → B` where A consumes a term that B
     introduces.
   - Topological-sort check for cycles (candidate
     HAND-OFF-CONTRACT cases or missing kernel entries).
   - Output: `docs/research/skill-vocab-dag-<date>.md` as
     an offline cache artifact, plus a reusable script.

2. **Kernel-domain glossary buildout** — Aaron's
   unblocked-but-substantive work. The scan data suggests
   where to place new kernel entries:
   - Carpenter / gardener / overlap-zone → new
     `## Disposition and kernel` section in GLOSSARY.md,
     near `## Core ideas`.
   - Kernel (the factory sense, distinct from OS/math
     use) → same section, with cross-ref to the three
     kernel memories.
   - Lattice / cleave / combine / The Map → same section,
     with cross-ref to
     `feedback_kernel_structure_is_real_mathematical_lattice.md`.
   - Catalyst (HPHT analog) → subsection under "Crystallize-
     acceleration" or new entry with cross-ref to
     `feedback_kernel_is_catalyst_hpht_molten_analog.md`.

3. **Lattice-completion audit** — future cadenced hygiene:
   for each glossary h3 term, scan skill coverage; terms
   below a threshold (say, <3 skills) are candidates for
   either (a) promotion (write more skills that reference
   them), (b) merge into a more-used term, or (c) retire
   if genuinely stale.

4. **Vocabulary fragmentation detector** — the IVM-vs-DBSP
   and Harsh-critic-vs-Kira gaps suggest a detector that
   pairs glossary terms with their real-world synonyms
   (persona names, acronym expansions, algorithm/technique
   pairs) and flags when skills preferentially use one
   surface. Candidate BP-NN row.

**What this scan does NOT cover:**

- **Multi-term co-occurrence.** No edge data yet; this is
  node data only.
- **Per-mention depth.** A skill that mentions "Skill" once
  counts the same as a skill that defines what a skill is.
- **Memory files.** This scanned `.claude/skills/` only,
  not `memory/` or `docs/`. Memory coverage is a separate
  audit.
- **The other 48 glossary h3 terms** (29 of 77 sampled).
  A complete scan is strictly more work but would catch
  the rest of the tail.
- **GLOSSARY entries themselves.** The glossary is both a
  vocabulary source and a consumer; skills that reference
  the glossary are its downstream, but the glossary entries
  *also* reference each other (inline links). Those internal
  edges are not captured here.

**How to re-run this scan (reproducible):**

```bash
for term in "DBSP" "Z-set" "Retraction" "Delta" "Circuit" \
            "Operator" "Spine" "Backing store" "Round" "Skill" \
            "Expert" "Agent" "OpenSpec" "Hat" "Notebook" \
            "Persona" "Harsh critic" "TLA+" "Formal spec" \
            "IVM" "Bloom" "Checkpoint" "Permission" "Hook" \
            "Frontmatter" "Wake" "Evolve" "Retire" "Orphan"; do
  count=$(grep -rli "$term" .claude/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  printf "%-20s %s\n" "$term" "$count"
done | sort -k2 -rn
```

Run this at any future tick to see drift — terms that have
gained or lost coverage since the 2026-04-22 baseline are
the skill-library's moving parts.

**Same-tick extension — 4 additional Girard-reframe kernel terms (2026-04-22):**

After the initial scan, Aaron's 5-message Girard reframe landed 4 more kernel-domain glossary entries (`Belief propagation`, `Mimetic theory (Girard)`, `Memetic theory (Dawkins)`, `Infer.NET`). A targeted re-scan of the 234 skill files for those terms, plus their mechanism vocabulary:

| Term | Skill files mentioning | Notes |
|---|---|---|
| Belief propagation | 1 / 234 | `ml-researcher` only — ML-research-skill context, **not** factory-substrate usage. Effective genuine coverage: 0. |
| Mimetic | 0 / 234 | Girard-side vocabulary, expected zero — landed this tick. |
| Memetic | 0 / 234 | Dawkins-side vocabulary, expected zero — landed this tick. |
| Girard | 0 / 234 | Canonical authority name — expected zero pre-propagation. |
| Dawkins | 0 / 234 | Description-layer name — expected zero. |
| Infer.NET | 0 / 234 | Microsoft Research .NET BP framework — on `Zeta.Bayesian` roadmap per `docs/ROADMAP.md:80`, `docs/INSTALLED.md:72`, not yet skill-surface-referenced. |
| Pearl | 1 / 234 | `ml-researcher` only — same file as Belief propagation match, adjacent ML context, **not** factory usage of Pearl 1982. |
| sum-product | 0 / 234 | BP mechanism vocabulary, expected zero. |
| factor graph | 0 / 234 | BP substrate vocabulary — the skill-library-as-factor-graph reframe is the propagation target. |

**Interpretation:** the 4 Girard-reframe glossary entries join the 6 prior kernel-domain entries (carpenter, gardener, lattice, cleave, combine, The Map, catalyst) at zero genuine factory coverage — all **10** new kernel-domain entries are zero/adjacent-ML coverage at this baseline. This is structurally correct (they landed this tick via memory + GLOSSARY entries) and matches the propagation-work claim in the belief-propagation BACKLOG row (P1 Factory/static-analysis). Future scans should show non-zero coverage on ≥6 of 10 after ~5 rounds of `skill-improver` / `skill-creator` passes — that is the acceptance criterion the BACKLOG row commits to.

**False-positive flags for future re-scans:**
- `Belief propagation` — `ml-researcher` is the adjacent-ML-context source, not factory BP. Filter it out when counting propagation progress.
- `Pearl` — same file, filter out when using as BP-authority-citation count.
- `The Map` — generic English phrase (5 raw hits, 0 case-sensitive on prior scan). Use `"The Map"` exact-phrase-quoted + context grep.
- `Carpenter` — appeared as Cassandra book author "Carpenter & Hewitt" in prior scan, not factory disposition term. Filter by context.

**Reproducible Girard-reframe re-scan snippet:**

```bash
for term in "Belief propagation" "Mimetic" "Memetic" "Girard" "Dawkins" \
            "Infer.NET" "Pearl" "sum-product" "factor graph"; do
  count=$(grep -rli "$term" .claude/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  printf "%-25s %s\n" "$term" "$count"
done | sort -k2 -rn
```

Run at any future tick; delta from this baseline (0/234 genuine across all terms, 1/234 adjacent-ML on belief-prop/Pearl) is the propagation signal.

**Cross-reference family:**

- `memory/feedback_kernel_structure_is_real_mathematical_lattice.md`
  — the lattice memory this scan empirically validates.
  Top-3 terms are the empirical `⊥` generators; leaf terms
  are candidates for the completion audit.
- `memory/feedback_kernel_is_catalyst_hpht_molten_analog.md`
  — the catalyst that this scan's propagation-gap predicts:
  kernel-cleave is the catalytic process that will migrate
  skill vocabulary toward the new kernel generators over
  time.
- `memory/feedback_carpenter_gardener_are_glossary_kernel_vocabulary_seed.md`
  — the kernel memory the scan measures against. The
  zero-coverage of carpenter/gardener/kernel is expected
  and matches the memory's claim that this is future
  propagation work.
- `memory/feedback_crystallize_everything_lossless_compression_except_memory.md`
  — this scan is the *pre-cleave baseline*; a post-cleave
  scan (after kernel-domain glossary buildout propagates)
  should show reduced fragmentation (IVM/DBSP, Harsh
  critic/Kira gaps tighten).
- `memory/feedback_ontology_home_check_every_round.md`
  — fragmentation gaps (IVM at 2, Harsh critic at 2) are
  ontology-home violations: terms have nominal homes in
  glossary but real homes in persona files or shorthand.
- `memory/project_local_agent_offline_capable_factory_cartographer_maps_as_skills.md`
  — this reference memory IS a cartographer-map offline
  cache entry per the directive. Readers without network
  access can read this for factory-state instead of
  re-running greps.
- `docs/GLOSSARY.md` — the source of truth for term
  headings. Future complete scans should parse this file
  rather than hand-sampling.

**Attribution:**

- Scan design and term-sampling: my judgment (no single
  source authority — I picked the 29 most-structural-
  looking h3 entries from a manual read of GLOSSARY.md).
- Interpretation through lattice lens: synthesis of the
  kernel / catalyst / lattice memories absorbed earlier
  this tick.
- Raw data: reproducible via the bash snippet above on
  the 2026-04-22 working tree of `Lucent-Financial-Group/Zeta`.
