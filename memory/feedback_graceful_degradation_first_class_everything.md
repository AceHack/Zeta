---
name: Graceful-degradation should be first-class in everything we do — microservice + UI framing, not scientist framing
description: Aaron 2026-04-22 "Graceful-degradation should be first class in everything we do" + "thats why we have the data in git too" + follow-up "frame it how a microservice and ui would frame graceful degradation not a scientist, they are similar but not 100% overlapping." Factory-wide principle — every tool, script, doc must serve a degraded-but-useful response when a dependency/input/scope is missing, stale, or partial. Framing: circuit breakers, fallbacks, bulkheads, partial responses, progressive enhancement, skeleton states, serve-stale-cache. Data-in-git is the persistence cache layer that enables it.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** Every tool, script, doc, hygiene check, and
projection the factory produces must degrade gracefully
when a dependency is unavailable, an input is partial,
a scope is narrowed, or data is stale. Think like a
microservice or a UI, not like a scientist. The failure
mode is **"serve a partial/cached/degraded response
and name what's missing"**, never **"return 500"** and
never **"block the whole experience on one missing
dependency."** Persisted history in git is the cache
layer that makes this possible.

**Why — Aaron 2026-04-22, in two beats:**

> *"Graceful-degradation should be first class in
> everything we do"*
>
> *"thats why we have the data in git too"*

Then the reframe clarification:

> *"frame it how a microservice and ui would frame
> graceful degradation not a scientist, they are
> similar but not 100% overlapping."*

The scientist lens (evidence tiers, confidence bounds,
"insufficient data for projection") is close but not
the right one. The right lens is the one service-and-UI
engineers use to keep product alive when one
downstream is on fire: circuit breakers, fallback
paths, bulkheads, partial responses, progressive
enhancement, serve-stale-cache. **The product keeps
working. The user keeps getting value. The failure is
contained and communicated — not total, not silent.**

The two lenses overlap on: *don't crash, don't
fabricate, name the gap*. They diverge on emphasis:

| Scientist framing | Microservice / UI framing |
| --- | --- |
| "N=1, insufficient data" | "cache hit, serving stale" |
| "cannot compute delta" | "downstream timeout, fallback response" |
| "evidence tier X required" | "feature flag off, core path still works" |
| "confidence bound widens" | "partial result — 5 of 10 items loaded" |
| passive: "we don't know" | active: "we're still serving, here's what" |

The factory ships products, not papers. The
microservice/UI framing is the correct instinct.

**The patterns to reach for (microservice side):**

1. **Circuit breakers.** When a dependency is
   unavailable, fail fast, stop hammering it, serve a
   cached/default response. Factory instance:
   `gh api` returns 403 for a missing scope → return
   `scope_coverage.blocked: ["actions_billing"]` and
   continue computing what you can. Don't retry in a
   tight loop; don't abort the whole snapshot.

2. **Fallbacks.** Primary path fails → serve a
   secondary. Factory instance: a projection needs
   cumulative PR counter but only has rolling-window
   count → fall back to rolling-window with a
   `proxy: true` flag and a caveat line, not an
   error.

3. **Bulkheads (failure isolation).** One broken
   component doesn't sink the whole ship. Factory
   instance: snapshot-burn.sh iterating over repos —
   one repo's `gh api` timing out must not kill the
   other repos' capture. Each repo's block is its
   own bulkhead; failures show as a per-repo
   `status: error` entry, not a script crash.

4. **Partial responses with explicit "what's
   missing" metadata.** When you can't serve the
   full response, serve what you have + a legible
   manifest of what you couldn't.
   `docs/budget-history/snapshots.jsonl` already
   does this via `scope_coverage.missing_requires_admin_org`.

5. **Serve stale cache when fresh is unavailable.**
   Don't 500 because you couldn't refresh — serve the
   cache with a `stale: true` marker and the
   cache-age. Factory instance: any doc citing a
   live state should carry the snapshot
   timestamp so readers know it's a cached view.

6. **Health endpoints + degraded-mode signals.**
   A tool's `--help` / header output should
   communicate current mode: "fully-operational",
   "degraded (scope_X missing)", "cache-only
   (no refresh possible today)". Make the mode
   discoverable, not guessed.

**The patterns to reach for (UI side):**

1. **Progressive enhancement.** Core functionality
   works without the enhanced layer. Factory
   instance: Forge scaffolding must work without
   LFG Copilot Business; Copilot features layer on
   when available. Never require the enhanced layer
   for the base path.

2. **Skeleton / loading states.** Show the shape
   while the data loads. Factory instance: a
   projection with N=1 should render the full
   template (all section headings, all fields)
   with *"— not yet available"* values — not
   collapse the template or omit sections. Future
   snapshots fill in the skeleton in place.

3. **Show what you have, indicate what's
   missing.** "Loaded 5 of 10 items, [retry rest]"
   UI pattern. Factory instance:
   `project-runway.sh`'s "Aaron-decision surface"
   enumerates gate conditions with yes/no per row —
   never omit a row because its answer is "no" or
   "unknown".

4. **Offline-capable with clear offline
   indicator.** Service worker caches the last
   good response and flags "offline mode" in the
   UI. Factory instance: git is the offline cache;
   when `gh api` is down or rate-limited, fall back
   to reading the most recent snapshot JSONL and
   flag "offline — last snapshot at <ts>". **Aaron
   2026-04-22 insight: cartographer-mapping is
   *already* this pattern firing inadvertently —**
   *"offline-capable that is exactly what we are
   inadvertenly doing everytime you map somthing
   cartographer, next time we don't have to go
   online and with a local agent you would not need
   the internet to have the skills of the factory"*.
   Every surface map checked into the repo (the
   GitHub surface map, settings-as-code doc,
   budget-history JSONL, research docs) is an
   offline cache entry. The factory is accumulating
   an **offline knowledge base** as a byproduct of
   ordinary cartographer work, which becomes the
   skills substrate for a future local-only agent
   running without internet. This reframes
   cartographer discipline from "documentation
   hygiene" to "offline-capability investment." See
   `project_local_agent_offline_capable_factory_cartographer_maps_as_skills.md`
   for the full directive.

5. **Error boundaries.** One broken widget doesn't
   crash the page. Factory instance: a hygiene
   check script iterating over N files must not
   let one file's parse error prevent the other
   N-1 checks from running. Per-file
   `status: parse-error`, continue.

6. **Placeholders over empty space.** Missing image
   → placeholder + alt text, not a broken link icon.
   Factory instance: a doc section whose data isn't
   ready → named placeholder ("*pending admin:org
   scope — see `docs/budget-history/README.md`*")
   rather than an empty section or a missing
   heading.

**The data-in-git part (the cache layer):**

Aaron's *"thats why we have the data in git too"*
is the cache substrate that makes all the patterns
above possible. Git gives the factory:

- **A persistent cache** — serve-stale works because
  `snapshots.jsonl` is always there, even when
  `gh api` is down.
- **Diff-based change detection** — like an
  HTTP `If-Modified-Since`: compare current state
  to the last-committed snapshot; degrade if the
  delta is unknowable.
- **Offline fallback** — the whole factory can
  reason from committed state with zero network
  calls.
- **Audit trail** — every cached response has a
  commit sha + timestamp; no mystery about when a
  value was fresh.

The live UI surfaces (GitHub billing graphs, Grafana,
GitHub Actions status) serve humans looking at
*right now*. Git serves the factory looking at
*trajectory + fallback*. Both exist; neither
replaces the other. The *"too"* in Aaron's
phrasing is load-bearing — UI + git, not UI OR git.

**How to apply:**

1. **Design the fallback path before the happy
   path.** When drafting a tool, first question:
   *"what response does this serve when its
   dependency is unavailable / its input is partial /
   its scope is narrowed?"* Second question:
   *"what's the fully-operational response?"*

2. **Never let one failure cascade.** Wrap external
   calls (`gh api`, network, subprocesses) in
   per-item try-blocks so one failure doesn't kill
   the batch. Emit per-item status; continue.

3. **Name the mode in the output.** Every non-
   trivial tool output carries a mode marker:
   `status: ok | degraded | cached | offline` plus
   a `missing: [...]` list when degraded.

4. **Full template, partial fill.** Don't collapse
   sections when data is missing; render the
   section with an explicit "not yet available"
   placeholder. Preserves discoverability (readers
   know the section *exists* and what would fill it).

5. **Persist to git what you'd otherwise lose.**
   Any state that would be gone if the live surface
   went away, and that a future reasoning step
   depends on, belongs in a checked-in append-only
   file. Snapshots, hygiene results, CI timing,
   drift detections.

6. **Document degradation tiers in `--help`.**
   Tools enumerate which inputs they handle
   gracefully and how they degrade. Readers / agents
   don't have to reverse-engineer behaviour from
   crashes.

7. **Graceful-degradation is a review lens, not a
   checklist.** When reviewing a new tool, script,
   doc, or hygiene check: ask "what happens when
   X fails / is stale / is missing?" If the answer
   is "crashes" or "silently returns wrong", it
   needs work before landing.

**Worked examples in the factory (2026-04-22 state):**

- `tools/budget/project-runway.sh` — partial-
  response pattern: fully-operational at N≥2,
  baseline-only at N=1, explicit "accumulate more
  snapshots" guidance at N<3. The output
  *template* is constant across all N; the
  *values* degrade legibly.
- `tools/budget/snapshot-burn.sh` —
  per-repo bulkhead pattern (one repo's error
  doesn't kill the batch); `scope_coverage`
  manifest = the "what's missing" metadata.
- `docs/budget-history/snapshots.jsonl` — the
  cache layer (git-persistent, always available
  for offline reasoning).
- `tools/hygiene/prune-stale-branches.sh` —
  empty-input pattern: N=0 stale branches → clean
  "nothing to prune" output, not an error.
- `tools/hygiene/snapshot-github-settings.sh` —
  sibling cache-in-git pattern for settings
  drift.

**Where the factory currently violates this:**

- Scripts that abort on first `gh api` 4xx instead
  of marking per-endpoint status and continuing.
- Docs that cite live state without a snapshot
  timestamp (readers can't tell fresh from stale).
- Hygiene checks that require all expected files
  present; should run over what's there and list
  absentees.
- Tools that produce *less* output when inputs are
  partial (section omitted) rather than a full
  template with partial fill.

Candidate follow-ups, not land-immediately.

**Source:** Aaron direct messages 2026-04-22 during
round-44 speculative drain, immediately after the
autonomous-loop tick landed
`tools/budget/project-runway.sh` (commit `5f91369`).
Three-beat sequence:
1. *"Graceful-degradation should be first class
   in everything we do"*
2. *"thats why we have the data in git too"*
3. *"frame it how a microservice and ui would
   frame graceful degradation not a scientist,
   they are similar but not 100% overlapping."*
   (This reframe message is what shifted this
   memory's vocabulary from evidence-tiers to
   circuit-breakers / fallbacks / progressive-
   enhancement.)

**Cross-reference:**

- `docs/budget-history/README.md` — canonical
  worked example of the cache + partial-response
  pattern pair
- `project_multi_sut_scope_factory_forge_command_center.md`
  — same-tick directive; graceful degradation
  applies when one of the three SUTs is missing
  or out of sync
- `feedback_enforcing_intentional_decisions_not_correctness.md`
  — hygiene rules catch unthought decisions;
  graceful degradation catches unthought failure
  modes
- `feedback_factory_reflects_aaron_decision_process_alignment_signal.md`
  — Aaron abstracting a concrete pattern (N=1
  handling) into a factory-wide principle and
  confirming the alignment signal is firing
  ("yep" 2026-04-22) — this is that signal firing
  twice in one tick
- `feedback_declarative_all_dependencies_manifest_boundary.md`
  — parallel principle: enforcement boundary must
  be legible; degradation path must be legible
- `project_local_agent_offline_capable_factory_cartographer_maps_as_skills.md`
  — factory-scale instantiation of the offline-
  capable pattern; cartographer maps are the
  graceful-degradation substrate when the network
  is the failing dependency
