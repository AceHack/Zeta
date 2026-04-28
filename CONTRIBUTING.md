# Contributing to Zeta

Welcome. Zeta is a research-grade F# implementation of DBSP
on .NET 10 with a software-factory design — humans and AI
agents collaborate under a codified set of rules.

**New to open source, or directing an AI to do the
writing for you?** Read
[`docs/FIRST-PR.md`](docs/FIRST-PR.md) first — it is
UI-first and assumes no prior git / F# / terminal
experience. This doc is the competent-dev version.

## Quick start

```bash
# One-time setup (runs on dev laptop, CI runner, or devcontainer)
tools/setup/install.sh

# Open a new shell so the managed PATH / DOTNET_ROOT / JAVA_HOME
# exports from $HOME/.config/zeta/shellenv.sh take effect. Your
# existing shell still has the old PATH.

# Build (0 Warning(s), 0 Error(s) required — TreatWarningsAsErrors is on)
dotnet build Zeta.sln -c Release

# Test
dotnet test Zeta.sln -c Release --no-build

# Health check (optional, diagnose a broken toolchain)
tools/setup/doctor.sh
```

The install script installs everything a first-class dev
setup needs: dotnet SDK (via mise), JDK 21 (for Alloy +
TLC), elan (Lean toolchain), Semgrep, dotnet-stryker, the
TLA+ and Alloy jars. Re-run it any time to keep tools
fresh; it's idempotent. `tools/setup/doctor.sh` reports
the state of each managed tool when something doesn't
work.

## Branch model for a trivial PR

For a first-PR (typo fix, doc tweak, small test), branch
directly off `main` with a descriptive branch name
(`fix-readme-link`, not `round-N`). Round branches
(`round-34-…`) are reserved for multi-commit round-scoped
work the Architect coordinates. Open the PR against `main`;
squash-merge is the default.

## Entry-point tree — where things live

**Tone and values:**

- [`AGENTS.md`](AGENTS.md) — philosophy, values, onboarding.
  How humans + AI agents approach this repo.
- [`docs/CONFLICT-RESOLUTION.md`](docs/CONFLICT-RESOLUTION.md) —
  the specialist cast, conflict-resolution protocol.
- [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — shared
  vocabulary.

**Rules:**

- [`GOVERNANCE.md`](GOVERNANCE.md) — 26 numbered rules.
  Start here for the binding discipline.
- [`CLAUDE.md`](CLAUDE.md) — Claude Code-specific
  guidance for AI agents working in this repo.
- [`docs/AGENT-BEST-PRACTICES.md`](docs/AGENT-BEST-PRACTICES.md)
  — BP-NN cross-references used in reviewer findings.

**Current state:**

- [`docs/CURRENT-ROUND.md`](docs/CURRENT-ROUND.md) — what
  we're working on right now.
- [`docs/BACKLOG.md`](docs/BACKLOG.md) — P0 / P1 / P2
  items.
- [`docs/DEBT.md`](docs/DEBT.md) — known maintenance
  debt.
- [`docs/BUGS.md`](docs/BUGS.md) — known broken things.

**Historical narrative:**

- [`docs/ROUND-HISTORY.md`](docs/ROUND-HISTORY.md) — the
  round-by-round journal. Newest round first.
- [`docs/WINS.md`](docs/WINS.md) — patterns worth
  preserving.
- [`docs/DECISIONS/`](docs/DECISIONS/) — ADR-style
  dated decisions.

**Specs:**

- [`openspec/specs/`](openspec/specs/) — behavioural
  specs (consumer-facing contract).
- [`tools/tla/specs/`](tools/tla/specs/) — TLA+ formal
  specs.
- [`tools/alloy/specs/`](tools/alloy/specs/) — Alloy
  structural specs.
- [`tools/lean4/Lean4/`](tools/lean4/Lean4/) —
  machine-checked proofs.

**Skills + agents:**

- [`.claude/skills/`](.claude/skills/) — 50+ capability
  skills (hats any persona can wear).
- [`.claude/agents/`](.claude/agents/) — named persona
  definitions.
- [`docs/EXPERT-REGISTRY.md`](docs/EXPERT-REGISTRY.md) —
  the cast.

**CI + infrastructure:**

- [`tools/setup/`](tools/setup/) — the three-way-parity
  install script.
- [`.github/workflows/`](.github/workflows/) — CI
  workflows.
- [`docs/research/ci-workflow-design.md`](docs/research/ci-workflow-design.md)
  — rationale for the CI shape.

## Two things that set the tone

1. **Pre-v1, greenfield.** Large refactors welcome;
   backwards compatibility is not a constraint. No
   alias cruft; when a thing is retired it's
   deleted, not deprecated.
2. **Spec-first.** Behavioural specs under
   `openspec/specs/` describe the contract; code,
   tests, CI, and install scripts derive from them.
   The reverse is not true — changing code without
   updating the spec is a Viktor (`spec-zealot`) P0.

## Quality bar

- **0 warnings, 0 errors** across the solution. Per
  `Directory.Build.props`, `TreatWarningsAsErrors` is on.
  A warning is a build break.
- All tests pass under `dotnet test -c Release`.
- Any XML doc-comment claim has a falsifying test backing
  it — Adaeze (`claims-tester`) enforces this.
- Any new public surface lands with a behavioural spec
  update and Ilyana (`public-api-designer`) review.
- Any complexity claim has a bench or a proof; otherwise
  the doc says "approximate" or "measured under X".
- Any CI change goes through Aaron review (round-29
  discipline).

## Pull requests

Round-scoped branches (`round-N`) PR to `main` at
round-close; individual feature PRs are possible but
uncommon in the factory cadence. See
`.claude/skills/git-workflow-expert/SKILL.md` for the
full branch model.

**PR checklist (self):**

- [ ] `dotnet build -c Release` — 0 W / 0 E.
- [ ] `dotnet test -c Release` — all green.
- [ ] Any new claim has a test.
- [ ] Behavioural specs updated if observable behaviour
      changed.
- [ ] New or changed skills went through the
      `skill-creator` workflow (`.claude/skills/
      skill-creator/SKILL.md`).
- [ ] Reviewer floor per GOVERNANCE §20 (Kira + Rune at
      minimum on any code landing).

## Agents, not bots

This repo is built with AI agents. If you see the word
"bots" referring to our AI contributors, gently correct
it. "Bot" implies rote execution; "agent" carries
agency, judgement, and accountability. It matters
because we hold agents to the same quality bar as
humans.

## Reviewer skills that will touch your PR

When a PR lands, several of the following may weigh in.
Knowing their tones in advance saves surprise. Full set
at `.claude/skills/`.

- **Kira (harsh-critic)** — zero empathy, never
  compliments. Finds real bugs. Not personal.
- **Rune (maintainability-reviewer)** — "can a new
  contributor ship a fix in a week?"
- **Viktor (spec-zealot)** — disaster-recovery mindset
  on spec-to-code drift.
- **Adaeze (claims-tester)** — every docstring claim
  has a test or the claim goes.
- **Hiroshi (complexity-reviewer)** — every `O(·)`
  claim is backed.
- **race-hunter** — concurrency correctness in F#.
- **Aminata (threat-model-critic)** — STRIDE + SDL.
- **Mateo (security-researcher)** — supply-chain +
  novel attack classes.
- **Ilyana (public-api-designer)** — every public API
  change.
- **Samir (documentation-agent)** — empathetic; often
  fixes docs for you silently.
- **Dejan (devops-engineer)** — install script + CI
  owner.
- **Aarav (skill-expert)** — meta-skill on the skill
  library itself.

## Upstream contributions

Per GOVERNANCE §23, contributions to upstream
open-source projects we depend on are encouraged.
Clone the upstream to `../<repo>/` as a sibling, fix,
push, PR upstream. Zeta never carries a fork in-tree;
temporary pins flow through `docs/INSTALLED.md` with
GOVERNANCE §25's three-round expiry.

## Security

Private disclosures via GitHub Security Advisories.
See [`SECURITY.md`](SECURITY.md). Do not file security
issues as public issues.

**Prompt-injection corpora are never fetched by any
agent in this repo.** Specifically the `elder-plinius`
family (`L1B3RT4S`, `OBLITERATUS`, `G0DM0D3`, `ST3GG`).
Pen-testing, if ever needed, happens in an isolated
session coordinated by Nadia (`prompt-protector`). See
`.claude/skills/prompt-protector/SKILL.md`.

## License

MIT — see [`LICENSE`](LICENSE). By contributing, you
agree your contributions are MIT-licensed.
