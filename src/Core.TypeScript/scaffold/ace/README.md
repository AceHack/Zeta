# ace — package manager

**ace** is the package manager for the Lucent Financial Group software
stack. It distributes the [Forge](https://github.com/Lucent-Financial-Group/Forge)
factory, the [Zeta](https://github.com/Lucent-Financial-Group/Zeta) database,
and its own updates to future adopters.

Zeta serves as ace's persistence layer. ace closes the Ouroboros loop:

```
ace pull forge@<version>
ace pull zeta@<version>
```

## Status

**Pre-v1. No implementation yet.**

ace is planned but unbuilt. This repo is the day-one scaffolding shell
created during Stage 1 of the three-repo split
([ADR 2026-04-22](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md)).
Implementation begins when Zeta approaches v1 (Stage 3 of the migration
plan).

## Name

`ace` — lowercase, Unix-CLI convention. Name resolved 2026-04-20; see
[ace design doc](https://github.com/Lucent-Financial-Group/Zeta/blob/main/memory/project_ace_package_manager_agent_negotiation_propagation.md)
in the Zeta repo.

## Governance

ace is **human-maintainer-owned** for final governance (name, product
direction, public-announce timing). The factory's AI agent has authoring
and operation rights (land code, configure CI, open PRs).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

## License

Apache 2.0 — see [`LICENSE`](LICENSE).
