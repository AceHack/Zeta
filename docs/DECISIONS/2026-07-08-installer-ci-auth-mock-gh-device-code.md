# ADR: Installer CI Auth Uses Mock GitHub Device Code

Date: 2026-07-08
Status: DECIDED
Backlog: 081KSGS9H0008QG0R003JNSVR5
Owner: Riven (Cursor) for the operator-directed resolution

## Decision

Choose Approach A from
`docs/backlog/P1/081KSGS9H0008QG0R003JNSVR5-installer-interactive-login-vs-baked-in-keys-ci-test-tension.md`:
CI tests the installer GitHub device-code UX against a mock endpoint, not
against real GitHub credentials baked into the ISO.

The production ISO continues to ship with no GitHub PAT, no SSH private key,
and no CI-only secret. The operator path remains real `gh auth login` at
install or first-session time.

## Context

The installer needs an interactive GitHub authentication path so a fresh node
can fetch the operator's public SSH keys and later self-register with the
cluster. That path is intentionally human-in-the-loop: the ISO is publicly
downloadable, so baking a credential into it would convert testability pressure
into a secret-leakage bug.

The CI question is narrower: how can QEMU exercise the device-code prompt and
polling loop without a human typing the code and without any credential that
works against `api.github.com`?

## CI Fork

CI has exactly two allowed branches:

1. Use a mock GitHub device-code endpoint for auth-flow coverage. The stub
   returns a fixed `user_code`, fixed verification URI, and an in-memory stub
   token. That token is valid only inside the mock surface and must never be
   accepted by real GitHub APIs.
2. Skip live `gh auth login` with an explicit serial/log marker when the test
   slice is not exercising auth. The skip must be visible in artifacts so a
   green QEMU run cannot pretend auth coverage happened.

The production path is not forked through this stub. Real installs keep calling
real `gh auth login`; the mock belongs to CI harness code and follow-on QEMU
integration only.

The initial stub lives at
`src/Core.TypeScript/ci/mock-gh-device-code.ts`. The first-session executor
comments the hook point where QEMU auth coverage must connect or explicitly
skip.

## Rejected Options

### Approach B — Test-only ephemeral GitHub App

Rejected for this decision because it still depends on real GitHub
infrastructure, CI identity plumbing, and per-run token minting. It remains a
possible later realism layer, but it is not the security floor for public ISO
testing.

### Approach C — Layered tests with auth skipped

Rejected as the primary resolution because it leaves the exact UX under debate
untested. It is allowed only as the explicit-marker fallback for QEMU slices
that are not claiming auth coverage.

### Approach D — Manual auth-only physical test

Rejected as the routine gate because it preserves the operator bottleneck the
CI cascade is trying to remove. Physical testing remains valuable for residual
hardware and browser quirks, not for every PR's auth regression coverage.

### Approach E — AI drives real GitHub OAuth

Rejected for this decision even though it has high fidelity. Dedicated AI
accounts, TOTP handling, account hygiene, and Playwright browser automation are
too much operational substrate for the first secure answer to this tension.

## Consequences

Positive:

- No real credential ships on the production ISO.
- No long-lived CI secret is needed to test the device-code UX.
- The QEMU path can become deterministic: fixed `user_code`, fixed
  verification URI, fixed stub token.
- Future integration work has a named fork and a testable module boundary.

Costs:

- The stub does not prove GitHub's live OAuth service is healthy.
- The current PR only scaffolds the mock and ADR; wiring QEMU to drive the
  installer through the mock remains backlog work.
- Future editors must preserve the distinction between "auth skipped with
  marker" and "auth tested against the mock."
- `gh` is a **temporary** cluster foothold. Successor stack: Zeta distributed
  identity provider (ADR 2026-07-08-distributed-identity-provider) for auth,
  and ZetaDB / DagFs as the eventual git backend **and** client replacement.
  Keep CI behind `identity-auth-provider.ts` so mock coverage does not harden
  GitHub CLI as forever.

## Revisit Trigger

Revisit this ADR if GitHub CLI exposes a supported first-class test endpoint
override, if QEMU auth coverage cannot be wired without patching `gh`, or if
the project chooses to add a real-GitHub ephemeral-app realism layer on top of
the mock floor.

## Composes With

- `src/Core.TypeScript/ci/mock-gh-device-code.ts`
- `src/Core.TypeScript/ci/identity-auth-provider.ts`
- `src/Core.TypeScript/observe/first-session-executor.ts`
- `full-ai-cluster/nixos/modules/zeta-first-session.nix` (`ZETA_IDENTITY_AUTH_MODE=mock`)
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh`
- `docs/DECISIONS/2026-07-08-distributed-identity-provider.md` (successor IdP)
- `docs/backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-r.md`
- `docs/backlog/P1/081KSGS9H0008QG0R003JNSVR5-installer-interactive-login-vs-baked-in-keys-ci-test-tension.md`
