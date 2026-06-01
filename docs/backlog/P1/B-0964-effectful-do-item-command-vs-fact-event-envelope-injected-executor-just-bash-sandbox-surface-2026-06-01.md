---
id: B-0964
title: Effectful do_item — command-vs-fact-event envelope + injected executor port + item-class-routed bash surface (just-bash text / local docker real-work / CF cloud-burst)
status: open
priority: P1
created: 2026-06-01
last_updated: 2026-06-01
author: otto-cli
composes_with:
  - B-0958 # observe.ts checklist — this is LEFT item #1 (effectful action kinds, do_item first)
  - B-0962 # coordination (do_item is the work action the menu offers; deadlock/livelock disciplines)
  - B-0963 # liveness proof (completion = an executed do_item, not just a selection)
  - B-0867 # workflow-engine lifecycle DUs (the executed-event envelope is lifecycle-shaped)
---

# B-0964 — Effectful do_item

> **Why this row exists (not dogma):** B-0958 LEFT #1 — "`do_item` first, with the
> executed-event envelope (`ActionExecutionStarted/Succeeded/Failed/ModeChanged`)
> so **replay folds facts, never redoes commands**." Today `execute` only handles
> `free_time`/`self_reflect` (zero side-effect: append + simulate). `do_item` has a
> real side-effect (the agent actually does work), so it needs two new pieces:
> (1) the **command-vs-fact-event split** (event-sourcing correctness), and
> (2) an **injected executor port** — the "bash surface" Aaron asked about. WHYs
> inline so they can be questioned/agreed/revised. This is the **design**; the
> build is phased in §5.

## §0 The load-bearing correctness piece — command vs fact event (replay folds facts)

Today the loop folds **`NextAction`s directly**: `fold(initial, actions)` replays
each action through `simulate`. That is fine for zero-side-effect kinds
(`free_time`/`self_reflect` — replaying them just re-sets the mode). It is **wrong**
for `do_item`: re-running the log must **not** re-run the work (re-build, re-push,
re-charge). Standard event-sourcing: **commands ≠ events.**

- **`do_item` is a COMMAND** — an intent the chooser picked ("do B-0883").
- Executing it emits **FACT events** — what actually happened:
  `ActionExecutionStarted{item, tier, gated}` → `ActionExecutionSucceeded{item}`
  **or** `ActionExecutionFailed{item, reason}` (+ `ModeChanged{work}`). The
  `Started` fact **records which executor tier ran** (fake / just-bash-text /
  docker / cloud-burst) **and whether it was gated** — so the §3 glass-halo audit
  can distinguish a sandbox run from a real-FS/docker escalation (Copilot
  2026-06-01).
- **`fold`/`replay` fold the FACTS**, never the command: a folded `ActionExecutionSucceeded`
  re-applies the state transition (item leaves backlog) **without** re-running the
  shell. A folded `ActionExecutionFailed` leaves the item in the backlog.

So the durable log for an effectful action is the **fact stream**, not the command.
`simulate(do_item)` (item leaves backlog, mode→work) stays the pure transition —
but it is now driven by **`ActionExecutionSucceeded`**, not by the raw command. The
zero-side-effect kinds can keep folding directly (a fact == the action); only
effectful kinds need the started/succeeded/failed envelope.

**Design decision to confirm in review:** does the event log become a union
`Command | Fact`, or do we only ever persist FACTS (commands stay in-memory, never
logged)? Cleaner: **persist facts only** — the log is the history of what happened;
the chooser's pick is ephemeral until it succeeds. (Matches "state is a projection
of the event log": the log is facts; commands are how we got there.)

## §1 The injected executor port — the "bash surface" (asymmetric-authorship)

`do_item`'s side-effect runs through an **injected `CommandExecutor`** — same
pattern as `EventSink` (the port authors its own outcome channel; `execute` stays
testable with a fake; no I/O in the unit path):

```ts
export interface RunSpec {
  readonly cwd?: string;
  readonly script: string;
} // or a recipe ref
export type RunOutcome =
  | { readonly ok: true; readonly stdout: string; readonly exitCode: 0 }
  | { readonly ok: false; readonly reason: string; readonly exitCode: number; readonly stderr: string };
export interface CommandExecutor {
  run: (spec: RunSpec) => Promise<RunOutcome>;
}
```

`execute(do_item)` = append `ActionExecutionStarted` → `executor.run(...)` →
append `ActionExecutionSucceeded|ActionExecutionFailed` → `simulate` **only on success**. Tests
inject a fake executor (deterministic ok/fail, no shell). Production injects the
real one (§2).

## §2 The bash surface (Aaron's question) — RESOLVED (post multi-AI review): item-class-routed, NOT just-bash-everywhere

> **Aaron 2026-06-01:** "can we use justbash or anything like that to give the
> local llm a real simulated bash surface without a ton of work or some sort of
> docker container if not? … maybe see if the peers think it's overkill."

First draft answered "just-bash as the default." **The review (Gemini + Amara,
2026-06-01) demoted that** — and the reasoning is load-bearing. Amara's keeper:

> **`just-bash` proves the envelope; local Docker proves the work. Persist facts
> across both, and never let replay reissue commands.**

[`just-bash`](https://github.com/vercel-labs/just-bash) (vercel-labs;
[justbash.dev](https://justbash.dev/)) is real: a bash environment reimplemented in
TypeScript, in-process, in-memory FS, no container — "a real bash surface without
docker." But it is a **simulator**: it hits a wall the moment an item needs **real
tools** (git/npm/compilers), and re-implementing POSIX chases a long tail forever
vs. a real kernel's correctness + namespaces/cgroups (Gemini). And it is **TS-only**
— the 4-oracle (Rust/C#/F#) would each need a re-impl, whereas a **container
boundary is language-agnostic** (one local docker, all four drive it). So the
routing is **by item-class**, not a single default:

| Tier                       | Surface                                                                                                                                                       | When                                                                                        | Safety                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Tests**                  | **fake executor** (deterministic, no shell)                                                                                                                   | CI / envelope-shakedown                                                                     | always-green shield                                                                                                        |
| **Text / no-FS items**     | **just-bash** (in-memory FS, network OFF)                                                                                                                     | pure-text work that never needs real tools — zero-ops, in-process                           | sandboxed **only in this config** (in-memory FS can't reach disk; net off)                                                 |
| **Real effectful work**    | **local docker** (real kernel, real tools)                                                                                                                    | "the first time the item needs real tools, **stop simulating**" (Amara) — git/npm/compilers | real namespaces/cgroups; **language-agnostic boundary** — the 4-oracle's shared executor                                   |
| **Constrained**            | [`just`](https://github.com/casey/just) recipes via [just-mcp](https://docs.rs/crate/just-mcp/latest)                                                         | pre-vetted named tasks — an allowlist                                                       | safest: pick a recipe index, not free-form bash (composes the 16-action grammar)                                           |
| **Cloud-burst escalation** | [Cloudflare Sandbox SDK](https://github.com/cloudflare/sandbox-sdk) (edge containers + fork-sessions) · just-bash OverlayFS/ReadWriteFs/net · real host shell | massive parallel / explicit need                                                            | **GATED** (§3). CF is a **dependency trap for a LOCAL sovereign agent** (Gemini) — escalation only, never the loop default |

> **The tool is NOT the gate — the CONFIG is** (Codex PR review, preserved in the
> review doc `docs/research/2026-06-01-multi-ai-review-b0964-bash-surface-tool-choice-gemini-amara.md`). just-bash
> also ships CLI/OverlayFS/ReadWriteFs mounting (reads the real project root) +
> network-allowlist configs. "We use just-bash" ≠ sandboxed — the text-tier MUST pin
> **in-memory FS + network-disabled**; its other configs are cloud-burst/escalation
> tier, gated.

**Recommendation (folded):** **fake for tests; just-bash (in-memory, net-off) only
for pure-text/no-FS items; LOCAL DOCKER as the default for real effectful work**
(real kernel, language-agnostic boundary — the 4-oracle drives the same container,
no 4× bash re-impl); **`just`-recipe allowlist** for known tasks; **CF Sandbox =
cloud-burst escalation only** (sovereignty trap as a default); **reject
bash-on-our-own-FUSE-fs** ("we're building an AI factory, not rewriting GNU
userland" — Gemini). The `CommandExecutor` port (§1) is the invariant Rust/C#/F#
inherit; the impl is swappable behind it. Each impl is a new dep — implementation
PR runs dep-pin-search-first for versions + confirms sandbox/config flags.

## §2.1 Cross-language + alternatives — the port is the seam (operator 2026-06-01)

> **The operator 2026-06-01:** "we also are going to need to support something
> similar in rust cs and fs … we have a fuse file system on the backlog but not
> sure how much work bash is on top of a file system like we have in f# … ts is
> our forerunner here, do what makes sense and come back and use what we learn to
> pull the others forward. maybe see if the peers think it's overkill and we
> should use something else like docker."

The thing that ports across languages is **the `CommandExecutor` PORT (§1), not the
bash IMPL.** Each of TS/Rust/C#/F# implements the same port; each may back it with a
different sandbox. So "TS forerunner" = pick a pragmatic TS impl now, **port the
lesson (the port + fact-envelope + gate), not necessarily the tool.** The
candidates, with the cross-language axis explicit:

| Option                                                                                                                                   | Isolation                                              | Cross-language story                                                         | Cost / work                                                         | Notes                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **just-bash** (vercel-labs, TS)                                                                                                          | in-process, in-memory FS                               | **TS-only** — Rust/C#/F# would each need a re-impl (4×)                      | lightest; free; local                                               | great for the TS forerunner + tests; weakest for the 4-oracle reuse                                      |
| **docker** (local)                                                                                                                       | real container                                         | **language-agnostic** — one sandbox, all 4 langs drive it via the same API   | infra/ops work (the thing the operator wanted to avoid)             | the boundary is the container, not the language                                                          |
| **[Cloudflare Sandbox SDK](https://github.com/cloudflare/sandbox-sdk)** ([docs](https://developers.cloudflare.com/sandbox/), GA 2026-04) | real isolated Linux container on CF edge               | TS API, but the sandbox is language-agnostic (drive over HTTP from any lang) | managed (no local docker ops); CF dependency + cost; edge-not-local | **does fork-sessions** (boot N from a snapshot) — matches the 4-oracle / parallel-agent pattern directly |
| **bash-on-our-own-FUSE-filesystem**                                                                                                      | our FS substrate (F# already has one; FUSE on backlog) | **most owned/portable** — composes the substrate we control                  | most work (build bash atop the FS)                                  | the operator's open question: "not sure how much work bash is on top of a filesystem like we have in f#" |

**The open decision for the review (operator's framing):**

- Is just-bash **overkill** — should we just use **docker** (or CF Sandbox)?
  Specifically: does the **cross-language requirement** (Rust/C#/F# equivalents)
  argue AGAINST a TS-only in-process tool (4× re-impl) and FOR a container boundary
  (one sandbox, all langs drive it)?
- Does CF Sandbox's **fork-sessions** (N-from-a-snapshot) make it the natural fit
  for the 4-oracle / parallel-agent loop, vs. local docker, vs. just-bash?
- How much work is **bash-on-our-own-FUSE-filesystem** (F#) vs. adopting a tool —
  is owning it worth it given we already have an F# filesystem substrate?
- Either way: the **port + fact-envelope + gate** (Phase 1) is identical regardless
  of which impl wins — so Phase 1 is safe to build now; the impl choice (Phase 2)
  is what this review informs.

## §3 Security floor — giving an LLM a shell is HARD-LIMITS-relevant

A local-LLM with a bash surface is a real attack/footgun surface. The floor (per
`methodology-hard-limits` + `non-coercion-invariant` + `classifier-bypass-research`):

- **Sandboxed by default — in the pinned config only** — the default executor pins
  just-bash's **in-memory filesystem + network-disabled** config, which **cannot**
  touch the real disk, network, or system. The tool is not the gate (§2 note);
  the **config** is. just-bash's OverlayFS/ReadWriteFs/network configs are
  Escalation-tier, gated.
- **Real-FS / network / docker is GATED** — escalation to a real shell is an
  explicit, operator-gated decision per item-class, never the loop's default. The
  fact-envelope makes every escalation an auditable `ActionExecutionStarted` event
  **carrying `{tier, gated}`** (glass-halo) — the audit distinguishes a sandbox run
  from a real-FS/docker escalation only because the tier is in the fact.
- **Not turned on in Otto's foreground loop** until "comfortable" (Aaron) — the
  fake executor + just-bash sandbox are the test/dev surfaces; the real-FS surface
  for the autonomous foreground loop is a separate, later, gated decision.

## §4 Open design question — what does do_item actually RUN?

`BacklogItem` carries `{id, title, ready, ambiguous, needsNewAction?}` — **no
command**. "Doing B-0883" is not a single shell line; it's open-ended agent work.
Three shapes (decide in review):

1. **Sub-loop:** `do_item` hands the item to the LLM, which runs a bounded
   observe→act sub-loop over the bash surface (build/test/edit) until done/blocked.
   Most general; most work. The fact-envelope records the sub-loop's outcome.
2. **Recipe-keyed:** an item maps to a `just` recipe (allowlist); `do_item` runs
   the recipe. Safest + simplest; only fits items that ARE a known task.
3. **Phase-1 stub:** `do_item`'s effect is the executor call with a
   caller-supplied script/recipe (the chooser/sub-loop supplies it later); for now
   prove the **envelope + port + transition** with a fake. Build the sub-loop (1)
   or recipe map (2) as a follow-up.

Recommendation: **Phase-1 = shape 3** (prove the event-sourcing envelope + injected
port + success/failure transition with a fake executor), then **shape 1** (the
LLM sub-loop over just-bash) as Phase 2.

## §5 Acceptance criteria (phased)

**Phase 1 — envelope + port + transition (fake executor; no new dep, no shell):**

- [ ] Fact-event types `ActionExecutionStarted | ActionExecutionSucceeded | ActionExecutionFailed`
      (+ `ModeChanged` if not already implied); decide persist-facts-only (§0).
      `ActionExecutionStarted` carries `{item, tier, gated}` (the executor tier +
      gate decision) so the glass-halo audit (§3) is real.
- [ ] `CommandExecutor` port (§1); `execute(do_item)` appends Started → runs
      executor → appends Succeeded|Failed → `simulate` **only on success**.
- [ ] `fold`/`replay` fold the FACTS (Succeeded ⇒ item leaves backlog; Failed ⇒
      stays) — **replay never calls the executor** (the correctness test).
- [ ] Tests: fake executor success path, failure path (item stays, mode unchanged
      or work), replay-folds-facts-without-executor, closed-loop.test.ts extended.

**Phase 2 — real surfaces (review-folded routing):**

- [ ] **local docker `CommandExecutor`** — the DEFAULT for real effectful work
      (real kernel, language-agnostic boundary the 4-oracle shares). Real
      namespaces/cgroups; gate per §3.
- [ ] **just-bash `CommandExecutor`** — for pure-text / no-FS items only. Package:
      **[`@archildata/just-bash`](https://www.npmjs.com/package/@archildata/just-bash)**
      (operator-provided coordinate 2026-06-01); pin in-memory FS + network-off;
      dep-pin-search-first for the current version at install; fake stays the CI default.
- [ ] (Optional) `just`-recipe executor for the allowlist tier.

**Phase 3 — escalation (gated, later):** CF Sandbox SDK (cloud-burst) +
just-bash OverlayFS/ReadWriteFs/network + real host shell — behind explicit
operator gating; NOT in the autonomous foreground loop until comfortable.

## §6 Master-checklist linkage

B-0958 LEFT #1 (effectful do_item) — this is its design + the bash-surface
decision. Under the sovereign-DB / observe.ts lane (B-0959 §2), reachable from
`docs/ACTIVE-WORKSTREAMS.md`. Composes B-0962 (do_item is the menu's work action)

- B-0963 (a completed do_item IS the "completion" the liveness proof is about).
