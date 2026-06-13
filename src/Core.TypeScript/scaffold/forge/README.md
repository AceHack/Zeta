# Forge — software factory

**Forge** is the software factory that builds, tests, and ships the
[Zeta](https://github.com/Lucent-Financial-Group/Zeta) database and the
[ace](https://github.com/Lucent-Financial-Group/ace) package manager.

Forge also builds itself — it is self-hosting.

## Status

**Pre-v1. No production users.**

Content is migrating from `Lucent-Financial-Group/Zeta` (Stage 2 of
the three-repo split per
[ADR 2026-04-22](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md)).
Until Stage 2 completes, the canonical factory tooling lives in Zeta.

## What Forge contains (post-migration)

- `.claude/skills/` — agent skill catalog (the factory's materia)
- `.claude/agents/` — persona registry
- `.claude/commands/` — harness slash commands
- `tools/hygiene/` — factory hygiene scripts
- `tools/setup/` — install graph (pre-bootstrap shell only)
- `docs/AGENT-BEST-PRACTICES.md` — the `BP-NN` rule list
- `docs/FACTORY-HYGIENE.md` — hygiene cadence and checklists
- `docs/hygiene-history/` — append-only tick history
- `memory/persona/` — persona notebooks (stays with personas)
- `docs/research/` — factory-level research archive

## The Ouroboros loop

```
Forge  →  builds  →  Zeta
  ↑                    ↓
ace  ←  distributes  ←  Forge
  ↓                    ↑
Zeta  ←  persists   ←  ace
  └────  Forge  →  Forge (self-build)
```

Four dependency edges, zero DAG — this is why there are no submodules.

## Governance

Forge is governed by the **factory's AI agent** (factory policy, BP-NN rules,
skill catalog, persona registry). The human maintainer retains
alignment-contract veto and budget authority. Full model:
[ADR 2026-04-22 §Ownership model](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md#ownership-model).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).
The three load-bearing values: truth over politeness, algebra over
engineering, velocity over stability.

## License

Apache 2.0 — see [`LICENSE`](LICENSE).
