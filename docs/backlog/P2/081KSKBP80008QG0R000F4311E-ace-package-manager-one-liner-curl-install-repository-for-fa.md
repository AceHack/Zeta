---
id: 081KSKBP80008QG0R000F4311E
priority: P2
status: open
title: Ace package manager — one-liner `curl ... | bash` install repository for fast-moving tools that update faster than Homebrew can keep up; hermes-agent as canonical example (operator 2026-05-27)
effort: M
ask: operator 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KR2E4K0008QG0R002YE3MMD
composes_with: []
tags: [ace, package-manager, one-liner-install, curl-bash, fast-moving-tools, homebrew-lag, hermes-agent, substrate-engineering-target]
---

## Operator framing (operator 2026-05-27)

In conversation thread following PR #5547 adding hermes-agent to brew
manifest:

> *"one thing i want to support with the ace package manager is one
> liner like this curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
> we can keep a reposity of them for things that change too fast for
> homebrew and such. hermes would be a candidate"*

## What this row proposes

Add to the Ace package manager substrate (per 081KR2E4K0008QG0R002YE3MMD Ace package
manager substrate; 081KSGS9H0008QG0R0031PBNGA package-manager-of-package-managers): a
repository of one-liner `curl -fsSL <url> | bash` install commands
for tools that update faster than Homebrew can keep up with.

### The substrate-engineering problem

Tools like AI agent harnesses (hermes-agent, etc.) ship multiple
releases per week. Homebrew formula updates lag the upstream release
cycle by days-to-weeks. For substrate-engineering work where
operators + AIs need the LATEST version of a fast-moving tool,
waiting for Homebrew formula update is too slow.

The existing install paths in `tools/setup/`:

| Path | Update frequency tolerance |
|---|---|
| `tools/setup/manifests/brew` | Homebrew formula lag (days to weeks) |
| `.mise.toml` (mise runtime pins) | mise plugin lag (days) |
| `tools/setup/common/<tool>.sh` (custom install) | Per-tool maintainer effort to write/update script |

None of these handle the "fast-moving tool with vendor-provided
install.sh" pattern well.

### The Ace one-liner pattern

Operator proposes Ace package manager curates a repository of upstream
one-liner install commands:

```yaml
# Hypothetical Ace one-liner registry format:
- name: hermes-agent
  curl_url: https://hermes-agent.nousresearch.com/install.sh
  vendor: NousResearch
  category: ai-agent-harness
  vendor_agnostic: true
  homebrew_alternative: hermes-agent  # (when brew formula is current; falls back to one-liner when stale)
  verify_pattern: "hermes-agent --version"
```

The pattern composes:

1. **Direct upstream install**: gets latest released version regardless of Homebrew formula state
2. **Curated repository**: operator-vetted one-liners only (not arbitrary `curl ... | bash` from random URLs)
3. **Vendor-attribution**: clear who maintains the install script + what trust assumption applies
4. **Fallback discipline**: if Homebrew formula is current, use that; if stale or unavailable, use one-liner
5. **Verification pattern**: after install, run a verify command to confirm it worked

### Hermes-agent as canonical example

Per the 2026-05-27 conversation context:

- PR #5547 adds `hermes-agent` to brew manifest as short-term install path
- Operator notes hermes-agent would be a candidate for the Ace one-liner pattern (medium-term)
- The upstream provides https://hermes-agent.nousresearch.com/install.sh (typical curl-bash install)
- AI agent harnesses ship frequently; brew formula will lag

The Ace one-liner pattern would let operator + AI instances run
`bun tools/ace/install.ts hermes-agent` (or similar) to get the
latest version directly from upstream without waiting for brew
formula update.

## Composes with substrate

- **081KR2E4K0008QG0R002YE3MMD** Ace package manager substrate — this row decomposes one substrate-engineering target within the broader Ace package manager
- **081KSGS9H0008QG0R0031PBNGA** package-manager-of-package-managers — Ace one-liner registry IS one substrate-engineering instance of the broader package-manager-of-package-managers pattern
- **081KSGS9H0008QG0R0006F4BGX** thermal-forgetting / root-axiom-update — fast-moving tools NEED the one-liner pattern because Homebrew's curation cadence is too slow for forgetting
- **081KSGS9H0008QG0R002BC2ZR7** all-deps-current-version-audit — composes at substrate-engineering scope; this row's one-liner pattern is one mechanism for keeping deps current
- **081KSKBP80008QG0R000J2YFK2** Nemerle dotnet support — composes at language-extension scope; one-liner-install pattern could mechanize Nemerle install too
- **PR #5547** hermes-agent brew addition — short-term install path; this row's one-liner pattern is medium-term substrate-engineering target
- **`tools/setup/install.sh`** — the existing install graph that this substrate-engineering target extends with one-liner pattern

## Composes with rules

- `.claude/rules/rule-0-no-sh-files.md` — Rule 0 allows `.sh` in `tools/setup/` install-graph; one-liner pattern would either (a) call out from TS to the upstream shell script via subprocess, or (b) add the one-liner-runner as an exception to Rule 0 for the specific use case
- `.claude/rules/dep-pin-search-first-authority.md` — when authoring one-liner-registry entry, verify upstream URL + verify the latest published version
- `.claude/rules/verify-existing-substrate-before-authoring.md` — search Ace substrate before authoring new entries
- `.claude/rules/non-coercion-invariant.md` HC-8 — one-liner runs upstream install.sh which can do anything; trust-assumption MUST be explicit + per-vendor + operator-vetted
- `.claude/rules/methodology-hard-limits.md` HARD LIMITS — one-liner pattern doesn't bypass operator authority + signed-binary verification + supply-chain-security discipline; vendor-attribution + URL verification + vendor-key-pinning all apply
- `.claude/rules/honor-those-that-came-before.md` — one-liner pattern honors upstream vendors' install-script tradition (typical OSS install pattern is `curl ... | bash` from vendor's site)
- `.claude/rules/wake-time-substrate.md` — Ace one-liner pattern doesn't currently exist; this row + 081KR2E4K0008QG0R002YE3MMD + future implementation rows land it

## Substrate-engineering decomposition

Possible sub-rows for future implementation:

1. **081KSKBP80008QG0R000F4311E.1** — Ace one-liner registry schema design (YAML/JSON format; vendor + URL + verify-pattern + trust-assumption)
2. **081KSKBP80008QG0R000F4311E.2** — `tools/ace/install.ts` (or similar) one-liner-runner with trust-verification + curl-fetch + bash-exec
3. **081KSKBP80008QG0R000F4311E.3** — Initial registry population: hermes-agent + 5-10 other fast-moving tools the framework substrate-engineering work uses
4. **081KSKBP80008QG0R000F4311E.4** — Brew-vs-one-liner fallback discipline: prefer brew formula if current; fall back to one-liner if Homebrew lag is detected
5. **081KSKBP80008QG0R000F4311E.5** — Vendor-key-pinning + trust-substrate: each one-liner registry entry includes vendor public key for signature verification (where vendor provides signed install scripts)
6. **081KSKBP80008QG0R000F4311E.6** — Integration with `tools/setup/install.sh`: Ace one-liner-runner becomes Step N in the install graph, called after brew + mise + custom-installs

Each becomes sub-row at `docs/backlog/P*/081KSKBP80008QG0R000F4311E.M-...md` per the subdecimal scheme.

## What this row is NOT

- NOT replacement of Homebrew (Homebrew remains primary for stable system packages)
- NOT bypass of supply-chain-security discipline (vendor-attribution + URL verification + signed-binary preference apply)
- NOT immediate implementation priority (P2 — substrate-engineering target; lands incrementally per sub-row decomposition)
- NOT a substitute for tracking actual brew formula updates (the fallback discipline still uses brew when current)

## Declarative-mapping discipline (operator 2026-05-27 refinement)

Per operator 2026-05-27 refinement:

> *"they can still be declarative mappings to the oneliners like the rest of our ace package manger backlog"*

The one-liner registry entries are NOT opaque shell-out commands. They are DECLARATIVE MAPPINGS that fit into Ace's broader declarative-mapping discipline (per 081KR2E4K0008QG0R002YE3MMD Ace package manager substrate + 081KSGS9H0008QG0R0031PBNGA package-manager-of-package-managers).

### Declarative-mapping schema (sketched)

```yaml
- name: hermes-agent
  vendor: NousResearch
  category: ai-agent-harness
  vendor_agnostic: true

  # Declarative install mapping (Ace dispatches to right install
  # method based on availability + freshness):
  install_methods:
    - method: brew
      formula: hermes-agent
      max_lag_days: 7              # if brew formula > 7 days behind upstream, fall through
    - method: one_liner
      url: https://hermes-agent.nousresearch.com/install.sh
      shell: bash
      trust_assumption: vendor_https + vendor_attribution
      verify_pattern: "hermes-agent --version"
    - method: github_release
      repo: nousresearch/hermes-agent
      asset_pattern: "hermes-agent-{version}-{os}-{arch}.tar.gz"
      verify_pattern: "hermes-agent --version"
```

Same DECLARATIVE shape as Ace's broader package manager substrate — NOT opaque shell-out; structured mapping that Ace can dispatch on, verify, version-track, fallback between, audit, etc.

### Why declarative-mapping composes load-bearing

The framework's substrate-engineering discipline is consistent across substrate scopes:

| Substrate scope | Declarative-mapping form |
|---|---|
| F# Result<T, TFeedback> | Discriminated-union TFeedback variants (declared in type signature) |
| OPLE primitives | T-and-TFeedback at primitive scope (PR #5518) |
| ConvFeedback variants | Discriminated-union conversation-substrate signals (081KSKBP80008QG0R000N9W9XH) |
| Brew manifest | Plain text (declared package names) |
| `.mise.toml` runtime pins | TOML declarative-mapping (tool + version) |
| Ace one-liner registry (THIS row) | YAML/JSON declarative-mapping (name + vendor + install_methods) |
| ArgoCD Applications | YAML declarative-mapping (chart + version + values) |
| K8s manifests | YAML declarative-mapping (kind + spec) |

The pattern: **substrate-engineering work prefers DECLARATIVE MAPPINGS over imperative shell-out wherever possible** because declarative substrate is auditable + composable + version-trackable + supports retraction-native discipline.

The Ace one-liner registry is declarative-mapping; the one-liner URL is a value within the mapping, not the entire substrate. Composes with `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` (landed PR #5516): the VENDOR (substrate-entity) defines the install script's content; the OPERATOR + Ace (recipient) declare how Ace should dispatch to it + acknowledge the trust-assumption.

## What this row IS

- Substrate-engineering target for handling fast-moving tools that update faster than Homebrew can keep up
- Composition with 081KR2E4K0008QG0R002YE3MMD Ace package manager substrate at the substrate-engineering scope
- Six-component decomposition for incremental implementation
- Canonical first instance: hermes-agent (added to brew manifest in PR #5547; will compose with one-liner pattern when Ace substrate ships)

## Substrate verification (per verify-existing-substrate-before-authoring)

Grep-substrate-inventory pass:

- `docs/agendas/`: no Ace one-liner-install agenda
- `docs/trajectories/`: no Ace one-liner trajectory
- `docs/backlog/`: 081KR2E4K0008QG0R002YE3MMD Ace package manager substrate exists; no prior one-liner-install row
- `.claude/rules/`: no rule names this pattern
- `.claude/skills/`: 0 hits
- `memory/`: 0 hits on Ace one-liner pattern
- `docs/research/`: 0 hits

Targeted searches: `rg -l "ace.*one.liner|one-liner.*install|curl.*bash.*registry" .claude/ docs/ memory/`

Conclusion: no prior row; mint-new authorized per operator
2026-05-27 directive ("we can keep a reposity of them for things
that change too fast for homebrew") + naming hermes-agent as
canonical first candidate.

## Heartbeat per CLAUDE.md discipline

Filing this row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
condition #3 (concrete-artifact substrate). Captures operator-confirmed
Ace one-liner-install substrate-engineering target so substrate exists
for future-Otto cold-boots to find via grep when Ace one-liner work
becomes implementation priority.

## Full reasoning

Operator 2026-05-27 conversation thread:

- Investigation of hermes-agent install path (PR #5547 adds to brew manifest)
- Operator: hermes-agent would be a candidate for Ace one-liner pattern
- Substrate-engineering target identification: tools that change too fast for homebrew need a different install path
- Proposed pattern: Ace one-liner registry; vendor-curated; fallback discipline; verification pattern
- Hermes-agent named as canonical first instance for the pattern

Composes with 081KR2E4K0008QG0R002YE3MMD Ace package manager + 081KSGS9H0008QG0R0031PBNGA package-manager-of-
package-managers + today's substrate-engineering arc (the day's
substrate-engineering work informs HOW Ace one-liner pattern should
compose with substrate-engineering discipline).

This row lands the substrate-engineering target; 081KSKBP80008QG0R000F4311E.M sub-rows
decompose into incremental implementation when the substrate-engineering
work earns its keep.
