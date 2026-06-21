---
id: 081KRHWGX0008QG0R003NT6DY9
priority: P1
status: open
title: "081KRFA460008QG0R001KC0VBH slice 6 — standing-by-detector launchd plist + AUTONOMOUS-LOOP.md wiring update"
tier: factory-infrastructure
effort: XS
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R001KC0VBH
depends_on: []
composes_with: [081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW]
tags: [background-service, launchd, mechanization, anti-idle]
type: chore
---

# 081KRFA460008QG0R001KC0VBH slice 6 — launchd plist for standing-by-detector

## Origin

081KRFA460008QG0R001KC0VBH acceptance criterion:
> Service runs under existing launchd / cron infrastructure

`tools/bg/standing-by-detector.ts` is fully functional (slices 1–4 shipped; commit-history + PR-activity
poll + bus publish all live). However it is NOT yet registered as a launchd service.

`docs/AUTONOMOUS-LOOP.md` §"Related artifacts" states explicitly:

> only `missed-substrate-detector.ts` is launchd-registered
> (`.gemini/launchd/com.zeta.missed-substrate-detector.plist`). The other three
> (`backlog-ready-notifier.ts`, `standing-by-detector.ts`, `audit-duplicate-row-ids.ts`)
> are invokable on demand via `bun tools/bg/<name>.ts --once` but not yet wired to launchd

This slice closes that gap for the standing-by-detector specifically.

## Acceptance criteria

- [ ] `.gemini/launchd/com.zeta.standing-by-detector.plist` created; follows the established
      pattern from `.gemini/launchd/com.zeta.missed-substrate-detector.plist`:
  - `Label`: `com.zeta.standing-by-detector`
  - `ProgramArguments`: `[bun-path, <repo>/tools/bg/standing-by-detector.ts, --once]`
  - `StartInterval`: `300` (5 minutes, same as missed-substrate-detector)
  - `RunAtLoad`: `true`
  - `StandardOutPath`: `$HOME/Library/Logs/zeta-standing-by-detector/stdout.log`
  - `StandardErrorPath`: `$HOME/Library/Logs/zeta-standing-by-detector/stderr.log`
  - `EnvironmentVariables`: `HOME` + `PATH` (same values as sibling plist)
  - `WorkingDirectory`: repo root (`/Users/acehack/Documents/src/repos/Zeta`)
  - Maintainer note comment: paths are machine-specific (`/Users/acehack`, `/opt/homebrew`);
    update for your local machine before `launchctl load` (a future `tools/setup/install-launchd-services.sh`
    generator is planned but not yet created)
- [ ] `docs/AUTONOMOUS-LOOP.md` §"Related artifacts" updated: standing-by-detector listed as
      launchd-registered alongside missed-substrate-detector (remove from the "not yet wired" list)
- [ ] 081KRFA460008QG0R001KC0VBH acceptance criterion #2 ("Service runs under existing launchd / cron infrastructure")
      ticked on the parent row

## Reference pattern

```xml
<!-- .gemini/launchd/com.zeta.standing-by-detector.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.zeta.standing-by-detector</string>
    <!-- Maintainer-only artifact: paths are machine-specific (/Users/acehack, /opt/homebrew).
         Update these paths manually for your local machine before running `launchctl load`. -->
    <key>ProgramArguments</key><array>
        <string>/opt/homebrew/bin/bun</string>
        <string>/Users/acehack/Documents/src/repos/Zeta/tools/bg/standing-by-detector.ts</string>
        <string>--once</string>
    </array>
    <key>StartInterval</key><integer>300</integer>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key>
        <string>/Users/acehack/Library/Logs/zeta-standing-by-detector/stdout.log</string>
    <key>StandardErrorPath</key>
        <string>/Users/acehack/Library/Logs/zeta-standing-by-detector/stderr.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>/Users/acehack</string>
        <key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>WorkingDirectory</key>
        <string>/Users/acehack/Documents/src/repos/Zeta</string>
</dict>
</plist>
```

## Why XS effort

This is a one-file copy-adapt of `.gemini/launchd/com.zeta.missed-substrate-detector.plist` with:

- Label changed: `missed-substrate-detector` → `standing-by-detector`
- ProgramArguments[1] changed to `standing-by-detector.ts`
- Log paths changed to `zeta-standing-by-detector`

Plus a two-line update in `docs/AUTONOMOUS-LOOP.md`.

Does NOT depend on subscriber slices (081KRHWGX0008QG0R000TVGDGV, 081KRFA460008QG0R002DG8KPZ); can merge in any order.

## Dependency chain

```
081KRFA460008QG0R001KC0VBH (standing-by-detector slices 1–4 shipped — functional service)
  └─ 081KRHWGX0008QG0R003NT6DY9 (THIS ROW — launchd registration; closes slice 6 AC)
```

## Composes with

- 081KRFA460008QG0R00229616S (backlog-ready-notifier — sibling slice 6 row, same launchd pattern)
- 081KRFA460008QG0R00061SXRW (missed-substrate-detector — already wired; this row matches its plist)
- `.gemini/launchd/com.zeta.missed-substrate-detector.plist` (reference implementation)
- `docs/AUTONOMOUS-LOOP.md` (doc to update)

## Pre-start checklist (per backlog-item-start-gate)

- [ ] Verify `.gemini/launchd/com.zeta.standing-by-detector.plist` does not already exist
- [ ] Verify `tools/bg/standing-by-detector.ts` `--once` flag works correctly (run dry: `bun tools/bg/standing-by-detector.ts --once --no-publish`)
- [ ] Check `docs/AUTONOMOUS-LOOP.md` for the current list of launchd-registered services to know exactly what text to update
