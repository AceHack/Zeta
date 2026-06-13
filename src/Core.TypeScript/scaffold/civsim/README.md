# civsim

**Civsim** is a turn-based civilisation simulation with AI-directed factions,
mutual-privacy design, and Destiny-style PvP raids — built on the
[Zeta](https://github.com/Lucent-Financial-Group/Zeta) platform.

## Status

**Pre-v1. No production users.**

Civsim is a product of [Lucent Financial Group](https://github.com/Lucent-Financial-Group).
Factory tooling, core skills, and the Zeta runtime live in the Zeta monorepo.
This repo holds civsim-specific game substrate, design docs, and product CI.

## What this repo contains

- `docs/` — game design documents, faction substrate, scenario specs
- `.claude/` — product-scoped Claude Code bootstrap (references Zeta for factory tools)
- `LICENSE` — honor-system public license (forking welcome; mutual-privacy clause)
- `.zeta-version` — pinned Zeta release SHA this product is built against

## Forking

Civsim is explicitly **fork-friendly**. If you fork, the only ask is the
mutual-privacy clause in the license: keep what you want private, as we keep
what we want private — no structural strategic advantage to either side.

See [`LICENSE`](LICENSE) for the full honor-system text.

## Factory connection

Civsim is built on Zeta. The `.zeta-version` file pins the Zeta commit SHA
this product is built against. Factory tools are accessed via the Zeta repo;
this repo does not duplicate factory infrastructure.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Honor-system public license — see [`LICENSE`](LICENSE).
