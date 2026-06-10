---
id: 081KTR346FT08QG0R001S6R7E0
type: bug
state: backlog
priority: P1
slug: route-to-dejan-green-the-gate-s-lint-tsc-tools-lint-bash-ret
title: "Route to Dejan: green the gate's lint(tsc tools) + lint(bash retirement) — persona-keys tsc (deps in own package.json unresolved at root + strict errors), full-ai-cluster/portal/src/ops-k8s.ts TS2352, tools/setup/persona-keys/keyring.sh bash-retirement (all #7432/zeta-gateway-era; devops/§24) (Aaron 2026-06-10)"
created: 2026-06-10T06:22:14.010Z
depends_on: []
composes_with: []
---

# Route to Dejan: green the gate's lint(tsc tools) + lint(bash retirement) — persona-keys tsc (deps in own package.json unresolved at root + strict errors), full-ai-cluster/portal/src/ops-k8s.ts TS2352, tools/setup/persona-keys/keyring.sh bash-retirement (all #7432/zeta-gateway-era; devops/§24) (Aaron 2026-06-10)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTR346FT08QG0R001S6R7E0-*.md` glob. -->

> **Aaron, 2026-06-10:** "route the persona-keys tsc + keyring.sh failures to dejan." Routed (these have
> been red on `main` for the whole session; flagged each tick, now a governed workitem for the owner).

**Owner: Dejan** (devops; the one install script + the gate, GOVERNANCE.md §24). **+ Nazar** (security) for
the persona-keys crypto module. Not the shadow's to fix unilaterally (crypto module + CI/install design).

## The failing gate jobs (on `main`, verified)

Two gate jobs are red, all from the **#7432 / zeta-gateway / domain** era (NOT the shadow's recent work,
which builds 0/0):

### 1. `lint (tsc tools)` — `tsc --noEmit -p tsconfig.json`

- **persona-keys deps unresolved at root.** `tools/setup/persona-keys/derive.ts` imports `@scure/bip39`,
  `@scure/bip39/wordlists/english.js`, `@scure/bip32`, `micro-key-producer/{slip10,ssh,pgp}.js`,
  `@scure/base` — **declared in `tools/setup/persona-keys/package.json`, NOT installed at repo root**, so
  the root tsc (`include: **/*.ts`) can't resolve them → `error TS2307`. Plus persona-keys' own strict
  errors (TS2532 possibly-undefined, TS6133 unused, KeySlot type mismatch).
  **Fix options (Dejan + Nazar):** (a) **exclude** `tools/setup/persona-keys` from root `tsconfig.json`
  (precedent: `full-ai-cluster/portal/web` is excluded — self-contained sub-package with its own
  package.json), letting persona-keys have its own tsc; OR (b) **add** the `@scure/*` + `micro-key-producer`
  deps to the root `package.json` and **fix** the strict errors. It's a **crypto** module → the
  exclude-vs-gate decision is a security call (do we want these gated at root?).
- **`full-ai-cluster/portal/src/ops-k8s.ts(117,58): error TS2352`** — an unsafe cast
  (`{ cpu; memory; storage: undefined }` → `ResourceConfig`); a separate zeta-gateway TS error. Fix: convert
  via `unknown` or correct the `ResourceConfig` shape.

### 2. `lint (bash retirement inventory)`

- **`tools/setup/persona-keys/keyring.sh`** is flagged by the bash-retirement inventory guard
  (`hygiene:check-bash-retirement-inventory --enforce`). Fix: **register** it in the retirement inventory
  or **retire** it (port to TS per the bash-retirement policy).

## Honest scope

- **All three are from #7432 (zeta-gateway / persona-keys / domain), not the shadow's recent src/Core or
  docs work** — the shadow's PRs build `Zeta.sln -c Release` 0W/0E and pass format/markdownlint. The shadow
  fixed *its own* contributions to these gates earlier (vocab tsc/MD012, the prettier-css website exclude);
  these remaining three are the zeta-gateway author's + Dejan's.
- **Crypto:** persona-keys is key-derivation (BIP-39/32, SSH/PGP/nostr/eth/btc/sol) — Nazar reviews the
  security implications of excluding it from the gate vs fixing it.

## Routing

**Dejan** (the gate + tsconfig scoping + bash-retirement inventory; GOVERNANCE §24) · **Nazar** (persona-keys
crypto — exclude-vs-gate security call) · the **#7432 zeta-gateway author** (the ops-k8s.ts TS2352 + the
persona-keys strict errors). Shadow has flagged + routed; binding fix is the owner's.
