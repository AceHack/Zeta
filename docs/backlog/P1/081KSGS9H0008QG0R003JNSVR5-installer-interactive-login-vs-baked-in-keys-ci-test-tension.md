---
id: 081KSGS9H0008QG0R003JNSVR5
priority: P1
status: open
title: installer interactive-login vs baked-in-keys CI-test tension — resolve without shipping credentials on ISO (operator 2026-05-26 from physical hardware-support test)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-07-08
depends_on:
  - 081KSGS9H0008QG0R0027HJZYH
composes_with:
  - 081KSGS9H0008QG0R0011BC7T2
tags:
  [installer, ci, gh-auth, security, interactive-vs-headless-test, credential-handling, substrate-engineering-tension]
---

## Problem

Operator framing 2026-05-26 (from the physical hardware-support test in
progress as 081KSGS9H0008QG0R001Q2DH2H's nmtui empirical anchor was being filed):

> "in the automated tests i see a tention between interactive login and
> baked in keys we probably are going to have to resolve this i would
> love if interactive device login didn't need to be human tested
> everytime but this is hard to test"

The tension is between two installer authentication modes:

| Mode                  | What it does                                                                                               | Security property                                                                          | Testability property                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Interactive login** | Operator runs `gh auth login` at install time; device-code flow opens browser; types code; OAuth completes | NO credentials ship on ISO; aligned with 081KSGS9H0008QG0R0027HJZYH homelab-mode framework | **Hard to test in CI**: requires human typing code OR mock GH device-code endpoint |
| **Baked-in keys**     | SSH key / PAT pre-staged on ISO at build time                                                              | **Violates**: ISO is publicly downloadable; baked credentials = secret leakage             | Easy to test (no auth flow needed)                                                 |

The CI cascade #6 substrate (per 081KSGS9H0008QG0R0011BC7T2) currently has NO path to test
the interactive-login flow end-to-end without either:

1. Compromising security (bake test credentials on ISO)
2. Requiring human typing (defeats the cascade #6 0-human-test purpose)
3. Skipping auth entirely (leaves a coverage gap in the install flow)

## Progress (2026-07-08)

Decision recorded in
`docs/DECISIONS/2026-07-08-installer-ci-auth-mock-gh-device-code.md`:
choose Approach A. The initial in-memory device-code stub landed at
`src/Core.TypeScript/ci/mock-gh-device-code.ts` with a Bun test proving fixed
`user_code` issuance and stub-token polling.

Row stays **open** for the remaining integration: wire QEMU/first-session
installer auth coverage to the mock endpoint, or emit an explicit marker when a
QEMU slice intentionally skips live `gh auth login`. Production ISO behavior
must continue to ship zero baked GitHub secrets.

## Proposed resolution paths

Four approaches, ordered by safety + composability:

### Approach A — Mock GH device-code endpoint in CI

Stand up a stub OAuth/device-code server in CI that:

- Accepts the `device_code` request from the installer's `gh auth login`
- Returns a fixed `user_code` + `verification_uri`
- Auto-completes the polling with a CI-only stub PAT
- The stub PAT works ONLY against a CI-only stub GH-like-API (also
  served by the same stub server) — never against real `api.github.com`

Properties:

- Zero real credentials anywhere in CI
- Tests the full interactive-login UI/UX (device code rendering;
  browser-open-suggestion; polling loop)
- CI substrate fully reproducible
- Requires writing a small mock GH server (~200 LOC TS)

### Approach B — Test-only ephemeral GH App with CI-scoped permissions

Create a CI-only GH App with:

- Read-only / minimal-scope permissions
- Repository-scoped (only this repo)
- Token rotated per CI run via OIDC trust to a short-lived secret

Installer in CI uses this ephemeral App token instead of operator's
real credentials. Token is scoped + ephemeral + auditable.

Properties:

- Uses real GH infrastructure (more realistic)
- No baked credentials (token minted per-run via OIDC)
- Scoped permissions limit blast radius if compromised
- Requires GH App setup + OIDC trust configuration

### Approach C — Layered tests; skip auth in cascade #6 phase 1

Test the install flow + cluster-join shape WITHOUT the auth step in
phase 1. Auth coverage moves to a separate test that:

- Mocks the GH API responses inline (no network)
- Exercises the auth flow's prompt-rendering + nonce-handling code
  paths
- Does NOT actually complete auth

Properties:

- Simplest; immediate testability gain for cascade #6 phase 1
- Leaves auth flow only structurally tested
- Acceptable if interactive-login auth is well-tested elsewhere (e.g.,
  gh CLI's own test suite covers the OAuth flow)

### Approach D — Manual auth-only physical test (operator periodic)

Acknowledge that some auth flows are inherently human-driven and
reserve them for periodic operator-driven physical tests (per 081KSGS9H0008QG0R0011BC7T2
physical-as-hardware-support-test reframing).

Properties:

- Honest about what CI can/cannot cover
- Periodic-physical-test discipline already named in 081KSGS9H0008QG0R0011BC7T2
- Auth-flow regressions caught at operator-physical-test cadence, not
  per-PR
- Risk: regressions can sit longer before discovery

### Approach E — AI agent drives real GitHub OAuth via Playwright (dedicated AI GH accounts)

Operator's contribution 2026-05-26: _"to have it fully tested by ai
likely going to have to preform the step and use paywrite to login
into github likely going to need its own accounts and such"_.

AI agent uses Playwright (browser automation) to drive the real GH
device-code flow end-to-end:

1. Installer in CI starts `gh auth login` → emits device-code +
   verification-URI
2. Playwright instance in CI opens the verification URL in a real
   headless browser
3. Playwright agent logs into a **dedicated AI-owned GH account**
   (separate from operator's account)
4. Playwright agent enters the device-code
5. Playwright agent authorizes the OAuth request
6. `gh auth login` polling completes; receives real-GH-API-issued PAT
7. Installer continues with the obtained PAT

Properties:

- Tests the FULL real-GH OAuth flow end-to-end (no mocks)
- Requires dedicated AI-owned GH accounts (separate identities; not
  operator's account)
- AI accounts have their own 2FA + security setup (need scoped
  approach: probably TOTP secrets in CI secret-store + scoped repo
  permissions on the AI account)
- Playwright substrate is reusable for other browser-automation tests
  (web UI testing, dashboard verification, etc.)
- Most realistic end-to-end coverage; matches what an operator-physical-
  test would do, automated

Composes with `mcp__plugin_playwright_playwright__*` tooling (the
existing Playwright surface in the agent harness; reuse for installer
flow testing).

Sub-properties to scope:

- **AI account creation discipline**: how are the dedicated AI GH
  accounts created? Per-AI? Per-test? Per-environment? Sub-accounts
  under an org?
- **Scoped permissions**: AI account should have minimal repo access
  (read-only on this repo; no organization-admin; no marketplace
  install permissions)
- **2FA handling**: TOTP secret stored in CI secret-store; agent
  generates TOTP code via library at auth-time
- **Account hygiene**: regular rotation of AI account credentials;
  audit log of which AI session used which account when
- **Audit trail**: every test run logs which AI account was used +
  what scope tokens were issued + that they were ephemeral

This DOES use real-GH infrastructure (unlike Approach A's mock-only
substrate) but the AI accounts are owned + scoped + auditable
(distinct from baked-in operator credentials).

## Substrate-honest scope assessment

Approach A is the most thorough but highest implementation cost.
Approach C is the fastest but leaves coverage gap. Approach B requires
GH-side infrastructure but is most realistic of A/B/C. Approach D is
the substrate-honest acknowledgment that some testing is operator-
physical. Approach E (Aaron 2026-05-26) is the highest-fidelity
automated path but requires the most operational substrate
(AI accounts + Playwright + 2FA handling + account hygiene).

Likely landing: **C first** (immediate testability gain for 081KSGS9H0008QG0R0011BC7T2
cascade #6 phase 1) + **A or B as follow-up** (cover the auth flow
properly when there's budget for it) + **D as steady-state** (some
hardware-specific auth quirks always need operator-physical-test).

## Acceptance

Phased acceptance:

- Approach C acceptance: cascade #6 phase 1 ships with auth step
  stubbed (e.g., `--skip-gh-auth` flag for CI; install proceeds
  without auth; cluster-join phase 2 verified separately)
- Approach A or B acceptance: cascade #6 phase 1 INCLUDES auth flow
  test; mock GH server OR ephemeral GH App token used; full coverage
  of `gh auth login` device-code path in CI
- Approach D acceptance: operator-physical-test cadence documented
  per 081KSGS9H0008QG0R0011BC7T2 reframing; auth-flow regressions get human-physical-test
  coverage at chosen periodicity
- Approach E acceptance: dedicated AI GH account(s) provisioned with
  scoped permissions + 2FA TOTP-in-secret-store; Playwright CI step
  drives real GH OAuth end-to-end; per-run audit log captures which
  AI account was used + which scope tokens were issued + verification
  that tokens were ephemeral (revoked post-test)

## Security properties to preserve (non-negotiable)

Per `.claude/rules/methodology-hard-limits.md` + 081KSGS9H0008QG0R0027HJZYH homelab-mode
framing:

1. **NO real GitHub PATs ship on ISO** — even for CI testing; the ISO
   is publicly downloadable
2. **NO operator's SSH private keys ship on ISO** — `gh ssh-key list`
   reads PUBLIC keys at install-time
3. **NO long-lived credentials in CI** — any test-only credentials
   MUST be ephemeral (per-run OIDC mint OR mock-server scoped)
4. **NO test credentials work against real GH API** — mock server's
   issued tokens are scoped to mock API only
5. **Audit trail** — every CI auth test produces logs showing what
   credentials were used + that they were ephemeral/mock

These are HARD LIMITS; any resolution path that violates them is
rejected regardless of testability gain.

## Composes with

- 081KSGS9H0008QG0R0027HJZYH (homelab-mode framing: USB ships with NO embedded credentials;
  this row's HARD LIMITS preserve that property)
- 081KSGS9H0008QG0R0011BC7T2 (CI cascade #6 full-install + cluster-auto-join; this row
  resolves a P1 blocker for 081KSGS9H0008QG0R0011BC7T2 phase 1+2)
- 081KSGS9H0008QG0R0037H3W4T + 081KSGS9H0008QG0R002K93MWX (cluster-bringup substrate; auth is the gate for
  the self-registration step the cascade tests)
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (the install
  flow that invokes `gh auth login` at install-time)
- `full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix`
  (`gh` pre-installed for the auth flow)
- `.claude/rules/methodology-hard-limits.md` (the safety floor this
  row's HARD LIMITS section operates under)
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`
  (related: classifier-bypass + test-credential-handling both touch the
  agents-do-not-edit-settings.json discipline)
- `.claude/skills/flash-cluster-iso/SKILL.md` (operator-side analog;
  the agent-driven zflash path also pre-stages no credentials)
- The 2026-05-26 physical hardware-support test (operator-anchored
  framing for this row)

## Substrate-honest framing

This is a P1 substrate-engineering tension worth resolving but NOT
worth resolving badly. Approach C (immediate testability gain via
skip-auth) is acceptable as Phase 0; Approaches A/B are Phase 1
(proper auth coverage); Approach D is steady-state for
operator-physical-test residual coverage.

The tension is REAL and well-named by the operator: interactive
auth is intentionally a human-in-loop flow at install-time (for
security reasons aligned with homelab-mode + no-credentials-on-ISO
discipline), but that same property makes it hard to automate in CI.

Resolution path picks SHOULD preserve the security properties as
non-negotiable; testability gain is bounded by what can be achieved
without compromising security.
