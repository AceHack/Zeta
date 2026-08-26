# ADR: The multi-repo + hat-credential cutover — an ordered sequence, not another round

**Status:** Proposed — steps S1, S3, S6, S7 and S9 are gated-class and need Aaron's sign-off
**Date:** 2026-08-26
**Author:** the shadow (Claude Opus 5)
**Basis:** `origin/main` at `d3396ab838`
**Supersedes nothing.** Extends `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
by reordering its Stage 1 and inserting three prerequisites in front of it.

## What this is, and what it deliberately is not

Aaron, 2026-08-26: *"lets route pushing this forward — we've been doing this for a while
but i'd like to cut over, and also cut over to multi repo design."*

The split has been through four design rounds. **This document adds no fifth.** It does not
re-argue whether to split, does not re-measure the cache, does not re-derive the closure,
and does not propose a new cut. It takes the decided destination and produces the thing the
rounds never produced: **an ordered sequence of steps, each with a reversal, each with a way
to tell whether it worked.**

Where a step cannot be reversed it is marked **IRREVERSIBLE — needs Aaron**, because an
irreversible action is a gated class under
[`no-directives`](../../.claude/rules/no-directives.md) and standing authorization does not
reach it.

Nothing in this document has been executed. **No repository was created, no code moved, no
secret or GitHub App created or modified.**

### Why `docs/DECISIONS/` and not `docs/research/`

Two reasons, and the second is the load-bearing one.

1. This is a **commitment with an order**, not a measurement. Its content is a sequence
   somebody executes, and half its steps are gated-class. That is ADR-shaped.
2. **`.markdownlint-cli2.jsonc` ignores `docs/research/2026-*-*.md`.** An `rc=0` from
   `markdownlint` on a research file is a check that did not run — the vacuity class, in the
   place a cutover plan can least afford it. `docs/DECISIONS/` is linted, so this file is
   held to a check that can fail. It was linted before landing.

---

## 0. What is already decided — do not relitigate any row

| decided | where | status |
|---|---|---|
| Split into multiple repos; peer repos, **not** submodules (the triple is a cycle) | ADR `2026-04-22` §Connection mechanism | Proposed, unexecuted |
| Cross-repo glue = version-pin file + `repository_dispatch`, **never** a mandatory `ace` | ADR `2026-04-22`; [`clone-at-tag-stays-sufficient`](../../.claude/rules/clone-at-tag-stays-sufficient.md) | rule carved, lint shipped |
| Buying more Actions cache is **off the table** | Aaron 2026-08-26: *"i'd rather split out to multi repo than try to purchase more cache, this is the long term plan"* | decided |
| The change-rate axis (CCP) and the closure axis (CRP) select *different* candidates and both are real | round 2 §9; round 3 §9 | measured |
| Scaffolding for repo creation is **built and dry-run verified** — `src/Core.TypeScript/scaffold/create-repo.ts`, 12 planned ops/repo, gated behind `.github/workflows/scaffold-stage1-create-repos.yml` | workitem `081KRFA460008QG0R001H98EXJ`, 8 PRs merged 2026-05-13 | one `workflow_dispatch` away |
| A surface declares **what** it needs as data, never **how** to get it; a surface set **is** a dependency closure, so declarations come *before* the split | `docs/research/2026-08-20-surface-declarations-are-data-*` §0, §4, §6b | design, unbuilt |
| Artifact escrow = **Harbor in escrow configuration** (replication + immutability + no retention), never Harbor's proxy cache | `docs/research/2026-08-26-dependency-escrow-helm-selection-*` (PR #15591, merged) | selected, undeployed |
| Roles are legacy; **hats grant claims, bounded in duration** | `docs/research/2026-08-09-every-node-is-its-own-identity-provider-*` §C; `2026-08-26-hat-persona-role-*`; `GOVERNANCE.md` §16 | carved across 20 dated statements since 2026-05-08 |

Aaron, 2026-08-26, on the credential half: *"we should avoid roles and think in hats, we
have lots of documentation on this."* He is right that the documentation exists. What does
not exist is the bridge: **the hats corpus never mentions GitHub tokens, and the
credential-role work never mentions hats.** §2 is that bridge and it is the only genuinely
new argument in this document.

---

## 1. The measured constraints — cited, not re-derived

Every number here is `metered` at its own source. None was re-measured for this document
except the two rows marked *(measured here)*.

| fact | value | source |
|---|---|---|
| `Zeta-core` charged cache at peak | **11.17 GiB** (10.04 dotnet+nuget + 1.13 interp) — **over the 10 GB ceiling by itself** | sawtooth §5.2–5.3 |
| Share of the logical working set in blobs **no candidate owns** | **59%** (union 10.24 + mise 2.31 of 21.27 GiB) | sawtooth §5.3(1) |
| Job definitions sharing the one `install-v2` tar | **23**; a cold key costs **12 simultaneous installs + ~11 wasted uploads**, 31 lost reservations over 3 runs | sawtooth §9.4–9.5 |
| `zeta-formal` cache cost | **0.02 GiB** — the cache axis has **no opinion** on this cut | sawtooth §5.3(3) |
| `zeta-formal` closure | 2 live units, 2 toolchains, **2,977 MB = 26% of the union**, **0 external packages** | round 3 §7 |
| Union footprint owned by **exactly one** candidate | **87%** (10,055 of 11,533 MB) | round 3 §7 |
| `dotnet-macOS-ARM64` alone | **1,858 MB = 20% of the entire ceiling**, for one leg of one toolchain | sawtooth §5.3(2) |
| `Zeta-core`'s ref multiplier | **2.6×** (26 entries / 10 keys), and it **travels with the repo** — one dotnet component absorbs 2,182 of 2,282 build-touching commits (96%) | round 3 §6, sawtooth §5.3 |
| Commits on `main` that were never the `head_sha` of a `gate` push run | **98 of 245 (40.0%)**; discriminator is the merge actor — `github-actions[bot]` **0 runs, 20/20**, `AceHack` (PAT) **runs, 18/18** | `2026-08-26-three-verdict-loss-mechanisms-*` §2 |
| PR-archive coverage under bot merges | **747 of 765 (97.6%)** eligible PRs bot-merged and unarchived; **530 of 539 (98.3%)** archived ones were user-merged. **Nothing goes red.** | `.github/workflows/agent-heartbeat.yml` L688-711 |
| `build-graph.json` completeness over the CI domain | **rc=0** — 119 targets, 37 jobs, 4 leg-bearing workflows, 3 targets declared UNCOVERED and forcing FULL mode *(measured here, at `d3396ab838`)* | `hygiene/audit-build-graph-completeness.ts` |
| GitHub credentials in CI | **81 workflows · 8 long-lived GitHub PATs · 0 GitHub App tokens** *(measured here)* | `git grep 'secrets\.' .github/workflows` |

Two of these deserve to be read together, because together they are the whole argument for
the ordering in §3:

> **59% of the working set is in a blob a repo boundary relocates rather than shrinks**, and
> **`Zeta-core` is over the ceiling before it is charged any share of that blob.**

---

## 2. A PAT is a role; an App installation token is a hat — and this is on the critical path

### 2.1 The role table is bigger than three, and already drifting

The brief for this work named three PATs. Measured at `d3396ab838`, there are **eight**, in
81 workflows:

| secret | charter | refs | consumers |
|---|---|---|---|
| `ZETA_TELEMETRY_FLUSH_TOKEN` | branch-push for flush lanes | 21 | 13 workflows |
| `ZETA_PR_ARCHIVE_TOKEN` | `gh pr create` + **arm auto-merge** | 17 | 15 workflows + 2 TS runners |
| `SCAFFOLD_STAGE1_PAT` | `gh repo create` (org owner; classic `repo, read:org, workflow`) | 5 | `scaffold-stage1-create-repos.yml` |
| `RULESET_ADMIN_TOKEN` | ruleset plan + apply (**Administration: write**) | 3 | `ruleset-apply.yml` |
| `RULESET_READER_TOKEN` | ruleset plan (Administration: read) | 1 | `github-settings-drift.yml` |
| `DRIFT_DETECTOR_PAT` | repo/org settings drift | 1 | `github-settings-drift.yml` |
| `AUTOFIX_TOKEN` | push lint fixes so gates re-trigger | 1 | `lint-autofix-apply.yml` |
| `ACEHACK_MIRROR_TOKEN` | push all branches/tags to the fork | 1 | `mirror-to-fork.yml` |

Plus `ZETA_WORKFLOW_DISPATCH_TOKEN`, a **Cursor Secret** outside the Actions surface.

And the ninth entry in the documented role table, `ZETA_SOCIETY_DISPATCH_TOKEN`, is
**referenced by zero workflows** — its only live consumer is host-side
(`src/Core.TypeScript/planning/society-heartbeat-dispatch.ts`), while the *actual* dispatch
credential in daily use is the Cursor Secret that the role table does not mention. The
three-role model in `docs/security/2026-08-17-society-heartbeat-token-boundary-*.md` is
**two-thirds implemented and already inaccurate**, and two required-gate audits
(`audit-workflow-credential-role-separation.ts`, `audit-workflow-write-token-consistency.ts`)
hardcode its secret names.

At N=1 that is untidy. At N=5 it is 40 long-lived credentials to mint, scope, rotate and
audit, with a role table that has already demonstrated it drifts.

### 2.2 The mapping, checked against the hats doc rather than asserted

`docs/research/2026-08-09-*-hats-grant-claims-bounded-duration-*` §C states three
properties a hat must have. Each is checked against both credential kinds:

| property required of a hat (§C) | long-lived PAT | GitHub App installation token |
|---|---|---|
| **Bounded duration is the default, not an option** — *"an unbounded grant accumulates authority (§3 weight-free); if a binding can be permanent, capture is reachable"* | fails — permanent until revoked | holds — ~1 hour, non-extendable |
| **Expiry needs no coordination to take effect** — lease-shaped, safe under partition | fails — needs a revocation act | holds — the token dies whether or not anyone is watching |
| **Revocation is a −1, not a delete** — auditable retraction on the same stream | partial — revocation is a delete, and a leaked PAT carries the account's whole scope | holds — permission change / uninstall is an appended, auditable event; the identity survives |

And the fourth property, which is the one that decides the ordering:

> A hat carries **direction**, not identity — *"roles are legacy and try to trap identity and
> hats don't"* (Aaron, 2026-08-26). **Widening a PAT changes what the credential IS,
> everywhere, permanently.** Minting a differently-scoped App token for one act changes
> nothing about anything else. **Hats have no episodic memory, so minting and discarding
> costs nothing** — which is exactly why the hat model is O(charters) in repo count and the
> role model is O(repos × charters).

`actions/create-github-app-token` accepts `owner` and `repositories`, so the token is
narrowed **at mint time** to the repo subset the act needs — bounded scope *and* bounded
duration, from one App. Adding repo N+1 is a line in an installation list, not a new secret.

### 2.3 The credential cutover must PRECEDE the first repo, not accompany it

The brief's reading was *at least accompany*. Mine is stronger — **precede** — on three
grounds, and the third is decisive.

1. **Reversibility runs the wrong way.** A credential change at N=1 is a one-file revert with
   the PAT still in place. Creating a repository is the least reversible act in the whole
   sequence. Putting the reversible experiment *after* the irreversible commitment inverts
   the risk ordering for no gain.
2. **Repo #2 must be provisioned at the moment it is created.** If hats are not established,
   `zeta-formal` is born needing its own PAT grants — and the cheapest moment to discover
   that a hat cannot do something is *before* a repo depends on it.
3. **The hat model is already the blocking answer to an open decision on Aaron's desk.**
   `2026-08-26-three-verdict-loss-mechanisms-*` §9 item 3 asks:
   *"Change the merge actor for heartbeat flush PRs from `github-actions[bot]` to the PAT?
   This widens what that credential does, and credential scope is a security-class call."*
   That dilemma exists **only because the credential is a role.** Widening a PAT is a
   permanent change to what it is; minting a merge-scoped App token for that one act is a
   hat and widens nothing. **The credential model is not a prerequisite the split imposes —
   it is the resolution of a question that is already blocking 40% of `main`'s commits from
   getting a gate run.** It pays for itself at N=1.

**Honest limit, stated before anyone relies on it.** A hat at N=1 proves minting and
permission-scoping. It **cannot** prove multi-repo installation scoping, because there is no
second repo. That property is proven in step 6, and step 6 is where it must be checked
rather than assumed.

**Honest counterweight.** Hats do not eliminate long-lived secret material: the App's private
key is long-lived. What changes is the arithmetic and the blast radius — O(charters) keys
instead of O(repos × charters) tokens, rotatable in one place, and a leaked App key carries
the App's declared permissions rather than a human account's entire scope. That is a
reduction, not an elimination, and the plan says so.

**Known blocker, on file.** `docs/handoffs/2026-08-08-helm-validate-workflow-handoff.md`
records that an App installation token lacked `workflows` scope, so writes to
`.github/workflows/**` needed a PAT. GitHub Apps do offer a `Workflows: write` permission;
whether granting it closes this gap is **`consistent with`, not `metered`** — it is
untested here and is a named acceptance check on step 3, not an assumption.

---

## 3. The blocking graph

```
                  [S1] first hat: ruleset-apply -> App token          (reversible)
                        |
                        v
   [S2] per-leg install subset, derived from build-graph.json          (reversible)
                        |            \
                        |             \
                        v              v
   [S3] remaining hats: flush /   [S4] closure-disjointness lint
        PR-create / scaffold           + per-repo clone-at-tag test    (reversible)
        (+ update 2 gate audits)                |
                        \                       /
                         \                     /
                          v                   v
                  [S5] pin + dispatch glue, rehearsed in-tree          (reversible)
                                    |
                                    v
              ===================== IRREVERSIBLE LINE =====================
                                    |
                  [S6] create `zeta-formal`  (needs Aaron)
                                    |
                  [S7] move content into it  (needs Aaron)
                                    |
                  [S8] re-measure; decide the second cut  (open question)
                                    |
                  [S9] revoke the retired PATs  (needs Aaron)
```

Four edges are load-bearing and each is a measurement, not a preference:

- **S2 → S6.** The per-leg install subset is a **prerequisite**, not a follow-up. 59% of the
  logical working set is in blobs no candidate owns; 23 job definitions share one
  `install-v2` tar whose size is a function of `.mise.toml`, not of which repository you are
  in. A `zeta-formal` repo running today's `tools/setup/install.sh` would still provision
  dotnet, rust, go and the rest — a ~1.2 GB install blob for a component whose own toolchain
  costs 0.02 GiB. **A repo boundary relocates the blob; it does not shrink it.**
- **S1/S3 → S6.** §2.3.
- **S4 → S6.** `surface-declarations` §4: *"if two proposed repos have overlapping closures,
  the boundary is wrong — checkable, not a matter of taste."* That falsifier has never been
  built, and the first cut is exactly where it earns its cost. It already has a known finding
  waiting for it: the TLA+ **runners** (`src/Core.TypeScript/formal-verification/run-tlaps.ts`,
  `run-tlc.ts`, `tlc-invocation.ts`) live outside `src/Core.TLA`, so the naive `zeta-formal`
  boundary is drawn through a closure. That is a boundary correction to make **before** files
  move, not after.
- **`clone-at-tag-stays-sufficient` must hold PER REPO.** `lint-clone-at-tag-is-sufficient.ts`
  states its own honest limit: the real falsifier is *"clone repo X at tag T with no `ace` on
  PATH and build it"*, which cannot run until a second repo exists, and *"when the split
  lands, this file is where the real cross-repo build test replaces the proxy."* **That
  replacement is this plan's job, and it is step 4.** The lint is also `ace`-specific by
  construction: a bootstrap surface repointed at Harbor with no upstream fallback passes it
  at exit 0 while violating the invariant it exists to protect. The escrow doc's §10 exit
  test (*"if the escrow is down, can CI still build?" — the answer must be yes*) is
  **unbuilt**. The escrow is otherwise **off this critical path**: it is a CI availability
  mechanism, not a bootstrap resolver, and no step below requires a container runtime, a
  package manager, or GHCR.

---

## 4. The sequence

Each step: what it does · what it unblocks · **how to reverse it** · how you know it worked.

### S1 — One lane off a PAT and onto a hat. *(the first step; this week)*

**Does.** Execute the App bootstrap already written and never run in
`docs/operations/RULESET-RECONCILIATION.md` §6/§8 (which opens: *"Nothing below has been
done."*): register the `zeta-ruleset-reconciler` GitHub App with **Administration: write**
only, install it on `Lucent-Financial-Group/Zeta` only, store `RULESET_APP_ID` /
`RULESET_APP_KEY`, and swap `ruleset-apply.yml`'s single credential reference from
`secrets.RULESET_ADMIN_TOKEN` to `actions/create-github-app-token@<pinned-sha>`.
`RULESET_ADMIN_TOKEN` is left in place, unused.

**Unblocks.** Everything. It is the existence proof that a hat can be minted in Actions and
carry a real privileged act.

**Reverse.** Revert one workflow file (one commit). The PAT still exists and still works.
Uninstall the App. Nothing else in the tree references it.

**How you know it worked.** `ruleset-apply.yml` completes a plan+apply cycle with the same
output as its last PAT run; the token is visibly `ghs_…`; and the App's installation log
shows a token minted and expired. Falsifier: if the App token cannot perform the ruleset
apply, the hat model does not reach admin-class acts and S3's scoping must be redesigned
before anything else moves.

**Gated:** creating a GitHub App and storing its private key is secret creation. **Needs Aaron.**

### S2 — The per-leg install subset, derived from the graph. *(reversible)*

**Does.** Adds one field to the build graph — `kind → toolchains` — and derives
`leg → ⋃ toolchains` from it. Then wires **one** leg (`gate/lint-go`) to install only its
subset, with its own cache key. Nothing else changes.

The map is small because the graph already carries the hard part. Measured at `d3396ab838`,
119 targets across 14 kinds resolve to 32 legs, and every leg's kind set is already a
singleton or near-singleton: `gate/lint-go → {go}`, `gate/lint-python → {python}`,
`gate/lint-rust → {rust}`, `lean-proof/type-check → {lean}`, `tlaps-proof/prove → {tla}`,
`gate/full-verify → {go, python, rust, typescript}`. **The declaration is roughly fourteen
rows**, and its acceptance gate — `audit-build-graph-completeness.ts` — is already green and
already required in `gate.yml`.

**Unblocks.** S6, by the S2→S6 edge above. Also banks the largest measured single saving
available anywhere in this plan, and does it without a repo boundary.

**Reverse.** One revert; the leg goes back to the union install. The new field is inert data
if nothing reads it.

**How you know it worked.** Re-run the sawtooth method on the Go leg: its install step
provisions its subset rather than 20 toolchains, its cache key no longer hashes `.mise.toml`
entries it does not use, and the `install-v2` cold-key stampede loses one of its 12
concurrent writers. Falsifier: if the leg's provisioned set does not shrink, the subset is
not real and S6 inherits the union — stop and fix before creating anything.

**Guard.** The three declared-UNCOVERED targets (`unit:agda`, `tool:alloy`,
`lean:src/Core.Lean4.Cslib`) must keep forcing FULL mode. A job that should have run and did
not looks exactly like a job that ran and passed.

### S3 — The remaining hats. *(reversible per lane)*

**Does.** One App per charter, one PR per lane, in this order: `AUTOFIX_TOKEN` (which already
carries its own `|| github.token` fallback, so its reversal is pre-built) → `ACEHACK_MIRROR_TOKEN`
→ `RULESET_READER_TOKEN` + `DRIFT_DETECTOR_PAT` → `ZETA_TELEMETRY_FLUSH_TOKEN` and
`ZETA_PR_ARCHIVE_TOKEN` **together, in one PR with the two gate audits**, because
`audit-workflow-credential-role-separation.ts` and `audit-workflow-write-token-consistency.ts`
hardcode those secret names and are required checks. `SCAFFOLD_STAGE1_PAT` is deliberately
**last** — it is the credential S6 uses, and swapping it in the same change as the first repo
creation would confound two experiments.

**Unblocks.** S6. Also closes, at N=1, the archive vacuity: 97.6% of eligible PRs bot-merged
and never archived, with nothing red.

**Reverse.** Per lane, revert to the PAT. The PATs stay live until S9.

**How you know it worked.** `git grep 'secrets\.\(ZETA_\|.*_PAT\|.*_TOKEN\)' .github/workflows`
returns only App-id/key references; each converted lane's next run is green; and the
merge-actor class breaks — commits merged by the App identity now carry a `gate` push run,
against the measured `github-actions[bot]` baseline of 0 runs in 20 of 20.

**Named acceptance checks, not assumptions.** (a) does an App-token merge create a `push`
workflow run — the whole §2.3(3) argument rests on it and it is `consistent with`, not
`metered`; (b) does an App token with `Workflows: write` clear the `.github/workflows/**`
wall on file; (c) auto-merge arming is **GraphQL-only** (`enablePullRequestAutoMerge`) and
the current flush PAT does not carry it — the App must, or the auto-merge gap survives the
cutover.

**Gated:** more App creation. **Needs Aaron.**

### S4 — Build the two falsifiers the split needs, before it needs them. *(reversible)*

**Does.** (a) `lint-closure-disjointness.ts`: reads a proposed partition as data and refuses
overlapping closures — the falsifier `surface-declarations` §4 names and nobody built.
(b) Extends the clone-at-tag surface from the `ace`-only proxy toward the real per-repo test,
and adds the escrow §10 exit check: refuse any bootstrap surface whose upstream source line
has been deleted in favour of an escrow.

**Unblocks.** S6, by making the boundary checkable rather than argued — *"you evaluate split
variations by computing them, and you only move files once."*

**Reverse.** Delete the lints. Nothing depends on them.

**How you know it worked.** Run (a) against the proposed `zeta-formal` partition. It should
**fail** on first run, naming `src/Core.TypeScript/formal-verification/*` as spanning the
boundary. A lint that passes on its first real input is a check that cannot fail.

### S5 — Rehearse the cross-repo glue in-tree. *(reversible)*

**Does.** Lands the pin file (`.formal-version`) and the `repository_dispatch` handler
against a **self-pin** — `Zeta` pinning a tag of `Zeta` — so the glue is exercised with no
second repo in existence. Also parameterises the repo literals the split will break: 34
`Lucent-Financial-Group/Zeta` occurrences across 17 workflows, and ten hardcoded
`DEFAULT_REPO` / `REPO ??` constants in `src/Core.TypeScript/` (plus seven bare `"Zeta"`
constants with no env override at all).

**Unblocks.** S6 — the day `zeta-formal` exists, the glue is already proven and only the
pin's *target* changes.

**Reverse.** Revert; the pin file is inert if nothing reads it.

**How you know it worked.** A tag bump on `Zeta` fires the dispatch and opens a pin-bump PR
that goes green. And `grep -c 'Lucent-Financial-Group/Zeta' .github/workflows` falls.

---

### The irreversible line — everything below needs Aaron's explicit sign-off

### S6 — Create ONE repo: `zeta-formal`. **IRREVERSIBLE.**

**Does.** Runs the existing `scaffold-stage1-create-repos.yml` with a new `zeta-formal`
option (a small, reversible PR to add the choice) to create the repo with the full
day-one checklist the tool already implements: squash-only, auto-merge, branch protection
with signed commits and linear history, secret scanning + push protection, Dependabot,
CodeQL default setup, Scorecard, $0 budget caps, Apache-2.0.

**Why this is not reversible.** A created repository can be archived or deleted, but the
name, any fork, and any external clone are not recallable. The workflow's own header says
it: *"Creating GitHub repos is permanent."*

**Reverse (partial, and say so honestly).** Archive the repo, revert the pin file, revert the
scaffold-choice PR. The name is spent and any clone taken in between is not recallable.

**How you know it worked.** `git clone` at a tag, on a machine with **no `ace` on PATH, no
package manager, no container runtime, and no GHCR access**, then `tools/setup/install.sh`,
then its own gate green. That is the real falsifier the clone-at-tag lint has been
approximating since it was written.

**A precondition the ADR set and this plan does not get to waive.** ADR `2026-04-22`
§"Blockers to Stage 1 execution" gates repo creation on: snapshot cadence ≥ 3 with a
pre-event and a post-event sample **and** a burn projection computed and shown to Aaron.
Measured: `docs/budget-history/snapshots.jsonl` holds **21 snapshots**, most recent
2026-08-23 — **cadence satisfied, projection NOT computed.** The projection is owed before
S6, and it is cheap.

### S7 — Move the content. **IRREVERSIBLE in practice.**

Separate step, separate sign-off, because creation and migration fail differently: creation
risks a name, migration risks history and a green CI. Boundary corrected per S4's finding.

**Reverse.** `git revert` restores the files to `Zeta`; the commits in `zeta-formal` remain.
Two histories now exist for the same content — recoverable, not clean.

**How you know it worked.** `Zeta`'s gate stays green with `lean-proof.yml` /
`tlaps-proof.yml` / `proof-closure-drift.yml` removed; `zeta-formal`'s gate goes green;
S4(a) reports zero overlap; the pin resolves.

### S8 — Re-measure, then decide the second cut. *(no action; a measurement)*

Re-run the sawtooth method. **The expected result is that `Zeta-core` is still over the
ceiling** (§5). The second cut is an open question this plan deliberately does not answer.

### S9 — Revoke the retired PATs. **IRREVERSIBLE.**

Only after every converted lane has run green through a full cadence cycle. Revoking a PAT is
not undoable; a new one has to be minted and re-scoped by hand, and fine-grained PATs are
**UI-only** — `gh` can mint only classic ones, so no agent can restore this headlessly.

---

## 5. The first step, and the first repo — stated plainly

### The first step is S1, and it is not a repo

**One workflow file, one App, one commit to revert.** It was chosen to prove the mechanism,
not to move weight:

- The App manifest and bootstrap steps are **already written and reviewed** in
  `RULESET-RECONCILIATION.md` §6/§8 and explicitly never executed. Executing an existing plan
  is a smaller act than authoring one.
- `ruleset-apply.yml` is the **only** consumer of `RULESET_ADMIN_TOKEN`. Blast radius is one file.
- It retires the **highest-privilege PAT in the tree** (`Administration: write`), so the
  smallest step also buys the largest scope reduction.
- **It touches no required check.** The two gate audits hardcode only the three `ZETA_*`
  names, so S1 does not have to move a required check in the same change — which is exactly
  what makes it smaller than starting with the flush lane.

### The first repo is `zeta-formal`, and the ADR's Stage 1 is reordered

The ADR names `Forge` and `ace` as Stage 1. This plan proposes `zeta-formal` instead, using
the same already-built tool. The reasons, in order of weight:

1. **Cleanest dependency closure in the tree.** 2 live units, 2 toolchains, **0 external
   packages**, 2,977 MB single-owner — the largest member of the 87%-single-owner group.
   Dedicated workflows already exist (`lean-proof.yml`, `tlaps-proof.yml`,
   `proof-closure-drift.yml`), so the CI carve is a move, not a design.
2. **Lowest churn of any serious candidate** — 48 commits/90d. The cross-repo pin is nearly
   static, so the pin *mechanism* is exercised without pin *churn* confounding it.
3. **Its cache cost is 0.02 GiB — and that is a reason FOR it, not against.** A first cut
   should be an experiment, not a payoff. Because the cache axis has no opinion on
   `zeta-formal`, nothing about cache pressure can confound the measurement of whether the
   split mechanism works. Citing cache in its support would be unsupported (sawtooth §7.3);
   citing cache *silence* as experimental cleanliness is exactly what the measurement licenses.
4. **`Forge` is the worst possible first experiment** — 383 commits/90d, the highest-churn
   candidate, where content churn and pin churn would confound each other from day one. Its
   case is real and it is a CCP cut; it is not a *first* cut.
5. **`ace` cannot be first, by rule.** `clone-at-tag-stays-sufficient` requires every repo to
   build with no `ace` present. `ace` must therefore be the last thing anything depends on.
6. **`zeta-archive` removes zero toolchain** (round 3 §11). It is round 2's leader on its own
   axis and still the cheapest to operate; it just proves nothing about closure.

---

## 6. What this plan does NOT solve — stated up front, not buried

1. **`Zeta-core` does not get under the 10 GB ceiling, and this plan does not know what
   would.** Metered: 11.17 GiB charged at peak. S2 attacks the union half (59% of the logical
   set) and is the largest lever available — but two terms survive it:
   - the **ref multiplier**, 2.6×, which travels with the repo because `Zeta-core` inherits
     96% of build-touching commits and therefore today's PR concurrency;
   - the **OS×arch axis**, untouched by any repo boundary — `dotnet-macOS-ARM64` alone is
     1,858 MB, 20% of the entire ceiling, for one leg of one toolchain.

   **So after S2 and S7, `Zeta-core` may still be over, and nobody has specified the further
   cut.** Round 3 §9 names two candidates and adjudicates neither in a way that settles it:
   the **Rust tier** (1,534 MB disjoint, but CRP would split it 25 ways and that is *"the
   clearest case in the tree where following CRP literally would be a mistake"*), and the
   **dotnet mega-component**, where both axes agree it should stay together. **This plan
   picks neither.** It sequences S8 to produce the measurement that would let Aaron pick.

2. **The multi-repo scoping property of hats is unproven until S6.** §2.3, honest limit.

3. **Three acceptance checks in S3 are `consistent with`, not `metered`** — whether an
   App-token merge creates a push run, whether `Workflows: write` clears the workflow-file
   wall, and whether the App can arm auto-merge via GraphQL. Each is a named check, not an
   assumption, and each can falsify a step.

4. **Nothing here deploys the escrow, resolves the language/OS-package half of it, or
   answers the merge-queue / concurrency question.** The escrow is off the critical path by
   construction; the concurrency question is orthogonal and has its own open decisions.

5. **The interactive `gh pr merge --auto` identity is uninventoried.** `CLAUDE.md` §5 and the
   agent loops arm auto-merge under whatever credential the loop holds, and that identity
   appears in no role table. It is a gap this plan names and does not close.

---

## 7. What Aaron must decide

| # | decision | class | blocks |
|---|---|---|---|
| 1 | **Create the `zeta-ruleset-reconciler` GitHub App** and store its private key. Org secret, or the YubiHSM lane? | secret creation — gated | S1, and therefore everything |
| 2 | **Reorder ADR Stage 1**: `zeta-formal` first, `Forge`/`ace` later? | changes a Proposed ADR | S6 |
| 3 | **Create `zeta-formal`** — irreversible | gated | S7 |
| 4 | **Revoke the retired PATs** once hats prove out — irreversible, and fine-grained PATs cannot be re-minted headlessly | gated | S9 |
| 5 | **Is the merge-actor change acceptable** now that it is a bounded hat rather than a widened role? (`three-verdict-loss-mechanisms` §9 item 3, restated) | security-class | S3 |
| 6 | **The second `Zeta-core` cut** — Rust tier, dotnet sub-cut, the OS×arch axis, or accept being over the ceiling? | open; decide **after** S8's measurement | S8+ |
| 7 | **The budget projection** owed by ADR §Blockers before any repo is created — 21 snapshots exist, no projection has been computed | gate condition Aaron set | S6 |

Only #1 blocks this week.

---

## 8. Register

| claim | register |
|---|---|
| Every cache, closure, churn and verdict-loss figure in §1 | **metered** at its cited source; not re-derived here |
| `build-graph.json` completeness (119/37/4, rc=0) and the credential census (81/8/0) | **metered, measured here** at `d3396ab838`, commands in-line |
| The `leg → kind` map in S2 | **metered** — read from `build-graph.json`; the `kind → toolchain` half is the **new** datum and does not exist yet |
| PAT ≡ role, App token ≡ hat | **checked against** `2026-08-09-*-hats-grant-claims-bounded-duration-*` §C property by property (§2.2), not asserted |
| An App-token merge creates a `push` workflow run | **consistent with** — follows from GitHub's documented `GITHUB_TOKEN` recursion rule and the measured 20/20 vs 18/18 split; **not tested with an App token** |
| `Workflows: write` clears the workflow-file wall | **consistent with** — the blocker is on file; the resolution is untested |
| `zeta-formal` is the cleanest first cut | **metered** on closure and churn; the "experimentally cleanest because cache is silent" reading is **inference**, labelled as such |
| `Zeta-core` still over the ceiling after S2+S7 | **bounded, not predicted** — the union blobs cannot be apportioned from cache data (sawtooth §5.3(1)); this is the sawtooth's own register, carried forward unchanged |
| Hats reduce long-lived secret material | **true as arithmetic** (O(charters) vs O(repos × charters)), **false as elimination** — §2.3 counterweight |

**Could not verify:** whether the org has raised the Actions cache ceiling (the usage-policy
endpoint 404s at every credential available to an agent; the sawtooth doc infers ~10 GB from
two eviction sweeps converging at 9.68 and 9.07 GiB). Whether any App-token behaviour above
holds — no App exists.

---

## Pointers

- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — Stage 0-4, the peer-repo
  (not submodule) glue, the §Blockers budget gate this plan carries forward
- `docs/research/2026-08-19-repo-split-round-2-*` (change rate) · `-round-3-*` (closure; §7
  candidates, §9 CCP/CRP synthesis, §13 options) · `2026-08-01-multi-repo-split-design-four-existing-axes-*`
- `docs/research/2026-08-26-the-actions-cache-is-a-measured-sawtooth-*` — §5.3 the arithmetic
  that does not close, §7 item 2 and §9.5 the union-blob prerequisite this plan sequences on
- `docs/research/2026-08-20-surface-declarations-are-data-*` — §0 declare *what*, never *how*;
  §4 a surface set **is** a dependency closure and the disjointness falsifier; §6b why
  declarations come before the split
- `docs/research/2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md`
  §C — the three properties §2.2 checks against
- `docs/research/2026-08-26-hat-persona-role-a-hat-carries-the-direction-a-persona-carries-the-choice.md`
  — *pressure the capability, never the wearer*; why roles are legacy
- `docs/research/2026-08-26-three-verdict-loss-mechanisms-on-main-*` §2 — the 40% class and
  the merge-actor discriminator; §9 item 3 is the decision §2.3(3) dissolves
- `docs/operations/RULESET-RECONCILIATION.md` §6/§8 — the written, never-executed App
  bootstrap that S1 executes
- `docs/research/2026-08-26-dependency-escrow-helm-selection-*` §10 — the exit test
  (*"if the escrow is down, can CI still build?"*) that S4 builds
- `docs/security/2026-08-17-society-heartbeat-token-boundary-and-gate-start-failure.md` — the
  three-role table; `src/Core.TypeScript/hygiene/audit-workflow-credential-role-separation.ts`
  + `audit-workflow-write-token-consistency.ts` are the two required audits S3 must update
- `src/Core.TypeScript/ace/build-graph.ts` + `build-graph.json` · `hygiene/audit-build-graph-completeness.ts`
  — the graph S2 reads and the gate that makes reading it sound
- `src/Core.TypeScript/hygiene/lint-clone-at-tag-is-sufficient.ts` — its header names S4's job
- `src/Core.TypeScript/scaffold/create-repo.ts` + `.github/workflows/scaffold-stage1-create-repos.yml`
  — S6's tool, built and dry-run verified, one `workflow_dispatch` away
- Rules: [`clone-at-tag-stays-sufficient`](../../.claude/rules/clone-at-tag-stays-sufficient.md) ·
  [`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
  (exit, not degree) ·
  [`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)
  (never confiscate; a bounded hat is a spend, a widened role is closer to a grant that cannot be undone) ·
  [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) ·
  [`no-directives`](../../.claude/rules/no-directives.md) (gated classes) ·
  [`manifesto-13-specifications`](../../.claude/rules/manifesto-13-specifications.md) §3 weight-free
- **Anchors (Beacon).** Martin, *Agile Software Development* (2002) — CCP/CRP, the two axes
  rounds 2 and 3 measure. Parnas, CACM 1972 — decompose by likely change. Saltzer & Schroeder,
  *The Protection of Information in Computer Systems* (1975) — **least privilege** and
  **complete mediation**; a bounded, per-act credential is least privilege in its original
  formulation, and a permanent one is the accumulation it warns about. Lampson, *Protection*
  (1971) — the access matrix; a hat is a **capability** (a transferable, scoped, expirable
  token) where a PAT is an **identity ACL entry**, which is the same distinction §2.2 draws
  in GitHub's vocabulary. Hirschman, *Exit, Voice, and Loyalty* (1970) — exit as the
  discriminator that keeps `ace` and the escrow oracles rather than hubs.
