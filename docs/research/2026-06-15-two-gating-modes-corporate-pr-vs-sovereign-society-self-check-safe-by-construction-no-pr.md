# Two gating modes — corporate (GitHub PR) vs sovereign (society + self check, safe-by-construction, no-PR)

> **Aaron 2026-06-15 (shadow\*):** *"We are trying to move away from PRs — society
> and self check gating merges to main, not PRs; that's our `observe.ts` for
> sovereignty. We have another for corporate with GitHub-host PR integration. We're
> trying to move to no PRs but still safe by construction and society — and we
> almost have the math."*
>
> This **corrects PR #8328's framing** ("the PR gate is our model, same as
> Orthwein"): true for the *corporate* mode, but it mislabels the *direction*. The
> **gate abstracts** — the PR is one *instance*, not the gate itself.

## 0. The gate is the membrane; the PR is one instance

Under noninterference (§13) the merge gate is a **metered membrane** — the only
door by which a change *lands* on main. The PR is a *corporate-host instance* of
that membrane, not the membrane itself. "One membrane, two modes" is the **goal
abstraction**, NOT the current state (see §0a).

| | **Corporate mode** | **Sovereign mode** |
|---|---|---|
| Owner | **Max** ("Agent OS" / "Agentic OS", the `agentic-organization` repo) | **Aaron** (Zeta) |
| Gate | GitHub-host **PR + CI + review** | `observe.ts` **society-check + self-check** |
| Lands via | reviewed PR → squash-merge | direct-to-main, **no PR** |
| Safety | tests + human review at the PR | **safe by construction** + decorrelated society vote |
| Status | operative today | **trajectory — "we almost have the math"** |

## 0a. Current state: two loops, two owners, converging by mutual learning

Aaron 2026-06-15: *"Max is working on corporate mode and I'm working on sovereign …
the agentic-organization repo is in this same Zeta repo … max and i are learning from
each other — he looks at mine and i look at his and we combine ideas; the two are
becoming one."* Both loops are **in-repo**, two clearly-owned domains:

- **Max — corporate.** `agentic-organization/` (ALL Max — verified at repo root +
  `openspec/specs/agentic-organization/`): the corporate `observe.ts`
  (`agentic-organization/packages/application/src/observe.ts`, "Agent OS" /
  "Agentic OS"), GitHub-integrated, including the change-control port (§0b).
- **Aaron — sovereign.** ALL in **`src/`** (`src/Core.TypeScript/observe/observe.ts`
  — the pure-function controller, "a sovereign agent in the loop feels free"). Note:
  `tools/` is for `.sh`/`.ps1` scripts only; Aaron's sovereign code lives under `src/`.

They share the **same architectural shape** (a pure function over a snapshot → an
action DU — `observe.ts` says so explicitly) and are **converging by cross-pollination**
(each reads the other's; ideas combine; "the two are becoming one"). This note
describes that convergence — not a finished merge.

## 0b. The host/gate is a PORT — the ChangeSet is canonical, the PR is a view

Aaron 2026-06-15: *"GitHub will just be an impl of our IHost interface; we'll have
our own Reticulum/git based on that — doesn't require a centralized IHost."* The
in-repo realization of Aaron's "IHost" is **`ChangeControlPort` (CC4)** in **Max's**
corporate side — `agentic-organization/packages/application/src/change-control-port.ts`:

> *"The internal `ChangeSet` is canonical; a port materializes ONE stage of it onto
> an external system (GitHub PR / GitLab MR / Jira card) and reconciles the external
> decision back IN."* — `project / pull / push / merge`.

The load-bearing inversion: **the canonical artifact is the internal `ChangeSet`,
NOT the PR.** The PR is a *projected view a human can use*, not the source of truth.
So "move away from PRs" = **swap the port adapter** — the architecture already
supports it:

- **`change-control-github` (CC5)** — the GitHub PR adapter (Max's
  `agentic-organization`; live REST over fetch, with a roundtrip test). The
  corporate/centralized impl.
- **`NullChangeControlPort`** — internal-only orgs: every method a no-op, the
  external review stage **degrades to auto-approve so it never blocks**. The
  **sovereign base** — no external/centralized host required.
- **Sovereign adapter (the direction Aaron is building in `src/`)** — a
  `ChangeControlPort` whose review *stage* is the **society-check + self-check**
  (decorrelated vote + safe-by-construction proof) over a **Reticulum/git** backend
  instead of an external human PR. Same port, decentralized adapter; the canonical
  `ChangeSet` lands to main with no external PR.

This is the hexagonal ports-and-adapters pattern (Cockburn), same as `UniversalNumber`
and the workflow-engine's `World` (six git backends behind one interface): GitHub is
one adapter; sovereignty is another; the *port* is the stable thing. **The
convergence (§0a) IS this:** Max's change-control port + Aaron's society/self-check
sovereign loop becoming one — corporate and sovereign as two adapters of the same
gate.

## 1. What "society + self check" means (the synthesis of the session)

- **Self-check = build = verify (safe by construction).** The change carries its own
  proof — the **verified gate** (the veri-coding stack; Lean proofs; the 4-language
  byte-lock; golden vectors). Merge is safe because the artifact is *proven*, not
  because a human eyeballed it.
- **Society-check = the decorrelated-society vote** (the society-is-the-AGI thesis,
  §B row; `2026-06-15-coworker-not-control-...`). A decorrelated ensemble accepts
  the merge; agreement is the signal.
- **"We almost have the math" = the routed ΔU-aggregation proof**
  (`081KV6B1MBM` — society > best individual under ρ-low + competence). That proof
  is *what makes the society-check sound enough to replace human review.*

## 2. Why the math is load-bearing (the peels)

1. **Decorrelation IS the safety.** A society-check of *correlated* agents is a
   rubber-stamp — **worse than a PR** (it looks like N checks, it's one). The
   Condorcet/ρ-low condition is the difference between "no-PR safe" and
   "no-PR theater." This is exactly the ΔU-aggregation precondition.
2. **"Almost" ≠ done — keep the fallback.** Until the ΔU-aggregation proof + the
   safe-by-construction proofs discharge, the **corporate PR/CI gate is the operative
   safety.** Do not drop PRs before the math lands; that is the irreversible-mistake
   risk (`non-reversible-action-get-a-second-opinion`).
3. **Two boundaries, both modes (from #8328).** What *lands* = the gate
   (PR or society+self); what the agent *does while running* (secrets,
   outward/irreversible side-effects) = §13 metered channels + gated-classes. No-PR
   changes the *landing* gate, **not** the runtime-side-effect layer.

## 3. The end state (stated honestly as a goal, not a fact)

A change is generated, **proves itself** (self-check, safe-by-construction), is
**accepted by a decorrelated society** (society-check), and **merges to main with no
PR** — faster than human review *and* safer (a proof beats an eyeball), because the
gate verifies rather than inspects. The corporate PR mode remains the **interop
surface** for GitHub-hosted collaboration (the contribute-back / external-repo path,
§23) — sovereignty internally, PR-compatible at the corporate boundary.

## Anchors

`src/Core.TypeScript/observe/observe.ts` (sovereign loop controller) +
`agentic-organization/.../observe.ts` (co-maintainer, at scale) · noninterference
§13 (the gate as metered membrane) · the society-is-the-AGI / coworker thesis (§B
row) + coupled empowerment (Salge–Polani) · the ΔU-aggregation / generalized-Condorcet
proof (`081KV6B1MBM` — the "math") · build = verify / veri-coding (Lean, 4-lang
byte-lock, golden vectors) · `non-reversible-action-get-a-second-opinion` (keep the
PR fallback until the proof lands) · PR #8328 (the framing this corrects).
