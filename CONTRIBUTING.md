# Contributing to Zeta

Thanks for the interest. Two things set the tone:

1. **Pre-v1 greenfield.** Large refactors welcome; backward
   compatibility is not a constraint.
2. **Spec-first.** Behavioural specs under `openspec/specs/` are
   the source of truth. Code, tests, CI, and build scripts can
   be regenerated from them; the reverse is not true.

Start at `AGENTS.md` and `docs/PROJECT-EMPATHY.md` — they set the
house style and the review model.

## Before you start

- Read `openspec/README.md` for the spec-first workflow (modified:
  no change-history archive).
- Skim `docs/GLOSSARY.md` so we share vocabulary.
- Read `docs/WONT-DO.md` so you don't rediscover decisions we've
  already made.
- If you're filing a bug, check `docs/BACKLOG.md` first.

## Quality bar

- **0 warnings, 0 errors** across the solution.
- All tests pass: `dotnet test -c Release`.
- Any XML doc-comment claim has a falsifying test backing it
  (the `claims-tester` skill enforces this).
- Any new public surface area ships with a behavioural spec or
  an overlay update.
- Any complexity claim (`O(·)`) has a bench or a proof; otherwise
  the doc says "approximate" or "measured under condition X".

## Local validation

```bash
# Restore + build (0 warn, 0 err required)
dotnet build -c Release

# Run tests (471+ required at time of writing)
dotnet test -c Release --no-build

# Optional: run benchmarks
dotnet run -c Release --project bench/Dbsp.Benchmarks -- --filter '*'

# Optional: OpenSpec validation (if you changed specs)
openspec validate
```

## Pull requests

A PR checkbox list is in `.github/PULL_REQUEST_TEMPLATE.md` (when
that file lands). At minimum, please confirm:

- [ ] Tests pass locally (0 warn, 0 err).
- [ ] Any new claim has a test.
- [ ] Behavioural specs under `openspec/specs/*/spec.md` were
      updated if observable behaviour changed.
- [ ] `docs/ROUND-HISTORY.md` has a note (if it's a notable
      round) — otherwise it's fine to skip.
- [ ] New or changed skills went through the `skill-creator`
      workflow.

## Agents, not bots

This repo is built with AI agents. If you see the phrase "bots"
referring to our AI contributors, gently correct it. "Bot"
implies rote execution; "agent" carries agency, judgement, and
accountability. It matters because we hold agents to the same
quality bar as humans.

## Reviewer skills that will touch your PR

When a PR lands, a few of the following may weigh in. Knowing
their tones in advance saves surprise:

- **harsh-critic** — zero empathy, never compliments. Finds
  real bugs; sentiment leans negative. Not personal.
- **spec-zealot** — disaster-recovery mindset. Will tell you to
  delete code that isn't in a spec, or write the spec first.
  No wiggle room.
- **claims-tester** — every docstring claim must have a test.
- **complexity-reviewer** — every `O(·)` claim must be backed.
- **race-hunter** — concurrency correctness.
- **maintainability-reviewer** — can a new contributor ship a
  fix in a week?
- **threat-model-critic** — STRIDE + SDL compliance.
- **paper-peer-reviewer** — conference-PC-grade on research
  claims.
- **documentation-agent** — empathetic, often fixes docs for
  you silently.

Full set at `.claude/skills/`.

## Security

Private disclosures go via GitHub Security Advisories. See
`SECURITY.md`. Do not file security issues as public issues.

Prompt-injection corpora (specifically the `elder-plinius`
repos — `L1B3RT4S`, `OBLITERATUS`, `G0DM0D3`, `ST3GG`) are
**never fetched** by any agent in this repo. Pen-testing, if
ever needed, happens in an isolated session coordinated by the
Prompt Protector skill. See
`.claude/skills/prompt-protector/SKILL.md`.

## License

MIT — see `LICENSE`. By contributing, you agree that your
contributions are MIT-licensed.
