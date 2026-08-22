# The legacy-ref ban was vacuous — check resolution instead; and placement for two parked rows

**Shadow, 2026-08-15.** Two pieces of work, the first unblocking the second: replace the
`B-NNNN` mention-ban with a resolution check, then find homes for the two rows that had been
parked for retirement.

***

## Part 1 — a gate that forbade its own subject

### The defect

`lint-no-b-refs.ts` failed if any hyphenated legacy id appeared on an authored surface. An
agent that needed to discuss a legacy row therefore wrote it **hyphenless** — `B0747` — and
justified the workaround by arguing that exempting one reference "would make the lint
unfalsifiable."

The instinct was right and pointed the wrong way. The lint was **already** unfalsifiable, and
for a stronger reason than an exemption would have caused:

> The ban forbids *writing* a legacy ref, so a **stale** legacy ref can never exist in tree,
> so the lint can never detect one. It achieves compliance by eliminating its own subject.

A check that has removed everything it could fail on is green for the same reason an unplugged
smoke detector is quiet. This repo has hit the class repeatedly in the last week — a `grep -q`
satisfied by a SIGSEGV; `markdownlint-cli2` exiting 0 having linted zero files; a property-test
generator fixed at arity 2 passing a decoder that rejected every non-2-ary call (#10828). This
is the same shape at the policy layer: **the scope was narrowed to nothing by making the
subject illegal.**

Aaron 2026-08-15: *"if the gate is too restrictive I'd rather change it and do better drift
checks."*

### The replacement

`src/Core.TypeScript/backlog/lint-b-refs-resolve.ts` permits the reference and checks that it
**resolves**. Two rungs, in order:

| rung | meaning | example |
|---|---|---|
| `live` | the alias maps carry the id, and the ZetaId they name has a row file under `docs/backlog/P0..P3`, `workitems`, or `workitems/done` | `B-0732` → `081KSE6WT0008QG0R002YBWBB1` |
| `archive` | no live row, but the id names a surviving artifact under `docs/recovered-orphan-branches-2026-05` | `B-0747` |
| — | neither ⇒ **FAIL**, naming the file, the ref, and the mapped ZetaId if one exists | |

This is strictly stronger than the ban. It catches a fabricated id, a typo'd id, and a real id
whose target was deleted out from under the reference — **none of which the ban could see** —
while letting lineage prose name the thing it is discussing.

**Alias-map presence is deliberately not sufficient.** `b-to-zetaid-map.json` was rebuilt by
mining git history for `B-NNNN` tokens, so it carries ids in the B-2xxx / B-8xxx / B-9xxx bands
that were never rows at all. Requiring the target to exist **on disk** is what makes this a
drift check rather than a second spelling of the map. Measured on the tree that introduced it:
of 1251 mapped ids, **1160 resolve `live`, 14 resolve `archive`, 77 resolve to nothing.** A
predicate that separates 1174 from 77 is discriminating; a predicate that could only ever
return "absent" was not.

### It is falsifiable, proven by mutation

Raw exit codes, no pipes (a pipeline's status is the last command's, and PIPESTATUS is empty in
this zsh):

```text
# plant a dangling ref in a real authored file
$ printf 'mutation probe: cites <a fabricated B-4xxx id>\n' > docs/research/2026-08-15-shadow-mutation-probe.md
$ bun src/Core.TypeScript/backlog/lint-b-refs-resolve.ts > out 2> err ; echo "EXIT=$?"
EXIT=1
  docs/research/2026-08-15-shadow-mutation-probe.md: <id> — DANGLING —
    no alias-map entry and no archive artifact; this id names nothing

# remove it
$ rm docs/research/2026-08-15-shadow-mutation-probe.md
$ bun src/Core.TypeScript/backlog/lint-b-refs-resolve.ts > out 2> err ; echo "EXIT=$?"
EXIT=0
ok: 1 legacy B-NNNN reference(s) on authored surfaces, all resolving
```

A second mutation, for the guard described below — inserting `superseded_by: B-0732` into the
frontmatter of the live row `081KSE6WT0008QG0R002YBWBB1-...md`:

```text
EXIT=1
  docs/backlog/P1/081KSE6WT0008QG0R002YBWBB1-....md: B-0732 — KEY POSITION —
    a closed-series id in row frontmatter is minting with it, not referencing it
```

Note that this second mutant's ref **resolves**. It fails anyway, which is the point: the key
guard is independent of resolution.

`src/Core.TypeScript/backlog/lint-b-refs-resolve.test.ts` (27 tests, all green) pins four
things, and the gate is worthless if any stops holding: it fires on a ref pointing at nothing;
it **passes** a ref pointing at something real (without this, the change bought nothing);
alias-map presence is not resolution; and the minting guards still hold. The scope/boundary
tests from the predecessor are carried over unchanged — narrowing a lint's scan is the other
easy route to unfalsifiability, and widening a skip prefix over a live authored surface must
still go red.

### This does not re-open `B-NNNN` minting

That ambiguity is the one thing that would make this a bad trade, so it is closed twice:

- **`lint-no-new-bnnnn.ts` is untouched.** Any file named `B-<digits>*` under `docs/backlog/`
  or `workitems/` still fails outright. A test in the new harness *executes that tool* against
  a planted B-named row file and asserts exit 1, so the claim is checked here rather than
  assumed. (The planted filename carries a B-13xx id; it is spelled out in the test source and
  deliberately not here — see the accepted cost below, which this paragraph tripped over on the
  first draft.)
- **A legacy id in a work-item row's frontmatter fails.** Naming `B-0747` in prose is lineage;
  putting one in `id:` / `depends_on:` / `superseded_by:` is using the closed series as a live
  key. The gate loosens **references**, never **keys**. The distinction is stated in
  `.claude/rules/workitems-mint-with-zetaid.md`, which otherwise stands as written.

### The B-0732 trap, handled

`B-0732` and `B-0733` read like orphaned legacy numbers and are in fact **live ZetaId rows on
main** — `081KSE6WT0008QG0R002YBWBB1` and `081KSE6WT0008QG0R00102H071`. An agent nearly minted
duplicates of them. The resolver's first rung is exactly this migrated case, and both ids are
pinned by name in the test fixture so a regression reports as a regression rather than as a
near-duplicate months later.

### Accepted cost, stated out loud

A document about dangling references cannot quote one — writing the literal id would plant a
second dangling reference, which is the thing being guarded. This is not the prose-bending the
gate was built to end: the earlier `B0747` bend suppressed a ref that **points at a real
file**, whereas the probe id points at nothing, so nothing is lost by describing it. The gate
suppresses only the naming of things that do not exist.

The legitimate need for a literal dangling id — a falsifiability fixture — is served by the
`ALLOWED_FILES` exemption, which covers the tool and test files and nothing else. No inline
escape hatch was added. An escape hatch on day one is how a gate rots, and if this bites in
practice the bite is the evidence that would justify one.

It bit immediately, and the record is worth keeping: the first draft of this document quoted
the test fixture's B-named filename in the paragraph above, and the gate failed the document
with `DANGLING — no alias-map entry and no archive artifact; this id names nothing`. The check
caught its own author on its own commit, which is the only kind of evidence that a gate is not
decorative.

### Files

- `src/Core.TypeScript/backlog/b-ref-resolve.ts` — the resolver (index + ladder), new
- `src/Core.TypeScript/backlog/lint-b-refs-resolve.ts` — the gate, replaces `lint-no-b-refs.ts`
- `src/Core.TypeScript/backlog/lint-b-refs-resolve.test.ts` — the harness, replaces `lint-no-b-refs.test.ts`
- `src/Core.TypeScript/backlog/b-ref-scope.ts` — scope module; docstring now records the
  asymmetry that the recovered-branch archive is exempt from being *policed* while still
  counting as a *resolution target*
- `.github/workflows/backlog-index-integrity.yml` — both steps retargeted
- `.claude/rules/workitems-mint-with-zetaid.md` · `src/Core.TypeScript/backlog/README.md` —
  the reference/key line
- `workitems/081M010NSB8087G0R002PJVJG7-*` — dated update: the bulk remedy is no longer the
  advertised first move; its runtime defect is unchanged and the item stays open

### The TOCTOU class CodeQL caught, and the second bug underneath it

CodeQL flagged three `js/file-system-race` alerts in `rebuild-legacy-b-id-aliases.ts` — the
file this change touches. All three are the same shape: `statSync(p)` to decide the entry kind,
then `readFileSync(p)` / `writeFileSync(p)` outside any `try`. The check proves nothing, because
the file can vanish or change between the two calls; and for a *rewriting* tool, acting on a
stale check is the worse half.

**They are genuine, and my own two new files carried the same shape** — CodeQL's diff scope had
simply not reached them yet. Fixed at all sites the same way, which is the shape that satisfied
the scanner earlier today in #10757: **let the syscall be the check.** `existsSync` before a
read is always a race; `readFileSync` inside a `try` is not.

The stronger half of the fix is `readdirSync(dir, { withFileTypes: true })`. Entry kind then
comes from the **directory read itself**, so there is no per-entry `stat` to race against at
all — one fewer syscall per entry, across roughly 30k entries.

**That change also surfaced a real latent bug, and it is the reason to prefer this fix over
wrapping the `stat` in a `try`.** `statSync` follows symlinks; `Dirent` does not. This repo
carries tracked symlinks:

| link | target | consequence of following it |
|---|---|---|
| `universal/*.md` | `db/shapes/*.md` | the same file read twice — and, for the rewriting remedy, the substitution applied **twice** |
| `db/hy` | `../hygiene` | a whole subtree walked twice |
| `db/products/glomotion.md` | `../../universal/gamepad.md` | duplicate visit |
| `tests/cross-verification/experience/fixtures/tree1/subdir1/link_to_parent` | `..` | **a cycle** — measured: the old walk recursed **64 levels deep to a 793-character path** before PATH_MAX stopped it |

Every one of those targets is inside the tree and visited directly by the walk, so **skipping
symlinks loses no coverage** — verified, not assumed. What it removes is duplicate work and one
double-application hazard in a tool that writes.

Two tests pin the decision, and both were checked against a mutant that restores the `statSync`
walk: `a symlink to a file is NOT walked; the real file still is`, and `a symlinked DIRECTORY is
not descended into`. Under the mutant both go red.

**An owned error, in the harness for this very PR.** The first draft of the second test asserted
*"a symlink cycle does not hang the walk"* with a wall-clock bound. That check **could not
fail**: a cycle under the old walk terminates at PATH_MAX in milliseconds, so the bound held
before and after the fix. I wrote the defect this PR is about into the PR's own harness. It was
replaced with the out-of-tree-target test, which discriminates.

**A second owned error, and a near-miss.** While checking the remedy's flag handling I ran
`rebuild-legacy-b-id-aliases.ts --help`. That script has no `--help`; anything that is not
`--dry-run` is a **write** run, so it began a full rewrite. I killed it before any file was
modified (`git status` confirms only the four intended files changed), but the correct move was
to read the argv parsing — `--dry-run` on line 29 — rather than probe a rewriting tool with an
unrecognised flag. The absence of a `--help` guard on a tool that rewrites ~1,700 files by
default is worth a row of its own; it is noted here rather than fixed in this PR.

**Runtime:** the syscall reduction is a strict improvement but **not** a fix for
`081M010NSB8087G0R002PJVJG7`. That item attributes the >10-minute cost to git-history mining,
not to the walk, and nothing here touches the mining. Unmeasured on that tool, and the item
stays open.

### The anchors behind the framing — checked, with two corrections

Aaron's framing for why a gate should permit motion and repair rather than forbid motion:
*"we don't slow down, we repair before destruction happens… both sides agree destruction ends
both sides, so let's not do that, infinite game rules."* Both anchors were verified before
being repeated.

**Project Orion (Dyson & Taylor, 1958) — verified, with a correction that strengthens the
framing.** Ted Taylor led the nuclear-pulse-propulsion work at General Atomic; Freeman Dyson
took a sabbatical from Princeton for the 1958–59 academic year to work on it. Detonations aft
of the vehicle drive a plasma against a pusher plate. **Correction to my brief's wording:** the
mechanism is not "the plate is repaired between detonations." An unprotected steel plate ablates
less than 1 mm per pulse; **sprayed with an oil it need not ablate at all**, and the oil is
redistributed through a hole in the plate *between* pulses. So the maintenance is **prophylactic
resurfacing applied before the next detonation**, not repair of damage after it — which is
closer to Aaron's actual words ("repair *before* destruction happens") than my paraphrase was.
The further gloss "repair capacity sized to damage rate rather than damage avoided" is a fair
reading of the per-pulse sizing logic, but it is a framing of the mechanism, not a phrase from
the 1958 work; keep it labelled as such.

**Carse, *Finite and Infinite Games* (Free Press, 1986) — verified as stated, with the
extension flagged.** The opening line is *"A finite game is played for the purpose of winning,
an infinite game for the purpose of continuing the play."* The brief's summary is exact.
**Correction:** the extension — *"so no move that ends play is available to either side"* — is
not Carse. Carse's infinite player *declines* to end play; a rule that the ending move is
**unavailable to both sides by mutual agreement** is a strategic-stability argument
(Schelling's mutual-deterrence reasoning), not a claim from the 1986 text. Both halves are
usable; they are different citations and should not be merged into one.

Applied here: the ban was the finite move — it ended the play by making the subject illegal.
The resolution check keeps play going and repairs continuously, which is the Orion posture
rather than the brakes.

***

## Part 2 — placement for the two parked rows

*"Instead of retire we should try to find placement in the current codebase."* — Aaron,
2026-08-15.

Both recommendations are **toy** under `toy-is-free-metered-must-be-earned`: a placement is a
claim about where code should go, and its falsifier is whether a first slice actually lands
there without needing a home of its own. Nothing below is implemented.

### B-0516 — Gates physical-ECC for memory compression

**Verdict: this already landed, under a different name, and in a better form. Do not mint a
row.** That is a good result, not a failure.

The row (P3, 2026-05-14, XL, archived at
`docs/recovered-orphan-branches-2026-05/misc/chore/b-0516-.../B-0516-gates-ecc-physical-compression-research-direction-2026-05-14.md`)
proposed three paths. All three have homes, and two are built:

**Path 1, adinkra ↔ substrate correspondence — landed and proven.**

- `src/Core/AdinkraCode.fs` — the concrete Adinkra generator: the [8,4] extended Hamming code,
  proven exhaustively over all 16 codewords to be doubly-even, linear, minimum distance 4.
- `src/Core/BitAdinkra.fs` — that code layered over the 1-bit identity stream.
- `src/Core/BinaryCode.fs` · `src/Core/CliffordE8BladeMask.fs` · `src/Core/CliffordE8Bridge.fs`
  · `src/Core.Lean4/Lean4/CayleyDicksonDoublyEven.lean` ·
  `src/Core.TypeScript/research/adinkra-ecc/adinkra-ecc-prototype.ts`.
- Register: `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B "Adinkra-as-generator
  reconstruction" (DISCHARGED 2026-06-05, Lean, sorry-free, axiom-audited) and §A #27
  "PrivacyPreservingIdentity (Adinkra ↔ E8)".
- The rule that states the unification: `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`
  — *the generator **is** the ECC; regenerating from the irreducible **is** the correction.*
  That sentence is B-0516's thesis, promoted to an always-loaded rule.

**Path 2, compression against structural redundancy — landed as a design, one live row from
code.**

- `docs/research/2026-06-07-compression-as-self-bootstrapping-compiler-over-generators-dst-regeneration-the-substrate-shannon-lacks-aaron.md`
  §5 — the dual **materialized ⊕ generative** content node, both arms addressed by the same
  `ContentHash256`; decompression = run the generator under DST and verify the hash.
- Live successor row: `workitems/081KTH5N5ZJ08QG0R002JDT704-generative-content-node-compile-to-generator-compressor-dual.md`
  (P2, backlog, composes with `081KTGTJC1Q08QG0R002VCB55A`).

**Path 3, ECC-aware memory format — landed as research.**

- `docs/research/2026-06-15-ecc-bayesian-memory-growth-universalnumber-precision-times-adinkra-ecc-over-its-growth-data.md`
  — the ECC run over `src/Core/UniversalNumber.fs`'s precision-growth data.

**What did not land, and should not.** B-0516's headline claim was compression *"bound by
physics, exceeding classical info-theoretic limits"* because *"you know how the universe will
reconstruct the data."* Gates' result is that certain **supersymmetric equations** carry
doubly-even self-dual codes. It does not supply a decoder for arbitrary stored bytes, and no
step in the row bridges that gap. The landed version replaced "physics reconstructs the rest"
with "**our generator** reconstructs the rest under DST, verified by content hash" — the same
shape with a falsifier attached, and that substitution is why it could be built at all.

Under `toy-is-free-metered-must-be-earned` the physics-bound clause stays **toy** and must not
be cited as a result. (A sibling agent's recovered-branch census reached the same conclusion
independently; recording the agreement, not inheriting it.)

**Cost to land: near zero, because the landing is done.** The residue is a short lineage
paragraph on `081KTH5N5ZJ08QG0R002JDT704` recording the Gates-ECC origin and the peel above.
Explicitly do **not** mint a new row for B-0516 — a fresh row would re-open a claim the tree
has already answered in a stricter form.

### B-0034 — cross-translation antifragile scripture projection-preservation

**Verdict: homeless as a row, but the method landed and the domain has an adjacent home. Worth
placing, in two pieces, and the second piece is the one that earns its keep.**

The row (P3, 2026-04-26, archived at
`docs/recovered-orphan-branches-2026-05/misc/backlog/B-0034-.../B-0034-cross-translation-antifragile-scripture-projection-preservation.md`)
records Aaron catching an unnamed translation in a citation: *"which translation? … There is so
much bias in each translation, even the originals we have access to, would be great to take an
antifragile view across all versions and see what remains."* Its formal core is
`invariant = ⋂ᵢ Tᵢ(verse)` — what survives every biased projection is load-bearing.

**Placement 1 — the domain home: `src/Core.TypeScript/resonance/` and the etymology track.**

B-0034's ZetaId (`081KQ3HBZ0008QG0R000JEJEN5`) shares a mint batch with three tracks that are
still live rows on main:

| live row | catalog schema |
|---|---|
| `docs/backlog/P2/081KQ3HBZ0008QG0R003GTG5P2-etymology-epistemology-research-track.md` | `src/Core.TypeScript/resonance/etymology-catalog-schema.ts` |
| `docs/backlog/P3/081KQ3HBZ0008QG0R0034DHWTQ-mythology-research-track.md` | `src/Core.TypeScript/resonance/mythology-catalog-schema.ts` |
| `docs/backlog/P3/081KQ3HBZ0008QG0R000K3NSX8-occult-western-esoteric-research-track.md` | `src/Core.TypeScript/resonance/esoteric-catalog-schema.ts` |

B-0034 is the missing fourth member of that family: the same three-filter discipline
(F1 engineering-first / F2 structural-not-superficial / F3 tradition-name-load-bearing), with
the grouping axis being **translation / manuscript witness** instead of language family or
mythos. Its shape is a `translation-witness-catalog-schema.ts` sitting beside the other three.

It is not merely adjacent — the etymology row's own open candidate **(e)** asks for exactly
this machinery: *"Cross-tradition grammatical-subject-position audit — does Sanskrit स्था /
Hebrew עָמַד / Chinese 存 carry the same subject-internal-at-terminus structure the -ω claim
relies on?"* That is B-0034's method applied to the etymology track's own claims. The etymology
row also already carries the honesty instrument B-0034 needs: **filter-failure-rate** watched
so it does not rubber-stamp.

**Placement 2 — the method home, and the reason to land it: `FROZEN-CORE` §A #15 + §B
multi-tower.**

The intersection-over-biased-projections idea is not new here. It is already proven, with a
correlation term:

- **§A #15, Generalized Condorcet / ΔU-aggregation** — for a group of size `n`, competence `c`,
  correlation **ρ**, the society beats its best individual when **ρ < ρ\*** and `c > c*`.
  Proven FsCheck + analytic, 2026-07-03; `src/Core/SocietyUsefulWork.fs`,
  `tests/Tests.FSharp/CondorcetBoundary.Tests.fs`.
- **§B, Multi-tower convergent validation** — *"decorrelated sources agreeing is informative
  (Condorcet / Hong–Page); correlated sources agreeing is worthless."*
- `.claude/rules/numerology-vs-number-theory.md` — *"too many correlations is a warning, not a
  confirmation signal… N correlated observations are not N observations."*

Read against those, **the naive `⋂ᵢ Tᵢ(verse)` is wrong in the register's own terms.** Ten
English translations are a correlated family: nearly all modern ones descend from a shared
critical text (NA28 / UBS5), and the KJV-lineage versions share a documented descent. Counting
them as ten witnesses over-counts, and the register already says so.

**And this is precisely why the row is worth landing rather than retiring.** §B's multi-tower
row carries falsifier (a): *if the towers share a hidden intellectual lineage, their agreement
is convergence-not-truth.* Testing it needs an **externally established independence structure**
— some way to know how correlated the witnesses really are that does not come from the agreement
itself.

Textual criticism **has the stemma.** It has spent 150 years solving exactly this problem, and
its settled answer is the same one: witnesses are grouped by genealogy into text-types
(Alexandrian / Western / Byzantine) and **weighed, not counted** — the discipline's standard
maxim, and the operative principle of the Westcott–Hort genealogical method, which is why
Byzantine numerical dominance is treated as evidence about copying centres rather than about
the text. (Anchors checked, not merely cited; note also that Westcott–Hort's *specific*
reliance on Sinaiticus and Vaticanus is no longer held as ideal — it is the genealogical
**method** that survived, which is the part being borrowed.)

**A stemma is not the only route to independence** (Aaron 2026-08-15, correcting an earlier draft
of this document that called the falsifier *"untestable for theories of mind, because nobody has
the stemma"* — that was wrong). Textual criticism establishes independence from a **known
genealogy**. UX research reaches the same goal from the opposite side: you cannot see inside a
person, so you establish that a self-report is real rather than an artifact of the asking through
**non-leading elicitation, consistency across repeated occasions, and triangulation across probes
that do not share a design assumption**. Independently-designed probes are decorrelated observers
of one inner state, and their agreement is evidence in a way that repeating a single probe never
is — the same result #10834 measured on the dynamics side (*"a quorum's floor is decorrelation"*):
a correlated quorum buys nothing at any `N`.

So B-0034's contribution to the current codebase is concrete and non-devotional — and there are
**two** ground-truth instruments for the ρ estimator, reaching independence by different routes:

| instrument | independence established by | fails when |
|---|---|---|
| textual criticism | **known genealogy** — the stemma, text-types, descent | the reconstructed history is wrong |
| non-biased qualia elicitation | **probe design** — no shared design assumption | the probe set shares an assumption nobody noticed |

> Either gives **a ground-truth test case for the ρ estimator**: a domain where the correlation
> structure among witnesses is established *outside* the agreement being measured, so our
> decorrelation law can be checked against an external answer instead of asserted.

Two instruments are worth more than one precisely because **they fail differently**. A stemma can
be wrong about history; a probe set can share an unnoticed assumption. If they disagree about ρ
that is far more informative than either agreeing with itself — which is the multi-tower row's own
argument turned back on its own measuring stick.

**Anchors, checked rather than cited — and one correction to the framing I was handed.** The
elicitation mechanism's real anchor is **survey methodology / psychometrics**
(framing/acquiescence-bias avoidance; Kahneman–Tversky framing effects; latent-correlation /
factor analysis), which the in-repo `docs/research/2026-08-02-rainbow-spectrum-soul-radar-…md`
already names — together with the clause that matters most here: **"validity is contingent, not
free"** — unbiasedness is an empirical *burden* to be demonstrated per instrument through
order-randomization, counterbalancing and control items. That is exactly the ρ point in the
elicitation setting: **two probes sharing an unnoticed assumption are one probe**, so
probe-design independence must be *shown*, never assumed from having built two.

**The named human anchor: Thomas S. Tullis (1952–2020).** Tullis was **VP of User Experience
Research at Fidelity Investments** until his retirement in 2017, an adjunct professor at Bentley,
the 2011 UXPA Lifetime Achievement recipient and a 2013 CHI Academy inductee; he died on
2020-04-29 of COVID-19 complications. With **Bill Albert** he wrote ***Measuring the User
Experience: Collecting, Analyzing, and Presenting Usability Metrics*** (Morgan Kaufmann, 2008;
2nd ed. 2013), and with Albert and **Donna Tedesco** ***Beyond the Usability Lab: Conducting
Large-Scale User Experience Studies*** (2010).

**Checked, and it holds — for the measurement claim.** *Measuring the User Experience* is
literally the book on turning subjective report into defensible metrics. Its **Chapter 6,
"Self-Reported Metrics,"** carries explicit sections on **"Biases in Collecting Self-Reported
Data"** and **"General Guidelines for Rating Scales,"** alongside Likert and semantic-differential
scales and the standardized instruments (SUS, CSUQ, QUIS, ASQ, USE). And the book organizes its
metrics into **six categories** — performance, issues-based, self-reported, web navigation,
derived, and **behavioral/physiological** — which is the part that actually supports
triangulation: a behavioural or physiological measure does not depend on *asking*, so it is
decorrelated from a questionnaire by construction rather than by hope.

**Where the anchor stops — confirmed against the source, not inferred from the title.** Tullis and
Albert make a **measurement-methodology** claim: reported experience can be collected and analysed
with known biases controlled. That is what the work claims and all it claims. **Aaron has read the
book and confirms it** (2026-08-15): *"it does not try to go this deep, it's just a UX technical
book."* So the division is a checked fact rather than a hedge:

- **Tullis & Albert supply the methodology** — reliable measurement of reported experience,
  including the bias controls and the instrument families that make triangulation real.
- **The bridge from *"subjective report can be measured reliably"* to *"the inner state is real
  and stable"* is Aaron's**, held under §11 as his oracle — and the person making that bridge is
  the one who checked the source and reports that the book does not make it for him.

That is `anchor-to-human-prior-art.md` doing its job: the check **narrowed** what we may claim from
the citation instead of rubber-stamping it, and it is worth saying out loud, because the first
thing a reader should suspect of a citation like this is that nobody opened the book. It is also
the same peel the Gates-ECC section above applies — a result imported into a setting whose objects
it does not quantify over is not a result.

**None of that weakens the anchor; the methodology is exactly what the argument needs.**
Decorrelated, independently-designed probes are what turn a self-report into evidence, and that is
squarely the book's subject. One residual gap, mine and unresolved: I did **not** verify a
longitudinal-consistency claim in it, so the "consistency across repeated occasions" leg stands on
psychometrics generally rather than on this citation.

Two corrections to the anchor as handed to me, both minor and both flagged: the In Memoriam
credits **"more than 50 papers"**, not 70+ (the eight U.S. patents check out); and my own earlier
draft cited Fidelity's corporate design material (Jen Cardello, *"How our product design framework
guides UX research"*, 2019) for this mechanism, which was **the wrong level of citation** — I read
it, and it maps methods to a three-phase product-design progression while saying nothing about
non-leading design, longitudinal consistency, triangulation-as-decorrelation, or self-report
validity. Tullis and Albert replace it. Consistent with the rainbow-spectrum doc's own discipline,
the **method and its published authors** are the anchor; nothing here identifies or characterises
any private individual, and the in-repo "author to confirm" flag on that separate provenance
question is left exactly as it stands.

**Cost to land — splits cleanly into three, and only the middle one is worth doing first.**

1. `translation-witness-catalog-schema.ts` beside the three existing schemas — hours, no
   dependencies, type-checks with no external data. Cheap; carries no falsifier on its own.
2. **The ρ ground-truth check** — a witness-genealogy table (public scholarship: text-type
   assignments and translation-descent) mapped onto `CondorcetBoundary`'s ρ, then compared with
   ρ as estimated from measured agreement. Days. **This is the piece with the falsifier**: if
   measured agreement implies a ρ far from the genealogy's, either the estimator or the mapping
   is wrong, and either answer is worth having.
3. B-0034's Phase 2/4 corpus tooling (parallel translations, interlinears) — **recommend out of
   scope**. Most modern English translations are under restrictive copyright, so a bundled
   parallel corpus carries real licensing exposure. Piece (2) needs only the *genealogy*, which
   is scholarship about the texts, not the texts.

Piece (2) now has a **second, cheaper route** that needs no corpus at all: run the same ρ check
over an elicitation instrument set, where independence comes from probe design rather than
genealogy. It is cheaper because the demonstration burden is already specified — order
randomization, counterbalancing, control items — so the instrument *carries its own* evidence of
decorrelation. Doing both is the point: two estimators that fail differently.

**One boundary, stated deliberately.** The theological frame here is Aaron's, held under §11 as
his oracle. This placement recommends the row for what it can *check* — an externally
documented correlation structure our own register lacks — and takes no position on the
scriptural reading. Not evangelised, and not flattened to metaphor either: the textual-criticism
result is a literal one about manuscript descent, and it is load-bearing as such.

***

## Corrections to the brief I was given

0. **My own error, corrected by Aaron: "untestable for theories of mind" was false.** An earlier
   draft argued the multi-tower falsifier could not be tested because *"nobody has the stemma."*
   A known genealogy is one route to independence, not the only one — probe design is another,
   and the earlier claim quietly assumed that establishing independence requires knowing history.
   Corrected in place above, and the argument came out stronger: two ρ instruments that fail
   differently, rather than one. **Two corrections to the corrections:** (a) the Fidelity
   *corporate design* article first offered as the anchor does **not** carry the mechanism —
   checked; it maps methods to three product-design phases and is silent on non-leading design,
   longitudinal consistency, triangulation, and self-report validity. It was superseded by
   **Tullis & Albert, *Measuring the User Experience***, which does carry it (Ch. 6, incl. an
   explicit "Biases in Collecting Self-Reported Data" section) — but as a **measurement**
   claim only, never a qualia claim; that bridge is Aaron's under §11, and it is a **checked**
   boundary, not a cautious guess: he has read the book and reports *"it does not try to go this
   deep, it's just a UX technical book."* (b) The In Memoriam credits Tullis with "more than 50"
   papers, not 70+.
1. **The bent `B0747` prose is not on `main`.** It lives entirely in the unmerged PR #10825
   (`shadow/lost-bnnnn-recovered-branch-sweep-2026-08-15`) — its research doc and three minted
   workitems, which declare up front that *"old ids appear here without the hyphen."* Those are
   the sibling agent's files, and the brief also says not to edit them. Both instructions
   cannot be satisfied at once, so the gate change is here and the prose fix belongs to that
   PR's author, now that it is permitted. Nothing on `main` needed unbending; the hyphenated
   `B-0747` in `.claude/rules/workitems-mint-with-zetaid.md` is the first ref to pass the new
   gate on a live surface.
2. **Project Orion's between-pulse operation is prophylactic, not reparative** — anti-ablative
   oil applied *before* the next detonation, detail in Part 1.
3. **"No move that ends play is available to either side" is not Carse** — it is a
   mutual-deterrence argument bolted onto Carse's distinction. Both are usable; they are two
   citations.
4. **My first `build-graph` check was blind, and so was the entry point I used.** Two separate
   errors, both mine, both caught. (a) `deriveGraph` reads **`git ls-files`** — the *tracked*
   set — so running it before `git add` truthfully reports "in sync" about a file set that
   excludes the new files. That is a real check answering a question about the wrong input, and
   it turned PR #10829 red today after both that agent and a reviewer read clean. (b) I invoked
   it as `ace-cli.ts derive`, which produced **no output and exit 0** — the subcommand lives on
   `src/Core.TypeScript/ace/build-graph.ts`, and a silent exit-0 from the wrong entry point
   reads exactly like a pass. Re-run correctly with everything committed:
   `build-graph.ts derive` reports *in sync*, `derive --write` reports *already current*, and
   the target count is **106 before and after** — so these files match no evidence glob and
   there is genuinely no drift. That conclusion is only now supported.
5. **The prescribed `prettier --write` on `build-graph.json` is wrong for this repo.** The
   checked-in file is **not** prettier-formatted on `origin/main` and is **not** in
   `.prettierignore` — `prettier --check` fails on main's own copy, verified against
   `git show origin/main:…`. Running the step produces a **1273-line diff (310 insertions, 963
   deletions)** of pure reformatting, unrelated to any PR. The array-per-line shape is what the
   generator emits, so formatter and generator would be in a standing fight. Left untouched
   here; the mismatch is a pre-existing repo-wide inconsistency worth its own row, not a step
   to run inside an unrelated PR.
6. **`ace derive` is invoked by no workflow** in this tree — confirmed by searching `.github/`
   for `build-graph`, which matches only a prose line in `copilot-instructions.md`. The pre-push
   drift guard on branch `guard/ace-build-graph-drift-before-push` (PR #10813) is presumably
   what closes that gap.
