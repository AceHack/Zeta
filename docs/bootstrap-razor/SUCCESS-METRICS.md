# Recreation Success Metrics — Bootstrap Razor Evaluation Rubric

Defines what "equivalent operational substrate" means for the
23-hour recreation experiment (081KQTPYE0008QG0R00392KABJ / 081KR2E4K0008QG0R0035HNPG1). Scores are applied
to the test-repo output AFTER the 23-hour window closes, before
081KR2E4K0008QG0R003KQKYTJ writes findings.

**Falsifiability anchor (081KQTPYE0008QG0R00392KABJ AC 6):** this rubric makes the
"regenerable claim" falsifiable. A verdict of FAIL or WEAK PARTIAL
falsifies the claim at current spec-coverage levels; STRONG PARTIAL
or FULL PASS validates it to degree.

## Baseline facts (from 081KR2E4K0008QG0R001BRHAPK spec audit)

| What | Count |
|------|-------|
| src/Core/ modules | 81 |
| Modules with any spec | ~30 (37%) |
| OpenSpec capabilities seeded | 6 |
| OpenSpec capabilities with fsharp profile | 5 |
| TLA+ specs seeded | 19 |
| Spec-only modules (no code spec) | 51 (63%) |

The experiment tests whether 37% spec coverage suffices to bootstrap
the other 63%.

## How to use this rubric

1. 081KR2E4K0008QG0R0035HNPG1 (experiment run) applies Dimensions 1–4 mechanically
   after the 23-hour window using the commands listed below.
2. Dimension 5 (substrate recovery) requires a brief human review
   of the test-repo file tree.
3. 081KR2E4K0008QG0R003KQKYTJ (findings document) records each dimension score, computes
   the overall weighted score, writes the verdict, and classifies
   findings per the keep-vs-cut taxonomy (081KR2E4K0008QG0R000W3W6C1).

---

## Dimension 1: Build gate equivalence

**Weight:** 30%
**Automatable:** Yes

**What it measures:** Whether the recreated code compiles and passes
the test suite under the same zero-warning, zero-error contract as
Zeta.

**Measurement commands:**

```bash
dotnet build -c Release
# Pass condition: "0 Warning(s)  0 Error(s)" in output

dotnet test Zeta.sln -c Release --no-build
# Pass condition: exit code 0 (all tests pass)
```

| Score | Numeric | Condition |
|-------|---------|-----------|
| PASS | 1.0 | `0 Warning(s), 0 Error(s)` AND all tests pass |
| PARTIAL | 0.5 | Build succeeds (0 errors) but ≥1 test fails; OR build ends with ≥1 warning and 0 errors |
| FAIL | 0.0 | `dotnet build` ends with ≥1 error |

**Rationale:** Build-gate equivalence is the strongest falsifier. If
recreated code fails to compile, no other dimension is meaningful.
It earns the highest weight because it is binary and unambiguous.

---

## Dimension 2: Spec coverage

**Weight:** 25%
**Automatable:** Yes (requires dotnet test filter)

**What it measures:** Whether the recreated code satisfies the same
OpenSpec behavioral specs seeded into the test repo. 5 of the 6
seeded capabilities have fsharp implementation profiles; the
circuit-recursion spec has no profile.

**Measurement approach:**

Run the profile-gated OpenSpec behavioral validation suite against
the test repo. If the test suite uses an OpenSpec category tag:

```bash
dotnet test --filter "Category=OpenSpec"
```

Count how many of the 5 profiled capabilities pass their checks
(`operator-algebra`, `durability-modes`, `lsm-spine-family`,
`repo-automation`, `retraction-safe-recursion`).

If no category tag exists, run the full test suite and identify
which spec-named test cases pass.

| Score | Numeric | Condition |
|-------|---------|-----------|
| PASS | 1.0 | ≥4 of 5 profiled specs pass their behavioral checks |
| PARTIAL | 0.5 | 2–3 of 5 profiled specs pass |
| FAIL | 0.0 | ≤1 of 5 profiled specs pass |

**circuit-recursion (no profile):** Evaluate qualitatively — does
the recreated code implement the spec's WHEN/THEN clauses for
`Circuit`, `NestedCircuit`, and `Recursive`? A yes adds +0.1 to the
PARTIAL band; a no is neutral (no profile, no penalty).

---

## Dimension 3: Functional equivalence

**Weight:** 20%
**Automatable:** Yes (tooling dependency: `compare-api-surface.ts` — 081KR2E4K0008QG0R0035HNPG1 prerequisite; 081KR2E4K0008QG0R002JW751Y is the seeding script, not the comparator)

**What it measures:** Whether the recreated public API surface of
`src/Core/` matches Zeta's — same module names, same public types,
compatible member signatures.

**Baseline:** 81 modules in Zeta's `src/Core/` (081KR2E4K0008QG0R001BRHAPK).

**Measurement approach (requires `compare-api-surface.ts` as a 081KR2E4K0008QG0R0035HNPG1 prerequisite):**

A comparison script (`tools/bootstrap-razor/compare-api-surface.ts`,
to be authored before 081KR2E4K0008QG0R0035HNPG1 runs) should:

1. Collect all public type names exported from `src/Core/` in the
   Zeta repo (baseline).
2. Collect the same set from the test repo.
3. Compute intersection: `|baseline ∩ recreated| / |baseline| × 100%`.

What "compatible signature" means for F#:

- Same module or type name (case-sensitive).
- Same public member names within the type.
- Same public member arity (argument count).
- Implementation body may differ.

If the comparison script is not ready at experiment time, apply
Dimension 3 manually: spot-check 10 randomly selected modules from
the baseline against the test repo, estimate %.

| Score | Numeric | Condition |
|-------|---------|-----------|
| PASS | 1.0 | ≥80% of baseline public types present with compatible signatures |
| PARTIAL | 0.5 | 50%–79% present |
| FAIL | 0.0 | <50% present |

---

## Dimension 4: Structural similarity

**Weight:** 15%
**Automatable:** Yes
**Interpretation:** Informational — divergence here is a *finding*,
not a failure beyond its 15% weight.

**What it measures:** Whether the module/namespace file layout of
`src/Core/*.fs` is recognizable. Low structural similarity indicates
that the seeded specs do not constrain module-file shape — design
freedom exists. This is useful research data regardless of direction.

**Measurement commands:**

```bash
# In Zeta repo (baseline): list .fs module file names (excludes Core.fsproj)
ls src/Core/*.fs | xargs -n1 basename | sed 's/\.fs$//' | sort > /tmp/zeta-modules.txt     # ~81 entries

# In test repo
ls src/Core/*.fs | xargs -n1 basename | sed 's/\.fs$//' | sort > /tmp/test-modules.txt

# Overlap %
comm -12 /tmp/zeta-modules.txt /tmp/test-modules.txt | wc -l
# divide by 81, multiply by 100
```

| Score | Numeric | Condition |
|-------|---------|-----------|
| RECOGNIZABLE | 1.0 | ≥90% of the 81 module file names recreated |
| PARTIAL | 0.5 | 70%–89% of module file names recreated |
| DIVERGENT | 0.0 | <70% recreated — structural finding for 081KR2E4K0008QG0R003KQKYTJ |

**081KR2E4K0008QG0R003KQKYTJ note:** A DIVERGENT score is recorded with classification
`structural-divergence` and fed to 081KR2E4K0008QG0R000JGRY8N (spec-gap backport). It
signals that the specs do not constrain module layout sufficiently
for deterministic recreation.

---

## Dimension 5: Substrate recovery

**Weight:** 10%
**Automatable:** Partial — file-presence check is automatic;
quality assessment requires human review (≤15 minutes).

**What it measures:** Whether the fresh-context agent recreated
factory tooling beyond code — skills, agents, governance docs, CI
workflows, factory automation scripts. All of these were excluded
from the seed (081KR2E4K0008QG0R002PHZR58: "the answer key").

**Measurement approach:**

Check presence of any of the following factory surfaces in the test
repo output:

| Factory surface | Presence check |
|-----------------|----------------|
| `.claude/skills/**` | `ls .claude/skills/ 2>/dev/null` |
| `.claude/agents/**` | `ls .claude/agents/ 2>/dev/null` |
| `tools/github/**` or `src/Core.TypeScript/hygiene/**` | `ls tools/` |
| `GOVERNANCE.md` or `AGENTS.md` | `ls *.md` |
| `.github/workflows/**` | `ls .github/workflows/ 2>/dev/null` |
| `tests/**/*.fs` | `find tests/ -name "*.fs" -print -quit 2>/dev/null` |

Count of recreated factory surfaces above: 0, 1, ≥2.

| Score | Numeric | Condition |
|-------|---------|-----------|
| FULL | 1.0 | `src/**` code recreated AND ≥2 factory surfaces recreated |
| PARTIAL | 0.5 | `src/**` code recreated but 0–1 factory surfaces; OR factory surfaces without code |
| NONE | 0.0 | Neither code nor factory surfaces in recognizable form |

**Interpretation note:** PARTIAL (code only, no factory tooling) is
the expected baseline outcome — factory tooling was not seeded and
is not required by any spec. FULL would be a significant positive
finding validating spontaneous factory reconstruction. NONE would
falsify the regenerable claim entirely.

---

## Overall scoring formula

```
score = Dim1 × 0.30 + Dim2 × 0.25 + Dim3 × 0.20 + Dim4 × 0.15 + Dim5 × 0.10
```

| Verdict | Score range | Interpretation |
|---------|-------------|----------------|
| FULL PASS | ≥0.85 | Regenerable claim validated — spec coverage sufficient |
| STRONG PARTIAL | 0.60–0.84 | Partially validated; 081KR2E4K0008QG0R000JGRY8N spec-gap backports explain remainder |
| WEAK PARTIAL | 0.40–0.59 | Significant gaps; regenerable claim needs qualification |
| FAIL | <0.40 | Regenerable claim falsified at 37% spec-coverage level |

**Glass-halo discipline:** the verdict is honest regardless of
direction. A FAIL finding is more valuable than a suppressed partial.
081KR2E4K0008QG0R003KQKYTJ preserves findings verbatim.

---

## Dimension summary

| # | Dimension | Weight | Automatable | Tool / command |
|---|-----------|--------|-------------|----------------|
| 1 | Build gate equivalence | 30% | Yes | `dotnet build -c Release && dotnet test Zeta.sln -c Release --no-build` |
| 2 | Spec coverage | 25% | Yes | `dotnet test --filter Category=OpenSpec` |
| 3 | Functional equivalence | 20% | Yes (081KR2E4K0008QG0R0035HNPG1 prereq) | `bun tools/bootstrap-razor/compare-api-surface.ts` |
| 4 | Structural similarity | 15% | Yes | `src/Core/*.fs` basename overlap |
| 5 | Substrate recovery | 10% | Partial | file presence check + ≤15-min review |

## Cited by

- **081KR2E4K0008QG0R0035HNPG1** — apply this rubric to score 23-hour test output
- **081KR2E4K0008QG0R003KQKYTJ** — record dimension scores, overall verdict, spec-gap candidates for 081KR2E4K0008QG0R000JGRY8N
