# Security policy

## Supported versions

ace is pre-v1. All versions on `main` are supported.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting:
**Security → Report a vulnerability** on this repository.

Do **not** open a public issue for security vulnerabilities.

We aim to acknowledge reports within 2 business days.

## Scope

ace is a package manager. Primary attack surfaces:

- Package manifest tampering (integrity verification is a core design requirement)
- Supply-chain compromise via Bun package dependencies
- CI workflow poisoning (SHA-pinned actions, minimal permissions)
- Prompt-injection via package metadata consumed by agent workflows

## Out of scope

Vulnerabilities in upstream packages should be reported to those projects.
We track upstream advisories via Dependabot.
