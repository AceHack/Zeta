# ADR: Secure GitHub Actions autofix — privilege separation (the two-job split) as the pwn-request defense

**Status:** accepted (operator-approved 2026-06-01; written as a security teaching piece for Max)
**Date:** 2026-06-01
**Backlog:** (none — security-pattern ADR; resolves OQ5 of the CI-review-emission ADR)
**Owner:** operator (approved the fix + framed it as a teaching opportunity) + Max (security learner/reviewer) + Otto-CLI synthesis

## Context & Problem Statement

The mechanical lint auto-heal workflow (#6393) has to do two things to a PR:

1. **Execute** the fixers (`install.sh` bootstrap + `bun install` + `markdownlint --fix` + `prettier --write`) — which requires checking out **the PR's own code** and running it.
2. **Write** the result back (commit + push to the PR branch) — which requires `contents: write`.

Doing both in **one job** is the classic **pwn-request** shape, and CodeQL flagged it on #6393 as *"checkout of untrusted code in trusted context."* This ADR records why that pattern is dangerous and why the fix is **privilege separation** (a two-job split), as a teaching piece.

### The threat, in plain terms (teaching)

A GitHub Actions job is dangerous when it holds **both** of these at once:

* **Privilege** — `contents: write`, or access to secrets (a token that can push, publish, or read credentials), AND
* **Untrusted execution** — it checks out a pull request's code and *runs* it.

The trap is that "running it" is broader than "run the tests." Bootstrapping the toolchain runs PR-controlled code: `bun install` executes the PR's `package.json` lifecycle/postinstall scripts; `install.sh` runs whatever the PR made it run. So a PR author can make arbitrary code execute **inside the privileged job**, where it can steal the secret, push malicious commits with the write token, or tamper with the repo. That is a "pwn request."

Two GitHub event types matter here:

* **`pull_request_target`** — runs in the **base** repo's context **with secrets and write**, and is the canonical footgun: if it also checks out + runs the PR head, any fork can pwn it. We do **not** use this.
* **`pull_request`** — fork PRs run with a **read-only** token and **no secrets**, which closes the fork case. But a job that *adds* `contents: write` (as the heal job must) is privileged again for **same-repo** PRs, so same-repo contributor code still executes with write. Our same-repo `if`-gate narrowed the blast radius to trusted-fleet PRs, but it did not remove the structural "privilege + untrusted execution in one job" shape — which is what CodeQL (correctly, conservatively) flags.

## Considered Options

* **Option 1: Single privileged job (status quo of #6393)** — one job: checkout head, execute fixers, commit + push. Mitigated only by the same-repo `if`-gate + `pull_request`.
* **Option 2: Same-repo `if`-gate + documented justification** — keep one job; argue the gate makes it safe enough; dismiss the CodeQL alert.
* **Option 3: Two-job privilege separation (the split)** — Job A (`pull_request`, `contents: read`, no secrets) executes the fixers and uploads the resulting diff as an **artifact**; Job B (`workflow_run`, `contents: write`) downloads the patch and **applies** it (git-apply + commit + push) **without executing any PR code**.

## Pros & Cons of the Options

### Option 1: Single privileged job

* **Pros:** Simplest; one file; already written.
* **Cons:** Structural pwn-request shape (privilege + untrusted execution together); CodeQL-flagged; residual same-repo-contributor risk; not a pattern to propagate.

### Option 2: Same-repo `if`-gate + dismiss the alert

* **Pros:** No restructure; the gate genuinely closes the fork case.
* **Cons:** Dismissing a security finding sets a bad precedent; leaves the structural shape in place; the residual (a lower-trust same-repo collaborator's PR code running with the write token / any `AUTOFIX_TOKEN`) is real; teaches the wrong lesson.

### Option 3: Two-job privilege separation

* **Pros:** **Removes the dangerous combination entirely.** Job A *executes* untrusted code but has **no privilege** to abuse (read-only, no secrets). Job B *has* privilege but **executes no untrusted code** (it only git-applies a data patch + pushes). Neither job holds both halves. The **artifact is the trust boundary**: the read-only job hands the privileged job a *patch (data)*, never code-to-run. This is the GitHub-documented secure pattern for "write back based on PR content," and it eliminates the CodeQL finding *legitimately* (the structure is safe), not by dismissal.
* **Cons:** More moving parts — two workflow files, an artifact hand-off, a `workflow_run` trigger; the apply job still *checks out* the head branch to apply the patch, which is safe **only because it runs none of the PR's scripts** (git-apply + commit + push are not code execution).

## Decision Outcome

* **Chosen Option:** **Option 3 — the two-job privilege-separation split**, because it is the only option that removes the structural pwn-request shape rather than arguing around it, and it does so by a clean, reusable principle: **never let one job hold both privilege and untrusted execution.**

* **Consequences:**
  * **Positive:** The autofix is safe by construction (not by trust assumptions); the CodeQL finding is resolved legitimately; the repo gains a reusable secure-write-back pattern + a documented principle for every future write-capable workflow.
  * **Negative/Costs:** Two files + artifact + `workflow_run` plumbing; the GITHUB_TOKEN re-trigger wrinkle (ADR #6394 OQ4) still applies to the apply job's push; the apply job's head-checkout is safe-by-no-execution, a subtlety future editors must preserve (never add a build/test/install step to the apply job).

## Teaching notes for Max (the general principle)

1. **The rule of thumb:** a single CI job must never combine **(write/secrets)** with **(checkout + run untrusted PR code)**. Split them.
2. **`pull_request` vs `pull_request_target`:** prefer `pull_request` (forks get read-only + no secrets). Reach for `pull_request_target` only with extreme care, and never check out + run the PR head under it.
3. **The artifact is the trust boundary:** the read-only job emits *data* (a patch); the privileged job consumes *data*, never code. Crossing privilege levels should only carry data.
4. **"Execution" is broad:** `bun install` / `npm ci` / `install.sh` all run PR-controlled lifecycle scripts. Treat any dependency bootstrap of PR code as untrusted execution.
5. **Defense in depth still helps:** the same-repo `if`-gate + `pull_request` are kept *on top of* the split — privilege separation is the structural floor, the gate is the extra fence.

## Composes with

* PR #6393 — the workflow this ADR's split is implemented in (resolves its CodeQL finding).
* The CI-mechanical-lint-autoheal + review-emission ADR (**PR #6394**, landing
  alongside this one; file `docs/DECISIONS/2026-06-01-ci-mechanical-lint-autoheal-and-review-emission-to-the-git-native-bus.md`
  on merge) — this ADR **resolves its OQ5** (secure-checkout pattern = the
  two-job split). Referenced by PR number to avoid a dead link before #6394 merges
  (Copilot xref, #6393).
* [`2026-05-29-monitoring-and-reducing-pr-review-friction.md`](2026-05-29-monitoring-and-reducing-pr-review-friction.md)
  (081KSRGFP0008QG0R000J9Y634) — the friction this autofix reduces, now reduced *safely*.
