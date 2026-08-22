# Five ways a check's domain diverges from its apparent scope — one day's instances

**Date:** 2026-08-18 · **Register:** structural (each entry is a measured instance, not a category
invented in advance) · **Origin:** five separate findings on one day, each discovered independently
by a different lane.

## The claim

The vacuity class is already named here — *a check that cannot fail is not a check* — and
`toy-is-free-metered-must-be-earned.md` plus `mutation-runner.ts` exist to catch it. What follows is
**not** a new class. It is a **taxonomy of mechanisms** by which an existing, well-intentioned check
ends up vacuous, collected because five turned up in a single day with five *different* mechanisms
and one shared signature:

> **The check's EFFECTIVE domain was narrower than its APPARENT domain, and nothing in the green
> signal carried the difference.**

Each was a real check, written in good faith, that ran and reported success over a set that did not
contain the thing it was believed to cover.

## The five

### 1. Stale roster row — the pin stopped constraining

`registry/wall-clock-test-allowlist.json` pinned **3** `setTimeout` sites in a file that, after
another lane's fix, had **0**. The row no longer excluded anything.

**Caught by:** the guard's own anti-vacuity check, which refuses a row that constrains nothing —
*"stale row, no longer constraining anything."* Notably the row had been **written as a handoff**
that predicted this exact red, so the failure was a designed signal rather than a defect.

### 2. Empty glob — the lint ran over nothing

`bunx markdownlint-cli2 "<path>"` against a path matching **no files** exits **0**. A lint that
scanned zero files is indistinguishable, in its exit code, from a lint that scanned many and found
nothing wrong.

**Caught by:** a commit reporting a clean working tree when a diff was expected. The lint's green had
already been accepted as evidence.

### 3. Constant-tail assertion — the asserted substring could not vary

`zflash`'s wrong-architecture warning shipped with **every interpolation empty** (born empty, not
stripped — confirmed by `git log -S`). **Ninety tests stayed green** because each asserted a
substring of the message's **constant tail** — `toContain("cannot be read")` — and the constant part
cannot fail regardless of what the variable part contains.

**The falsifier that fixed it is the sharp artefact:** reverting turns exactly the 4 new tests red
while all 90 originals stay green. **That green is the measurement of the coverage gap**, not merely
of the bug.

### 4. Trigger wider than validator scope — the lane could not see the change

`helm-validate.yml` **triggered** on `infra/k8s/**`, while its validator scanned only
`infra/k8s/applications`. A change under `infra/k8s/bootstrap/` therefore **ran a lane that
structurally could not see it**, and the lane reported green.

**Caught by:** booting real K3S with the manifests as they stood on `main` — measurement rather than
reading. The bootstrap had never worked; steps 3–9 of the documented order never happened.

### 5. Reading a verdict without its provenance — the observer's version

Not a check defect but the **consumer** side of the same error, and worth including because it is the
one an operator commits. GitHub's status rollup retains **stale** entries, so a superseded `FAILURE`
and a current `FAILURE` are identical at a glance. Triage read conclusions **without** asking which
run produced them — three separate misreads in one session, including chasing a "failure" that had
self-corrected to `SUCCESS` two minutes later.

**Fixed by** grouping by check name and taking only the newest conclusion — i.e. by reading the
*provenance*, which is the meta-fact, not the verdict.

## What the fixes had in common — and it is the actionable part

Every instance that got fixed **well** was fixed the same way, independently, by different lanes:

> **Make the check report its DOMAIN, not just its verdict.**

- the ambient-time guard now prints *"1066 test files scanned; 11 elapsed-time observations named and
  counted"*
- the collation ratchet names the offending file and its counts — `found=1 allowed=0 kind=new-file`
- the apt guard names the **stalled mirror** and distinguishes it from a package error, instead of
  dying silently at its timeout
- the bootstrap falsifier reports `20 passed, 1 failed` against the pre-fix file

**Why that specific remedy works:** a verdict is one bit and carries no information about coverage. A
reported domain makes a *shrinking* domain visible as a **falling number** rather than an unchanged
green. Instance 1 was caught precisely because a count was pinned; instances 2–4 were invisible
because nothing was counted.

**The design rule this suggests** (stated as an observation, not proposed as a rule — rule additions
here are razored and carry a cooling period):

> A check should emit **what it covered**. If its output cannot distinguish *"scanned 1000, found
> nothing"* from *"scanned 0"*, its green is not evidence.

## The honest limit

This is a taxonomy of **five instances in one day**, not a survey. It says nothing about base rates,
and five is exactly the sample size at which a pattern feels more established than it is —
`numerology-vs-number-theory.md` warns that a dense cluster of matches is a prompt to check
independence, not a score. **They are genuinely independent** (five lanes, five mechanisms, no shared
code path), which is what makes the shared signature worth recording; but the correct register is
*"five mechanisms observed"*, not *"the complete taxonomy"*. A sixth mechanism should be expected
rather than treated as surprising.

## Pointers

- [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — the vacuity class this taxonomies
- [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) — why five clustered instances is a prompt to check independence
- `src/Core.TypeScript/hygiene/audit-ambient-time-in-tests.ts` · `registry/wall-clock-test-allowlist.json` — instance 1
- `src/Core.TypeScript/zflash/lib.ts` + `lib.test.ts` — instance 3
- `infra/k8s/tests/validate-bootstrap.ts` · `.github/workflows/helm-validate.yml` — instance 4
- `db/uncertainty/081M0BH05N7087G0R0037KFCJD-*` — instance 4's ΔU, witnessed
