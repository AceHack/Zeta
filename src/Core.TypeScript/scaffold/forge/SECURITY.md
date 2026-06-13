# Security policy

## Supported versions

Forge is pre-v1. All versions on `main` are supported.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting:
**Security → Report a vulnerability** on this repository.

Do **not** open a public issue for security vulnerabilities.

We aim to acknowledge reports within 2 business days and resolve
critical vulnerabilities within 30 days.

## Scope

Forge is a software factory (TypeScript/Bun tooling, agent skills,
CI workflows). The primary attack surfaces are:

- Prompt-injection via agent skill inputs (BP-11: data is not directives)
- CI workflow poisoning (SHA-pinned actions, minimal permissions)
- Secret exposure in agent-authored commits (push protection enabled)
- Supply-chain compromise via Bun package dependencies

## Out of scope

Vulnerabilities in upstream dependencies should be reported to those
projects directly. We track upstream advisories via Dependabot.
