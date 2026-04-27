# Security Policy

## Reporting a vulnerability

Pre-v1 / greenfield — no production callers yet. If you think you've
found a vulnerability before v1 ships:

- **Open a [GitHub issue](https://github.com/Lucent-Financial-Group/Zeta/issues/new?labels=security)** with the `security` label.
- **Or use [GitHub's private vulnerability reporting](https://github.com/Lucent-Financial-Group/Zeta/security/advisories/new)** for anything that could be sensitive.

There's no separate disclosure inbox until we have users. Post-v1 this
will move to a coordinated-disclosure process documented at the
[GitHub security advisories page](https://github.com/Lucent-Financial-Group/Zeta/security/advisories).

## Supported versions

None yet. We ship once the full SDL checklist
(`docs/security/SDL-CHECKLIST.md`) is green.

## Security posture

- **Trust boundaries** described in `docs/security/THREAT-MODEL.md`
  (STRIDE-indexed).
- **Crypto choices** rationale in `docs/security/CRYPTO.md`.
- **Dependency audit** via `tools/audit-packages.sh` (the package
  auditor skill reviews bumps).
- **Static analysis** via Semgrep (`.semgrep.yml`, 12 rules) +
  G-Research + Ionide + Meziantou F# analyzers.
- **Formal verification** via 13 TLA+ specs (6 TLC-validated),
  Z3 pointwise proofs, FsCheck property tests.
- **Deterministic simulation testing** via `ChaosEnvironment` +
  `VirtualTimeScheduler` (FoundationDB DST-inspired).

## Threat-model-as-code

We use `pytm` (P1) or `docs/security/THREAT-MODEL.md` markdown as
the source of truth. Microsoft Threat Modeling Tool exports live in
`docs/security/tmt-exports/` when a contributor runs TMT inside a
Windows VM; the Mac-side authoritative source is the markdown.

## Elevation of Privilege card game

Adam Shostack's EoP card game (CC-BY-3.0) is used as a reference
during Security Auditor reviewer passes. Download from the
upstream project — we do not vendor the PDFs in this repo.
