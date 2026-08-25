---
id: 081M0X0R2T5087G0R0008J5PSH
type: task
state: in-progress
priority: P1
slug: launchd-control-behind-a-port-no-path-resolved-launchctl
title: "launchd control behind a port — no PATH-resolved launchctl"
created: 2026-08-25T00:00:00.000Z
depends_on: []
composes_with: []
---

# launchd control behind a port — no PATH-resolved launchctl

## This ID was assigned to the work but never filed

The id was allocated when the work was handed off and used in the `Task:` trailer of
PR #15411, but **no work-item file was ever committed** — so `audit-task-zetaid-resolves`
(AH006) failed the `cross-verify` gate with `no-such-workitem`. Filing it under the cited
ID rather than minting a new one, exactly as `081KSNY2Z0008QG0R002JKH50A` did for the same
class of gap, so the trailer resolves to its real referent.

That the gate caught this is the gate working: a well-formed ZetaId that identifies nothing
is *harder* to spot by eye than a placeholder, which is why AH006 exists.

## The problem

`launchctl` was spawned by NAME from ambient `PATH` at 10 live sites. It installs
LaunchAgents — code that runs at every login — so a forged `launchctl` earlier on `PATH`
needs no root to matter: exit 0 on `bootstrap` and a service reports installed and never
runs; exit 0 on `bootout` and an uninstall silently leaves the agent live. Neither leaves a
git diff, so code review, AgencySignature and byte-lock cannot see it.

This is the same class as the `sudo` P1 of 2026-08-24 (`docs/BUGS.md`, found by Mateo),
which `src/Core.TypeScript/privilege/elevator.ts` already closed. That work is DONE: there
are zero live PATH-resolved elevator spawns. `launchctl` was the remaining privileged
PATH surface.

## What shipped (PR #15411)

- `src/Core.TypeScript/privilege/system-tool.ts` — allowlisted-absolute-path admission for
  **non-setuid** system binaries. Generalises `elevator.ts`, whose setuid predicate would
  reject the real `/bin/launchctl` (0755 root:wheel); the predicate is a parameter so the
  `sudo` gate is not weakened.
- `src/Core.TypeScript/service/service-control-port.ts` — `ServiceControlPort` (capability
  in our terms + version guarantee), the launchctl adapter, and `inMemoryServiceControl`,
  a second adapter with no subprocess that is the evidence the interface is a port rather
  than a way of invoking a binary.
- 10 call sites converted across `service/adapters/launchd.ts`, `service/loop-liveness.ts`,
  `observe/world-infra.ts`, `ops/setup-dual-background-agents.ts`,
  `shadow/launchd/install-launchagent.ts`.
- `src/Core.TypeScript/privilege` added to the `lint:eslint` allowlist — the rule this work
  is about was not running on the code that fixes it.

## Honest limits (recorded so they are not mistaken for guarantees)

- The recorded identity detects substitution **only against a pin**, and no call site wires
  one yet — today it is an observation, not a check.
- It is not an authenticity check: no signature verification, no trust root.
- SIP `SF_RESTRICTED` is what makes the absolute path meaningful, and Bun's `statSync`
  exposes no `st_flags`, so it is **asserted from measurement, never verified at run time**.
- The version string is a compatibility check; a substituted binary can print anything.

## Follow-ups

- Wire a pinned identity baseline and decide who authorises the first record.
- `observe/world-infra.ts` collapses indeterminate into "nothing running" (pre-existing).
- `git` / `bun` / `gh` / `bash` PATH sites remain — a separate, larger migration. Content
  hashing is measured too slow for a 63 MB runtime per invocation (31.75 ms vs 0.36 ms for
  launchctl), so that migration needs a different identity strategy.
