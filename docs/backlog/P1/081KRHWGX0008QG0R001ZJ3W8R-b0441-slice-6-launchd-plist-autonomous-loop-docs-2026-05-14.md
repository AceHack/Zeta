---
id: 081KRHWGX0008QG0R001ZJ3W8R
priority: P1
status: shipped
title: "081KRFA460008QG0R00229616S slice 6 — launchd plist for backlog-ready-notifier + AUTONOMOUS-LOOP.md update"
tier: factory-infrastructure
effort: XS
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R00229616S
depends_on: []
composes_with: [081KRFA460008QG0R00229616S, 081KRHWGX0008QG0R003NT6DY9, 081KRHWGX0008QG0R0025PX5SZ, 081KRHWGX0008QG0R0000P5YP2]
tags: [background-service, launchd, mechanization, anti-idle]
type: chore
---

# 081KRFA460008QG0R00229616S slice 6 — launchd plist + documentation wiring

## Origin

081KRFA460008QG0R00229616S acceptance criterion:
> "Runs under existing launchd / cron infrastructure"
> "Documented in `docs/AUTONOMOUS-LOOP.md`"

`docs/AUTONOMOUS-LOOP.md` §"Related artifacts" already states:

> only `missed-substrate-detector.ts` is launchd-registered
> (`.gemini/launchd/com.zeta.missed-substrate-detector.plist`). The other three
> (`backlog-ready-notifier.ts`, `standing-by-detector.ts`, `audit-duplicate-row-ids.ts`)
> are invokable on demand via `bun tools/bg/<name>.ts --once` but not yet wired to launchd
> (081KRFA460008QG0R00229616S slice 6, 081KRHWGX0008QG0R003NT6DY9 for standing-by-detector).

This row closes the gap for `backlog-ready-notifier.ts` specifically. Sibling row 081KRHWGX0008QG0R003NT6DY9
covers the same gap for `standing-by-detector.ts`.

## Acceptance criteria

- [x] `.gemini/launchd/com.zeta.backlog-ready-notifier.plist` created; follows the
      established pattern from `.gemini/launchd/com.zeta.missed-substrate-detector.plist`:
  - `Label`: `com.zeta.backlog-ready-notifier`
  - `ProgramArguments`:
    `[bun-path, <repo>/tools/bg/backlog-ready-notifier.ts, --once]`
  - `StartInterval`: `600` (10 minutes — matches `DEFAULT_CONFIG.pollIntervalMin`)
  - `RunAtLoad`: `true`
  - `StandardOutPath`:
    `$HOME/Library/Logs/zeta-backlog-ready-notifier/stdout.log`
  - `StandardErrorPath`:
    `$HOME/Library/Logs/zeta-backlog-ready-notifier/stderr.log`
  - `EnvironmentVariables`: `HOME` + `PATH` (same values as sibling plists)
  - `WorkingDirectory`: repo root (`/Users/acehack/Documents/src/repos/Zeta`)
  - Maintainer-note comment: paths are machine-specific (`/Users/acehack`,
    `/opt/homebrew`); update before `launchctl load`
- [x] `docs/AUTONOMOUS-LOOP.md` §"Related artifacts" updated:
  - `backlog-ready-notifier.ts` listed as launchd-registered alongside
    `missed-substrate-detector.ts` (remove from "not yet wired to launchd" list)
  - Add note: "produces `work-assignment` bus envelopes; see 081KRHWGX0008QG0R001E9KEJ1 for the
    subscriber handler that consumes them"
- [x] 081KRFA460008QG0R00229616S acceptance criterion #2 ("Runs under existing launchd / cron
      infrastructure") ticked on the parent row
- [x] `tools/bg/README.md` §"Current services" table updated: slice status for
      `backlog-ready-notifier.ts` changed from `1+2+4 live` to `1+2+3+4+6 live`
      (after 081KRHWGX0008QG0R0025PX5SZ lands; if 081KRHWGX0008QG0R0025PX5SZ is not yet merged, note it separately)

## Reference pattern

```xml
<!-- .gemini/launchd/com.zeta.backlog-ready-notifier.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.zeta.backlog-ready-notifier</string>
    <!-- Maintainer-only artifact: paths are machine-specific (/Users/acehack, /opt/homebrew).
         Update these paths manually for your local machine before running `launchctl load`. -->
    <key>ProgramArguments</key><array>
        <string>/opt/homebrew/bin/bun</string>
        <string>/Users/acehack/Documents/src/repos/Zeta/tools/bg/backlog-ready-notifier.ts</string>
        <string>--once</string>
    </array>
    <key>StartInterval</key><integer>600</integer>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key>
        <string>/Users/acehack/Library/Logs/zeta-backlog-ready-notifier/stdout.log</string>
    <key>StandardErrorPath</key>
        <string>/Users/acehack/Library/Logs/zeta-backlog-ready-notifier/stderr.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>/Users/acehack</string>
        <key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>WorkingDirectory</key>
        <string>/Users/acehack/Documents/src/repos/Zeta</string>
</dict>
</plist>
```

## StartInterval rationale

`missed-substrate-detector.plist` uses `StartInterval: 300` (5 minutes).
`backlog-ready-notifier.ts` uses `pollIntervalMin: 10` as its default — matching the
launchd interval to the notifier's own default avoids the service being invoked at a rate
it wasn't designed for. `10 × 60 = 600` seconds.

## Why XS effort

Copy-adapt of `.gemini/launchd/com.zeta.missed-substrate-detector.plist` with:

- Label + log paths updated
- ProgramArguments[1] updated to `backlog-ready-notifier.ts`
- `StartInterval` adjusted to 600

Plus a two-line update each in `docs/AUTONOMOUS-LOOP.md` and `tools/bg/README.md`.

## Does NOT depend on 081KRHWGX0008QG0R0025PX5SZ or 081KRHWGX0008QG0R0000P5YP2

The launchd registration works for the current service state (slices 1+2+4 live).
It can land before 081KRHWGX0008QG0R0025PX5SZ (queue-state guard) or 081KRHWGX0008QG0R0000P5YP2 (assignment history) merge.
Update the README table's "slice status" column accordingly at merge time.

## Dependency chain

```
081KRFA460008QG0R00229616S (slices 1+2+4 shipped — backlog-ready-notifier.ts functional)
  └─ 081KRHWGX0008QG0R001ZJ3W8R (THIS ROW — launchd registration; closes slice 6 AC)
```

Sibling: 081KRHWGX0008QG0R003NT6DY9 (same pattern for standing-by-detector — can merge in any order).

## Pre-start checklist (per backlog-item-start-gate)

- [ ] Verify `.gemini/launchd/com.zeta.backlog-ready-notifier.plist` does not already exist
- [ ] Verify `bun tools/bg/backlog-ready-notifier.ts --once --no-publish` exits 0
- [ ] Read `.gemini/launchd/com.zeta.missed-substrate-detector.plist` for exact reference
      values (HOME, PATH, WorkingDirectory)
- [ ] Read `docs/AUTONOMOUS-LOOP.md` §"Related artifacts" for exact text to update
