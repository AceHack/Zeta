# AGENTS.md — how AI and humans should approach Zeta

## Status (authoritative)

**Pre-v1 greenfield. No production users.**

## What this means in practice

- **Large refactors are welcome.** If an abstraction isn't paying
  rent, rip it out. If a file doesn't compose well with the rest,
  redesign it.
- **Backward compatibility is not a constraint.** Break whatever
  needs breaking. No downstream callers will file an issue.
- **The tests are the contract.** If a change keeps the test suite
  green, the change is acceptable. If a claim lives only in a
  docstring with no test behind it, that claim isn't real yet and
  a reviewer should call it out (`.claude/skills/claims-tester/`).
- **Publication-grade claims drive priority**, not installed-base
  preservation. See `docs/ROADMAP.md` research list.
- **Research-paper fit > incremental polish.** If we can publish
  a result, that's higher leverage than shaving 5% off an already-
  fast path.

## How humans should treat contributions

- Assume a review will be harsh (see
  `.claude/skills/harsh-critic/`). Welcome the findings.
- Claims in doc-comments are subject to the claims-tester
  (`.claude/skills/claims-tester/`). Either defend the claim
  with a test or soften the wording.
- Imports from sibling projects or prior research should be
  rewritten against **latest published research**, not the
  donating project's current state. Pre-v1 means we're not stuck
  with 1990s patterns.

## How AI agents should treat this codebase

- **Prefer bold refactors** over polite patches when the refactor
  removes a bug class.
- **Always run `dotnet test Dbsp.sln` after changes.** 447+ tests,
  0 warnings, 0 errors is the gate.
- **Check the 17 reviewer skills** in `.claude/skills/` and
  `docs/REVIEW-AGENTS.md` — each represents a bug class to avoid.
- **Pull latest cutting-edge research** — agents reviewing upstream
  projects should treat those projects as inspiration, not gospel.
  If a donor project's event log is SQLite-shaped because it
  bootstrapped from SQLite, reimplement against FASTER's
  HybridLog / TigerBeetle grid blocks / SlateDB's writer-epoch CAS —
  **latest and best**, not donated-legacy.
- **All user-visible errors are `Result<_, DbspError>` or
  `AppendResult` style**, not exceptions. This is a hard rule —
  exceptions break referentially-transparent reasoning the whole
  algebra depends on.

## The three load-bearing values

1. **Truth over politeness.** Claims that fail tests get fixed, not
   softened.
2. **Algebra over engineering.** The Z-set / operator laws define
   the system; implementation serves them.
3. **Velocity over stability.** Pre-v1. Ship, break, learn.

## What we borrow, what we build

Borrow from: DBSP (Budiu et al. VLDB'23), FASTER (MSR), TigerBeetle
(Antithesis DST lineage), Datomic (AEVT/AVET), XTDB 2 (Arrow
bitemporal), Materialize / Feldera (incremental SQL), Reaqtor (IQbservable
persistence), SlateDB (CAS manifests), LZ4 / XxHash3 (perf primitives),
Apache Arrow + Flight (wire format).

Do NOT borrow: SQLite file format, COBOL / 1990s patterns, exception-
based error control flow, full-log-in-memory designs, synchronous-
only I/O, "defer all major version bumps", "protect v0 backwards
compat".

## Contributor required reading

- `docs/category-theory/ctfp-milewski.pdf` — category-theory
  foundations that the operator algebra rests on.
- `docs/ROADMAP.md` — what's shipped, what's next, what's research.
- `docs/REVIEW-AGENTS.md` — the 17 reviewer personas and their
  test-category cross-references.
- `docs/INSTALLED.md` — what's on the build machine and why.
- `docs/MATH-SPEC-TESTS.md` — every algebraic law that's in CI.
- `docs/FOUNDATIONDB-DST.md` — what we borrow from Will Wilson's
  deterministic simulation testing.

## Agent-specific

- When an AI agent finds a drift between spec and code, the **spec
  might be wrong, not the code**. Check both. Spec bugs surface as
  TLC failures that trace back to the spec, not the implementation.
- When an AI agent completes a reviewer pass, write findings to
  file (`docs/REVIEW-ROUND-N.md`) so the next agent round can cite
  the prior round's findings and look for regressions.
- When an AI agent installs a tool, update `docs/INSTALLED.md`
  with version + why + how.

## Repo-wide rules

Numbered governance rules live in [`GOVERNANCE.md`](GOVERNANCE.md).
`AGENTS.md` carries philosophy, values, and onboarding; the
rule list is in `GOVERNANCE.md` so each doc stays focused.

References in other docs use the form `GOVERNANCE.md §N`.
Rule numbering is stable — when a rule evolves, the number
stays put.

<!-- numbered rules intentionally live in GOVERNANCE.md -->
