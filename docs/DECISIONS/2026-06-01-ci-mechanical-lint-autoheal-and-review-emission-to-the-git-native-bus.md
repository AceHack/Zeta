# ADR: CI mechanical lint auto-heal + emitting review results to the git-native bus

**Status:** proposed (pending Max review — requested by operator 2026-06-01)
**Date:** 2026-06-01
**Backlog:** (to be filed on acceptance — tracks the review-emission build-out)
**Owner:** operator (shaping) + Max (reviewer) + Otto-CLI synthesis

## Context & Problem Statement

PR review/lint friction is a first-class system-health signal (see the related
ADR [`2026-05-29-monitoring-and-reducing-pr-review-friction.md`](2026-05-29-monitoring-and-reducing-pr-review-friction.md),
081KSRGFP0008QG0R000J9Y634, which *measures* the friction coefficient). A large share of that
friction is **mechanically fixable** — `markdownlint --fix`, `prettier --write`,
`dotnet format`, `semgrep --autofix` (for rules with a `fix:`) — i.e.
deterministic, zero-LLM transforms. The remainder (actionlint workflow logic,
semgrep rules without a `fix:`, type/logic errors) needs **intelligence**.

The operator is winding branch protection *down* toward fewer/no required gates
(arm + macOS already de-required 2026-06-01). The complement to "fewer gates" is
"keep the gates that remain frictionless" — auto-**heal** the mechanical class so
a fixable nit never blocks a merge.

A concrete first piece is authored + in flight (PR #6393, not yet merged):
`lint-autofix.yml` runs the mechanical `--fix` tools on a PR and applies the heal
back (now via a two-job privilege-separated split — see the security ADR), at
version-parity with `gate.yml`. This ADR is the *design pass* the
operator asked for on the **larger** shape it implies:

> operator 2026-06-01: *"we can have filed github workflows add a file to the bus
> or some review folder or something for the mechanical reviews ... we probably
> should send this off to design and do an ADR and this is one Max will want to
> put his feedback on."*

The problem this ADR closes: **where do CI review/autofix workflows emit their
results so the agentic organization can consume them as substrate** — and how do
the mechanical and intelligence halves compose — without re-inventing the
git-native bus or adding heavy infrastructure?

Constraints honored: substrate-or-it-didn't-happen (results must be git-native,
not only host-durable PR comments); the git-native bus (`docs/agent-bus/`,
081KSXN940008QG0R00171YAZW) is the canonical cross-machine substrate; "no directives, only
observations" (a review record is an observation, not a command); GITHUB_TOKEN
pushes do not re-trigger workflows (the re-trigger wrinkle from #6393).

## Considered Options

* **Option 1: PR comments only** — workflows post mechanical-review findings as
  PR comments / review threads; no git-native artifact.
* **Option 2: Commit-back heal only (status quo of #6393)** — mechanical fixes
  are committed back; nothing is emitted as a structured review record.
* **Option 3: Commit-back heal + emit a review record to the git-native bus**
  (`docs/agent-bus/`) — each workflow run appends a ZetaId-keyed review
  observation (what it healed / what it left for intelligence) the org consumes.
* **Option 4: Dedicated review folder** (e.g. a `docs/reviews/` sibling of
  `docs/pr-discussions/`) — review records land as files in a review folder
  rather than the bus.
* **Option 5: Hybrid** — mechanical step commits the heal back AND emits a bus
  observation; the **intelligence** step is a *separate agent-in-Actions
  workflow* (accelerator / local-LLM direction) that consumes the bus record and
  emits its own review observation for what mechanical could not fix.

## Pros & Cons of the Options

### Option 1: PR comments only

* **Pros:** Trivial; visible inline; no new substrate surface.
* **Cons:** Host-durable, not git-canonical (violates substrate-or-it-didn't-
  happen for doctrine-relevant records); not consumable by the agentic org as
  substrate; no cross-machine bus presence; ephemeral.

### Option 2: Commit-back heal only (status quo of #6393)

* **Pros:** Authored + in flight (#6393); removes the most common friction
  (markdown) with minimal surface; no intelligence; idempotent.
* **Cons:** No structured record of *what* was healed / *what remains*; the
  intelligence layer has nothing to consume; no observability of the heal as a
  system-health signal (the 081KSRGFP0008QG0R000J9Y634 friction monitor can't see it cleanly).

### Option 3: Commit-back heal + emit a bus review record

* **Pros:** Git-native + cross-machine (081KSXN940008QG0R00171YAZW); the org consumes heal/review
  records as observations; composes with the 081KSRGFP0008QG0R000J9Y634 friction monitor; one
  canonical surface.
* **Cons:** Depends on `docs/agent-bus/` being populated (081KSXN940008QG0R00171YAZW not yet on
  main); bus-record schema for "review observation" needs defining.

### Option 4: Dedicated review folder

* **Pros:** Simple files; `docs/pr-discussions/` is an existing review-folder
  precedent; no dependency on the bus landing.
* **Cons:** A second review surface parallel to the bus (DV2.0 smell — two
  change-rate-similar substrates); risks divergence from the git-native bus the
  rest of the org coordinates on.

### Option 5: Hybrid (mechanical commit-back + bus emission; intelligence as a separate agent-in-Actions step)

* **Pros:** Cleanest separation — mechanical (free, zero-LLM, deterministic) and
  intelligence (agent-in-Actions, metered) are distinct workflow steps composing
  through one git-native bus record; matches operator framing ("for the
  intelligence stuff ... that's [a] workflow step" too); each half independently
  shippable; the bus record is the seam.
* **Cons:** Most moving parts; needs the bus record schema AND the
  intelligence-step runtime (rides on the accelerator / local-LLM substrate,
  which is in progress); the re-trigger wrinkle (AUTOFIX_TOKEN) applies to the
  commit-back half while required gates exist.

## Decision Outcome

* **Chosen Option:** **PROPOSED — leaning Option 5 (Hybrid), pending Max.** It is
  the only option that (a) keeps mechanical free + deterministic, (b) gives the
  intelligence layer a substrate to consume, (c) stays git-native via the bus
  rather than a parallel review surface, and (d) matches the operator's
  "mechanical step + intelligence step, composing through the bus" framing. The
  mechanical half is authored + in flight (#6393); the bus-emission + intelligence-step
  halves are the build-out this ADR gates on review.

  This decision is **explicitly held open for Max** — he owns the corporate-loop
  / review surface and the operator flagged this as one he will want to shape.

* **Consequences:**

  * **Positive:** Mechanical friction auto-heals for free; review results become
    git-native observations the org (and the 081KSRGFP0008QG0R000J9Y634 friction monitor) can
    consume; mechanical and intelligence layers compose through one seam (the bus
    record), each shippable on its own; no parallel review surface.
  * **Negative/Costs:** Depends on 081KSXN940008QG0R00171YAZW populating `docs/agent-bus/` for the
    emission half; requires defining a "review observation" bus-record schema;
    the intelligence step depends on the accelerator / local-LLM runtime; the
    AUTOFIX_TOKEN re-trigger wrinkle persists until required gates are removed.

## Open questions for Max

1. **Emission target:** git-native bus (`docs/agent-bus/`, Option 3/5) vs a
   dedicated review folder (Option 4) — does the corporate/review loop want
   review records on the bus or in a folder it owns?
2. **Review-record schema:** what fields does a mechanical-review observation
   carry (PR id, ZetaId, healed-set, unfixable-remainder, intelligence-needed
   flag, tool versions)?
3. **Intelligence-step runtime:** ride the accelerator / local-LLM substrate, or
   a different agent-in-Actions entry point?
4. **Required-gate re-trigger:** add an `AUTOFIX_TOKEN` PAT/App-token now (so the
   gate re-runs on healed commits while gates still exist), or accept the
   nudge-by-loop behavior since gates are being removed anyway?
5. **Secure-checkout pattern:** the mechanical commit-back workflow (#6393) trips
   CodeQL's "checkout of untrusted code in trusted context" — its privileged
   (`contents: write`) job executes the PR's own `install.sh` / `bun install`
   lifecycle scripts. The same-repo `if`-gate + `pull_request` (not
   `pull_request_target`) close the untrusted-fork case (forks skip the
   privileged job + get no secrets); the residual is same-repo (trusted-fleet)
   PRs. The canonical legitimate fix is a **two-job split**: an `on: pull_request`
   read-only job runs the fixers + uploads the patch as an artifact, and an
   `on: workflow_run` privileged job only *applies* the patch (no untrusted
   execution under write perms). Which does the review loop want —
   same-repo-`if`-gate-with-justification, two-job-split, or a GitHub-App token?
   (This interacts with Q4 — a GitHub-App token answers both.)

## Composes with

* PR #6393 — the mechanical lint auto-heal workflow (the first piece, in flight).
* [`2026-05-29-monitoring-and-reducing-pr-review-friction.md`](2026-05-29-monitoring-and-reducing-pr-review-friction.md)
  (081KSRGFP0008QG0R000J9Y634) — measures friction; this ADR reduces a class of it + structures the
  review-emission the monitor can consume.
* 081KSXN940008QG0R00171YAZW — git-native cross-machine bus (`docs/agent-bus/`), the proposed
  emission target.
* `accelerator-move-next.yml` + `accelerator-local-llm-validate.yml` — the
  agent-in-Actions / local-LLM substrate the intelligence step rides on.
* The algebra ladder (G-Set ⊂ Bag ⊂ Z-set) — review observations on the bus are
  a G-Set/Z-set of ZetaId-keyed records, consistent with the database-design ADR.
