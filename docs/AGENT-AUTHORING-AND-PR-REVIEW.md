# Agent authoring + PR review — operational entry point

This is the curated entry-point for two questions every team member (human or agent) eventually asks:

1. **What do my agents follow to write good code without needing human review?**
2. **What's the PR review process I can hook into for an adversarial-review hierarchy?**

The answers exist across multiple substrate surfaces in this repo; this document consolidates them so you don't have to discover each one independently.

## Why this doc

Max 2026-05-25, paraphrased through Aaron: *"what do I point my agents at to write good code without needing human review, and what's the PR review process I can hook into for my adversarial hierarchy of traps."* The pattern-match on the manifesto-named-file as "the rules my agents must follow" is exactly the failure mode 081KRMEXM0008QG0R00278KS63 (manifesto → building-codes recast) is targeting. This doc names the actual operational surface.

Max's *"adversarial hierarchy of traps"* coining is operationally accurate — the substrate IS a hierarchy of adversarial reviewers, each with a specific lens, that compose for multi-perspective review. The hierarchy already exists; this doc tells you how to invoke it.

## Question 1 — What discipline do agent-authored PRs follow?

Six entry points, each with a different scope:

| Surface | Scope | Loading model |
|---------|-------|---------------|
| [`CLAUDE.md`](../CLAUDE.md) | Project-wide bootstrap; first thing any agent reads | Auto-loaded at session start |
| [`AGENTS.md`](../AGENTS.md) | Cross-agent governance; how agents coordinate | Read on first agent operation |
| [`docs/ALIGNMENT.md`](ALIGNMENT.md) | The alignment floor (HC-1..HC-7 / SD-1..SD-8 / DIR-1..DIR-5) | Read when alignment-relevant decisions arise |
| [`docs/GLOSSARY.md`](GLOSSARY.md) | Vocabulary the framework uses (so "hat", "tick", "weight-free" etc. mean the same thing everywhere) | Read on terminology disambiguation |
| [`GOVERNANCE.md`](../GOVERNANCE.md) | Process — how decisions get made; debt-intentionality; round cadence | Read when participating in governance-shaped work |
| [`.claude/rules/*.md`](../.claude/rules/) | 60+ load-bearing rules: hard-won lessons, failure-mode catches, operational disciplines | Auto-loaded at session start (no `paths:` frontmatter means full-context load) |

### The fast read

If you're an agent and you need to write code that lands without human review, the minimum-viable read is:

1. **`CLAUDE.md`** (start here; everything else is reachable from this)
2. The **`.claude/rules/*.md`** auto-load (60+ files; happens automatically; covers most operational discipline including never-be-idle, don't-ask-permission, refresh-before-decide, holding-without-named-dependency-is-standing-by-failure, verify-before-deferring, substrate-or-it-didnt-happen, razor-discipline, default-to-both, non-coercion-invariant, etc.)
3. **`docs/ALIGNMENT.md`** when alignment-relevant work surfaces
4. **`AGENTS.md`** when you're going to coordinate with another agent

That's roughly 60-80 KB of discipline. It loads in seconds at session start; reading it once gives you the operational floor.

### When in doubt

When a discipline question arises, the algorithm is:

1. Search `.claude/rules/` for a relevant rule (`rg "your-topic" .claude/rules/` — `grep -l` without `-r` doesn't recurse, so use ripgrep or `grep -rl "your-topic" .claude/rules/`)
2. If found, follow it; cross-link to it in your work
3. If not found and the question is operationally load-bearing, file it as substrate (memory file + rule + cross-link from CLAUDE.md) — per the wake-time-substrate-or-it-didnt-happen discipline

## Question 2 — Adversarial-review hierarchy you can hook into

There are four layers of adversarial review already wired. Each layer has its own scope; they compose.

### Layer 1 — Persona reviewers (the operator's-direct-tool layer)

Located in [`.claude/agents/`](../.claude/agents/). Invoked via the `Task` tool with `subagent_type` parameter. Each persona has a specific adversarial lens:

| Persona | Tool name | Lens |
|---------|-----------|------|
| Kira | `harsh-critic` | Zero-empathy F#/.NET correctness / perf / security / API / test-gap |
| Viktor | `spec-zealot` | Disaster-recovery-minded spec-to-code alignment; missing specs treated as existential |
| Rune | `maintainability-reviewer` | "Can a new contributor read this and ship a fix within a week?" |
| Aminata | `threat-model-critic` | Red-teams the shipped threat model for missing adversaries + unsound mitigations |
| Mateo | `security-researcher` | Proactive — novel attack classes, crypto primitives, supply-chain risk, CVEs |
| Nazar | `security-operations-engineer` | Runtime security ops; incident response; patch triage |
| Soraya | `formal-verification-expert` | Routes formal-verification work to the right tool (TLA+, Z3, Lean, Alloy, FsCheck, Stryker, Semgrep, CodeQL) |
| Naledi | `performance-engineer` | Benchmark-driven hot-path tuning; zero-alloc audits; SIMD dispatch |
| Ilyana | `public-api-designer` | Conservative public-API gatekeeper — every public member is a contract |
| Sova | `alignment-auditor` | Per-commit alignment signals against ALIGNMENT.md clauses |
| Rodney | `rodney` | Complexity reducer; well-defined Occam's razor on shipped artifacts |
| Bodhi | `developer-experience-engineer` | First-60-minutes contributor friction audit |
| Iris | `user-experience-engineer` | First-10-minutes library-consumer audit |
| Daya | `agent-experience-engineer` | Per-persona cold-start cost; pointer drift; notebook hygiene |
| Dejan | `devops-engineer` | Install-script + CI workflow + infrastructure ops |

Invoke by tool-name (the role-ref column above; e.g., `subagent_type: harsh-critic`) for any PR where the lens is relevant. Compose multiple reviewers for multi-perspective review. Each reviewer's definition lives at `.claude/agents/<tool-name>.md` (the tool-name keys the file; persona handles in the leftmost column are human-readable shorthand for the role, not the invocation key).

### Layer 2 — Plugin reviewers (the pr-review-toolkit layer)

The `pr-review-toolkit@claude-plugins-official` plugin is already enabled in `.claude/settings.json`. Provides:

| Tool | Catches |
|------|---------|
| `code-reviewer` | Project-convention violations; style; common bug patterns |
| `code-simplifier` | Clarity, consistency, maintainability after a coding task |
| `comment-analyzer` | Comment accuracy + technical-debt-shaped comments |
| `pr-test-analyzer` | Test coverage gaps + critical-path test missing |
| `silent-failure-hunter` | Inadequate error handling; suppressed errors; bad fallbacks |
| `type-design-analyzer` | Type-invariant strength; encapsulation; useful-vs-leaky abstractions |

Invoke proactively after writing code, before opening a PR, after creating a PR. These pair with the persona reviewers — personas are domain-specific lenses; plugins are mechanical-correctness checks.

### Layer 3 — Auto-fire reviewers (GitHub-side)

These run on every PR without invocation:

- **GitHub Copilot pull-request reviewer** — code-quality findings; AI-pattern-detection
- **chatgpt-codex-connector** — P1/P2 findings on substantive issues; cross-PR contextual review

Both produce inline review threads. Their findings go through the same resolution flow (the `addPullRequestReviewThreadReply` + `resolveReviewThread` GraphQL mutations). When their findings are stale (the issue was fixed in a later commit), resolve with a note pointing at the fix commit. When their findings are valid, fix + push + resolve.

### Layer 4 — CI gates (mechanical correctness floor)

Defined in `.github/workflows/`. Required-check gates include:

- **markdownlint** — MD012 (consecutive blanks), MD032 (lists need blank-before), etc.
- **tsc (TypeScript strict)** — repo tsconfig has `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `strict`; any TS file in the repo must pass
- **dotnet build / test** (Release; `TreatWarningsAsErrors=true`) — F# + C# correctness
- **CodeQL** — security analysis on source-touching PRs
- **Lean / TLA+ / FsCheck / Stryker / Semgrep** — domain-specific verification where relevant

The CI gates are mechanical; they catch what they catch. They don't replace the human + persona + plugin review layers.

## Composing the layers (the "adversarial hierarchy" in practice)

For a typical PR the composition looks like:

1. **Author** writes the change
2. **Layer 4 (CI gates)** runs automatically on push; mechanical-correctness floor
3. **Layer 3 (auto-fire reviewers)** post findings to the PR threads
4. **Author** resolves Layer 3 threads (fix-and-resolve OR resolve-as-stale)
5. **Author proactively invokes Layer 2 (plugin reviewers)** on substantive code; addresses findings
6. **Author or reviewer invokes Layer 1 (persona reviewers)** for domain-specific adversarial lenses by tool-name (e.g., security-relevant change → `security-researcher` + `threat-model-critic` + `security-operations-engineer`; perf-relevant → `performance-engineer`; API change → `public-api-designer`)
7. **Human reviewer** (if any) audits the substrate trail + the resolved-thread chain; merges OR requests further work

The hierarchy doesn't have to fire in this order; the author can invoke Layer 1 + 2 BEFORE opening the PR to get a clean PR landing. Many PRs in this repo follow that pattern.

## Patterns you'll see repeatedly

- **Auto-merge armed early; CI + threads resolve as they fire** — common in this repo. PR is open + auto-merge armed; CI runs; reviewer threads post; author addresses; auto-merge fires when gates clear.
- **Rebase-then-resolve on DIRTY** — when main moves faster than the PR (especially when multiple rows landing simultaneously regenerate `docs/BACKLOG.md`), rebase + force-push + re-resolve threads. Pattern documented in `claim-acquire-before-worktree-work.md`.
- **Stale-thread resolution** — Copilot + Codex review old commits sometimes; if the issue is fixed in a later commit, reply with the fix-commit SHA + resolve.
- **Suspect-by-default FP classes** — see `blocked-green-ci-investigate-threads.md` for known false-positive classes from Copilot (e.g., the table-double-pipe FP). Verify before applying a "fix."

## Substrate-honest framing

This doc consolidates pointers; it doesn't replace the substrate it points at. If something here drifts from the actual substrate (rules added, personas renamed, plugins enabled/disabled), update this doc — it's the index, not the source of truth.

This doc serves both humans (co-owners + future contributors) AND agents (Otto, Riven, Vera, Lior, Alexa, Kiro, any future agent), at first-contact with the project. The disciplines named here are what the team operates under; participation = compliance by default; deviation requires substrate-honest discussion.

## Composes with

- [`CLAUDE.md`](../CLAUDE.md) — project bootstrap
- [`AGENTS.md`](../AGENTS.md) — cross-agent governance
- [`docs/ALIGNMENT.md`](ALIGNMENT.md) — alignment floor
- [`GOVERNANCE.md`](../GOVERNANCE.md) — process
- [`.claude/rules/`](../.claude/rules/) — the auto-loaded discipline library
- [`.claude/agents/`](../.claude/agents/) — persona reviewer definitions
- [`memory/max/`](../memory/max/) — Max's persona; this doc is one of his entry points
- [`memory/addison/`](../memory/addison/) — Addison's persona; same
- 081KRMEXM0008QG0R00278KS63 — manifesto → building-codes recast (addresses the manifesto-vs-operational-spec misread that motivated this doc)
- 081KSE6WT0008QG0R00195RG48 — TS hat-system operator (Max's primary substrate-engineering target; learning path included)
- 081KSE6WT0008QG0R0005XASX2 — destructive-tool authoring contract (pattern for tools that destroy things)
