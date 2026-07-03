# Society review — `forge-host` interface + `db/` universal-interface memory layout

> **Aaron 2026-06-15 (shadow\*): "let's do that forge-host interface review and
> memory layout / db layout architecture."** A **decorrelated society review** — 7
> independent agents, no shared frame — run as the *live dry-run of the no-PR
> society-check gate* (the gate we spent the session designing, eating our own dog
> food). Scored against the session's carved criteria (interface = what it can prove;
> externally-anchored naming; surfaces-are-interfaces) + the no-waits push.

**Meta-result: the gate worked.** Seven decorrelated lenses found real, convergent,
actionable issues on both targets. Convergence on the big findings (3-4 independent
agents hitting the same P0) = high confidence; divergence on the long tail = the
decorrelation paying off. This is the society-check producing TRUTH, not approval.

## Panel

forge-host: Ilyana (public-API) · Kira (harsh-critic) · type-design · Viktor
(spec-zealot). db/: Kenji (architect) · Rune (maintainability) · Rodney (reducer).

## A. `forge-host` — verdict: rename + spec + de-sync the port before v1

**P0 — host jargon ("PullRequest") leaks through the entire port** (Ilyana +
type-design + Viktor converged). `listOpenPullRequests` / `getPullRequest` /
`createPullRequest` / the `PullRequest` type / `prNumber` / `mergeStateStatus` /
`CiConclusion` are **GitHub vocabulary on the host-agnostic port surface**. The leak
is *proven* by the GitLab adapter: it must "map to merge requests" and casts a GitLab
`iid`/MR into a type literally named `PullRequest`. This is the exact criterion-2
violation (host nouns must stay in the adapter). **Fix:** rename to a host-agnostic
noun (`ChangeProposal` / `ChangeRequest` / `Review`); confine "pull request" / "merge
request" to adapters. Pre-v1 window — the GitLab stub is the only second consumer.

**P0 — the port is synchronous wearing async clothing** (Kira) — *directly your
no-waits push.* Every method returns `Promise<Result<…>>` but the GitHub adapter is
`spawnSync` end-to-end (`gh-cli.ts`, `github-adapter.ts`): blocks the event loop for
the full `gh` round-trip, never `await`s real async. A Promise over a blocking call is
worse than honest sync — it hides the stall from the scheduler. **Fix:** async
`spawn`/`execFile`, route through the throttler's DoP knob (the ferry-boat pattern).

**P0 — no spec / no conformance** (Viktor). `ForgeHost` gates every merge yet has
**zero OpenSpec coverage**; its "never throw → return `not-supported`" contract is
prose, bound by no conformance harness; the GitLab stub presents as a peer but is
22-of-23 `not-supported`. **Fix:** `openspec/specs/forge-host/spec.md` + an
adapter-conformance suite (min-conformance floor; `not-supported` = permanent contract
vs TODO must be decided).

**P1 — methods are signatures, not contracts** (Ilyana — the carved criterion):
no member states a guaranteed property (`createBlob` implies a content-address law,
unasserted; batch partial-success only in a doc-comment). Attach a one-line *law* per
method. **P1 — real correctness/security** (Kira): unescaped `ref`/`sha` interpolated
into REST paths (`git/refs/${ref}` → path-injection); `createIssue` returns
`number: 0` on parse-fail as `ok`; `addPrComment` returns `id: ""`; **>100 review
threads silently dropped → the gate flips "clean" while threads remain** (a
merge-decision correctness bug); `classify-error` substring-matches `"404"`/`"network"`
fragilely → mis-set `retryable`. **P1 — type-design:** make illegal states
unrepresentable (discriminate `PrGateState`/`SearchPrResult`/`CiCheck` on their state
field; brand `Sha`/`RefName`; quarantine the GitHub Git-Data-API behind an optional
capability sub-interface).

## B. `db/` universal-interface — verdict: the crux is built; correct the framing; ship the minimal version first

**The structural crux is ALREADY BUILT** (Kenji) — and I missed it: `src/Core/DagFs.fs`

+ `src/Core/ContentStore.fs` implement the multi-parent DAG (`links: path → MerkleHash`,

`pathsOf`, `editLocal`/`editEverywhere` = the two edit modes), content-addressed,
conflict-free merge. **Buildable on existing code, not aspirational.** Integrity
(`ContentStore`, keyed by hash) and retrieval (`DagFs.links`, keyed by path) are *two
maps* — so "Merkle is integrity, not retrieval locality" is enforced by construction.
No sync-over-async anywhere in these modules (clean on no-waits).

**Correction — I over-claimed "infinite via symlinks"** (Kenji + Rune + Rodney all
hit it). On disk: **2 symlinks**, ~64 of ~85 buckets hold only a README. The
multi-parent reality lives in **`DagFs.links` (a path→address map)**, NOT OS symlinks.
Beacon statement: *"a path→address map gives unbounded many-to-one addressing"*;
symlinks are one materialization, not the source. The workitem is corrected.

**The load-bearing MISSING piece** (Kenji): the **coincidence-anchor → path function**
— nothing in Core emits the anchor *address* that becomes a `DagFs.link` key. Specify
it FIRST; everything (eval metric, hat/host hypothesis) depends on it. And make
explicit: a **shared coincidence = a new `links` entry (address)**, not a confidence
bump (value) — consistent with routing≠confidence.

**Rodney's razor — most of the stack is premature.** *Essential:* coincidence-anchor
routing + confidence-as-contained-value + one coincidence index. *Accidental/premature
at 720KB / 155 files:* Merkle (no dedup bottleneck), symlink/filesystem-DAG as storage
(the index carries multi-parent), the 4-competing-strategies port + eval harness (the
workitem's own falsifier fires — no common workload, no measured loss vs flat). **The
minimal version:** flat content-addressed store + one coincidence-anchor→node index +
confidence as a node field + `log()` size/latency as the explicit trigger. Defer the
rest; collapse the ~60 empty buckets. **Maintainability:** add a `db/README.md` (no
top-level entry point today); mark the workitem's DAG/symlink claims **design-intent,
not realized**.

## Actionable (recommended routing — forge-host fixes are Aaron's call, his code)

1. **forge-host:** (a) rename `PullRequest*` → host-agnostic noun; (b) de-sync the
   GitHub adapter (async spawn + throttler — the no-waits work); (c) write the
   OpenSpec + conformance suite; (d) fix the path-injection + the >100-thread
   pagination merge-gate bug (real). Suggest a workitem each; **Aaron green-lights
   (his src/).**
2. **db/ memory-org (workitem `081KV6GR72…`):** corrected per this review (symlinks→
   DagFs path-map; DagFs/ContentStore are the substrate; coincidence-anchor→path fn is
   the first deliverable; Rodney's minimal-version is the recommended first step).
3. **Hygiene aside:** the `spec-zealot`, `maintainability-reviewer`, and `reducer`
   `SKILL.md` files are **absent on disk** (personas ran from their agent contracts) —
   flag for skill-lifecycle (Aarav).

## Anchors

The carved criteria (`2026-06-15-an-interface-is-defined-by-what-it-can-prove-…`,
`…coworker-not-control-…` society/no-PR gate); `forge-host` (`src/Core.TypeScript/forge-host/`);
`DagFs.fs` / `ContentStore.fs` (the multi-parent DAG, the find of this review);
the memory-org workitem `081KV6GR72108QG0R003P9MG4M`; the panel's 7 agent reports.
