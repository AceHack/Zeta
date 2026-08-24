---
id: 081M0T8R07H087G0R0032KNMW6
type: bug
state: backlog
priority: P2
slug: loop-liveness-gather-reports-not-installed-on-windows-when-t
title: "loop-liveness gather() reports not-installed on Windows when the check never ran"
created: 2026-08-24T16:13:05.649Z
depends_on: []
composes_with: []
---

# loop-liveness gather() reports not-installed on Windows when the check never ran

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0T8R07H087G0R0032KNMW6-*.md` glob. -->

## The defect

`src/Core.TypeScript/service/loop-liveness.ts:358` —
`gather()` dispatches `platform === "darwin" ? gatherLaunchd : gatherSystemd`,
so **every non-darwin platform gets `systemctl`**, Windows included.

On Windows `systemctl` does not exist. `spawnSync` fails, `unitFound` is `false`,
and line 149 turns that into:

```
verdict: "not-installed", reason: `no ${facts.supervisor} unit for this label`
```

**A check that could not run is reported as a check that found nothing installed.**
That is the vacuity class in the one place it hurts most — the liveness monitor,
whose entire job is to notice when something is not running.

## Why the type permits it

`type Supervisor = "launchd" | "systemd"` (line 98) has **no arm for "no adapter
on this host"**. The docstring says the classification "stays one total function
over both" — and it is: total over the union it *declares*, not over the
platforms it *runs on*. The union is the bug, not the dispatch.

Compare `.claude/rules/toy-is-free-metered-must-be-earned.md`'s three-state
vocabulary and the repo's own precedent, already shipped elsewhere:
`secp256k1: present, absent, and THE CHECK DID NOT RUN are three answers`.
The same third answer is missing here.

## Fix direction (not prescriptive)

`Supervisor` gains an arm for "unsupervised / no adapter", and `Verdict` gains
one distinguishing **"not installed"** from **"could not determine"**. The
`disposition.ts` / `host-os.ts` port landed in #14820 is the natural home for
that decision, and `081M0T694EG087G0R002SJST5K` is its work-item.

## Falsifier

A test that runs `gather()` with the platform forced to `win32` and asserts the
verdict is **not** `"not-installed"`. It must fail against today's code — if it
passes, the fix has not been made.

## Provenance

Found by the architect persona while measuring platform-branch sprawl for the
hexagonal OS port (#14820, merged). Verified independently before filing:
`Supervisor` union at line 98 has two arms; line 149 maps `!unitFound` to
`"not-installed"`.

