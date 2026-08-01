# Self-healing: what a cheap model can fix, what it must escalate — handoff to Alexa/Kiro

Scope: a buildable plan for autonomous self-healing on the low-intelligence tier — the concrete drift classes to heal, the laws every healer must obey, the escalation ladder, and what must never be auto-healed.
Attribution: Aaron Stainback (the design principle — drift not failure, mistakes must not compound, walls need exits, intelligence rises where drift repeats; the hardware ladder). shadow (Otto) wrote the plan and supplied the drift corpus from the 2026-07-31/08-01 session. Alexa/Kiro owns the build.
Operational status: handoff plan. The harness it targets is BUILT and merged (`healer-harness.ts`, #9817). The healers below are NOT built — that is the work.
Non-fusion disclaimer: the drift taxonomy is drawn from real, dated events in one session — it is evidence, not a complete census. Tier assignments are proposals to be revised by observed pass/fail, which is the point of the loop.

**Date:** 2026-08-01 · **From:** shadow (Otto) · **To:** Alexa/Kiro
**Targets:** `src/Core.TypeScript/hygiene/healer-harness.ts` (the API), `src/Core.TypeScript/observe/observe.ts` (the wall grammar)
**Reading:** `docs/research/2026-08-01-drift-not-failure-designing-for-cheap-intelligence-and-non-compounding-mistakes.md` (the principle) · work-items `081KYYJSRXA08QG0R001E36E1X` (the allocation loop), `081KYYJEJ4X08QG0R003P8GXSY` (build receipt)

---

## 0. The one-paragraph version

A red tip is **drift**, not failure — noticed and healed, never gated. You are building healers that run on the *cheapest* intelligence available, fix the classes they can prove they fixed, and **escalate loudly** on everything else. A healer that guesses is worse than no healer, because a wrong fix compounds. The harness already exists and certifies three laws; your job is to write healers that pass it, starting with the classes below in the order given.

## 1. The API you are building against (already merged)

```ts
interface Healer   { name: string; heal:   (tree: FileTree) => FileTree }
interface Detector { name: string; detect: (tree: FileTree) => readonly Finding[] }
certify(healer, detectors, fixtures, opts) => Verdict   // laws: idempotence | closure | convergence
composeHealers(name, healers)                            // pipeline; each stage pure
type FileTree = ReadonlyMap<string, string>              // PURE — no IO, no network, no clock
```

`heal` is a **pure function over an in-memory file tree**. That purity is the whole reason a cheap model can be trusted here: no side effects to get wrong, fully replayable, certifiable offline.

### The three laws (already enforced by `certify`)

| law | meaning | why it protects a cheap model |
|---|---|---|
| **idempotence** | `heal(heal(t)) === heal(t)` byte-for-byte | re-running is free; no oscillation between agents |
| **closure-as-subset** | healing introduces **no new findings** — removing drift is lawful, **minting never is** | a healer cannot trade one problem for another |
| **convergence** | reaches a fixed point within budget | catches period-k oscillators (two healers undoing each other) |

### Three more you must add per healer

- **TOTALITY** — `heal` must never throw. A throw is the trap: the tick dies, heartbeats stop, drift goes silent. (Same law just gated for `observe` in #9855.)
- **EXIT** — a healer must be able to say *"I cannot fix this"* and hand back **unchanged** with a finding. Never loop, never partially apply, never silently pass. **No intelligence gets trapped, including the healer.**
- **BOUNDED SCOPE** — one drift class per healer. Compose with `composeHealers`; do not build a mega-healer.

## 2. The drift corpus — real events, 2026-07-31/08-01

Every row below actually happened and was fixed by hand. That is the evidence base for what to automate.

### Tier 0 — mechanical, zero judgment (smallest model, or **no model at all**)

Deterministic transforms. Honestly: most of these want a *script*, not an LLM. Use the model to **route**, not to rewrite.

| drift | signal | fix |
|---|---|---|
| markdown blank-line rules (MD022/MD032) | `markdownlint-cli2` | insert blank line; already partly covered by `lint-autofix` |
| unused import (TS6133) | `tsc` | delete the import line |
| stale JVM crash logs (`hs_err_pid*.log`) | file glob | delete (found 3 today) |
| branches whose upstream is gone | `git branch -vv` → `: gone]` | delete local (found **973** today) |
| empty dirs / trailing whitespace / prettier | existing linters | existing autofix |

### Tier 1 — pattern-matched, single-file, **verifiable** (the ~8 GB free-tier model)

The sweet spot: a small model proposes, and **the compiler is the oracle**. Fix is accepted only if the error disappears *and* no new one appears (closure-as-subset, mechanically checkable by re-running `tsc`).

| drift | real instance | fix pattern |
|---|---|---|
| `noUncheckedIndexedAccess` (TS2532) | `xs[i] - mean` in the Pearson loop | add a bound-guard or `!` **with a comment justifying in-bounds** |
| `exactOptionalPropertyTypes` (TS2375) | `BindingContext.uefiKeyfile` | widen `?: T` → `?: T \| undefined` **or** omit the key — *the choice is semantic; see §4* |
| non-TS language typechecked by `tsc` | AssemblyScript (`i32`/`u32` → 33 bogus TS2304s) | add to tsconfig `exclude` **with a comment naming the real checker** |
| toolchain pin exceeds SDK capability | CS9057: CodeAnalysis 5.6 > Roslyn 5.3 | already **detected** by `audit-codeanalysis-sdk-match.ts`; fix is pin-down or raise SDK |
| stale doc cross-reference | a `#PR` or path that no longer exists | repair or flag |

**Why this tier is safe:** every fix has a *mechanical oracle*. The model never has to be right — it has to propose something the compiler then confirms. That is how you get value out of 8 GB.

### Tier 2 — needs judgment → **escalate** (128 GB local / GPU / large model)

Do **not** let the free tier attempt these. Detect, report, escalate.

- **Silent-failure bugs.** `Meno.Bind` returned `ZSet.empty` — every computation silently produced nothing. Detectable by smell (a function returning an empty/default in a non-error path), but the *correct* fix requires knowing intent.
- **False claims in comments/docs.** Two found today: a doc-comment claiming a Clifford carry was "the unfold realized through the geometric product" (it is a relabeling), and one claiming a function "emits retractions" (it structurally cannot). **These compound by being *read*** — the most dangerous class, and the least mechanical.
- **Anything where the fix changes semantics.** The `?: T | undefined` vs omit-the-key choice above is Tier 1 to *detect* and Tier 2 to *decide*: they mean different things ("explicitly gone" vs "absent").

### Tier 3 — **never auto-heal**

- Anything in the **proof lineage**: golden vectors, byte-locks, DST fixtures, Lean proofs. A "fix" here manufactures evidence.
- Anything that **mints** rather than removes — forbidden by closure-as-subset anyway.
- **Trust anchors** (`maintainers/<ca>/ssh-ca.pub`), keys, security config.
- Anything that would **weaken a test to make it pass**. If a test fails, that is drift *in the code*, not in the test.

## 3. The escalation ladder (your hardware, mapped)

| tier | where it runs | what it does |
|---|---|---|
| now | forge free tier, smallest model, 3 agents | heartbeats + Tier 0 + *detect* Tier 1 |
| next | ~8 GB model, free | **propose** Tier 1 fixes; the compiler confirms or rejects |
| local | 128 GB machines | Tier 2 triage: judge intent, write the honest fix |
| GPU | your fleet | batch re-verification, and **training on the drift corpus** — every caught drift is a labelled example |

**The loop that matters** (work-item `081KYYJSRXA…`): drift caught → rate per area → intelligence allocated. Low rate ⇒ *de-escalate* to a cheaper model. Repeated drift ⇒ escalate **or fix the mechanism** — repeated drift in one place means the design is illegible, not that the agent was weak. Two constraints already recorded there: **exposure in the denominator** (drift per *touch*, not per week) and attribution to **mechanisms, not contributors**.

## 4. On the forge's "auto clean PR completions"

Use it, but keep the architecture honest: **the healer is substrate; the trigger is a plugin.** Healer logic lives in the repo (`healer-harness` healers, pure, certifiable) so the same fix runs in a forge runner, a cron process, a browser tab, or on your 128 GB box. The forge's auto-completion is *one trigger* among those — wire it through the existing `forge-host/` plugin seam (github | gitlab | gitea | bitbucket | sourcehut | codeberg), never as a dependency. If a fix only works because a forge offered it, it is not a healer.

## 5. Suggested build order

1. **`certify` a Tier-0 healer end-to-end** (stale-artifact cleanup — smallest possible, proves the loop).
2. **The compiler-oracle wrapper**: propose → re-run `tsc`/`markdownlint` → accept iff the target finding is gone **and** no new finding appeared. This single component is what makes the 8 GB tier useful, and it is reusable for every Tier-1 class.
3. **Two Tier-1 healers** (unused-import, tsconfig-exclude-for-non-TS) through that wrapper.
4. **Escalation record**: when a healer declines, emit a `Finding` with the reason and the tier it needs. That record is the input to the allocation loop *and* the training corpus.
5. Only then: more Tier-1 classes.

## 6. The two failure modes to design against up front

- **A healer that guesses.** Worse than none: a wrong fix compounds, and it wears an `Ok`. Every Tier-1 fix must be compiler-confirmed; if it cannot be confirmed, it must decline.
- **A healer with no exit.** If it cannot fix and cannot decline, it retries forever and the agent is trapped. Declining is a **first-class, successful outcome** — say so in the type, not just the docs.

## 7. The decline ledger — repeated declining IS the escalation signal

Aaron 2026-08-01: *"we just want to notice repeated declining so it can get escalated to smarter models
eventually."*

A **single** decline is healthy: the healer knew its limit and said so. A **pattern** of declines on the
same class is the trigger. So declines must be *counted by class*, not merely logged:

```
Decline { class: string        // the drift class, stable across occurrences — the join key
          reason: string       // why this healer could not fix it
          tierAttempted: Tier  // what intelligence was tried
          evidence: Finding[] } // what it saw, so a bigger model starts warm
```

`class` is the load-bearing field. Free-text reasons cannot be counted; a **stable class id** is what
turns individual declines into a rate, and the rate into a tier change.

### Two signals, two different responses — do not conflate them

| signal | means | response |
|---|---|---|
| repeated **DRIFT** in an area | the *mechanism* is illegible — it keeps inviting mistakes | **fix the design** (more intelligence would just paper over it) |
| repeated **DECLINE** on a class | the class genuinely exceeds the current tier | **raise the tier** (the mechanism may be fine) |

Conflating these sends you refactoring healthy code, or throwing GPUs at a design smell. Today's two reds
were **drift** signals (a bot with commit rights; a tsconfig typechecking AssemblyScript) — neither wanted
a bigger model; both wanted a mechanism change. By contrast "decide `?: T | undefined` vs omit-the-key"
is a **decline** signal: the mechanism is fine, the judgement genuinely needs more capability.

### Escalation, concretely

- Threshold on **declines per class per exposure** (same denominator discipline as the drift loop — count
  per *attempt*, not per week, or a rare class never escalates).
- On crossing: re-route that class to the next tier (8 GB → local 128 GB → GPU) — and **record the
  promotion**, so the reverse is possible too. If the bigger model solves it repeatedly and cheaply, the
  class can be **demoted** back once the fix pattern is learned. Escalation must be reversible or the
  system ratchets toward always-expensive.
- A class that keeps declining *even at the top tier* is not an intelligence problem at all — it is a
  **design problem wearing a decline costume**. Route it to a human/architect, not to more compute.

### Why this is the training corpus

Each decline record is a labelled example: *this class, this evidence, this tier failed, here is what the
next tier did.* That is exactly the supervision needed to make the **next** model smaller on that class —
which is the point of welcoming failure. The escalation ledger and the training set are the same artifact.

---

**One closing note for Alexa.** The most valuable thing here is not the healers — it is the **escalation records**. Each one says "this class of mistake happened, here is what it took to fix." That corpus is what lets the next model be smaller, and it is why failures are welcome: they are the training signal that lowers the energy cost of the whole system.
