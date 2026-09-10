---
id: 081M24E7814087G0R003JY87M3
type: bug
state: backlog
priority: P2
slug: two-swarm-workflows-still-curl-pipe-sh-the-ollama-installer
title: "two swarm workflows still curl-pipe-sh the Ollama installer while the pinned installer is already shipped and adopted elsewhere"
created: 2026-09-10T01:16:54.180Z
depends_on: []
composes_with: []
---

# two swarm workflows still curl-pipe-sh the Ollama installer while the pinned installer is already shipped and adopted elsewhere

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24E7814087G0R003JY87M3-*.md` glob. -->

## What was open

Scorecard `PinnedDependenciesID` alerts 690 (`mux-swarm-tick.yml:49`) and 714
(`arc-swarm-fanout.yml:78`): both ran

```
curl -fsSL https://ollama.com/install.sh | sh
```

mux-swarm-tick is on an hourly cron and has 655 runs. Every one of them fetched
a remote script and handed it to a shell as root.

## What the alert text did not name

THE FIX WAS ALREADY BUILT AND THESE TWO LANES NEVER ADOPTED IT.
`agent-heartbeat.yml` stopped piping that installer on 2026-08-16 and switched
to `.github/ollama-pin.json` plus `install-pinned-artifact.ts` -- version-
addressed URL, SHA-256 cross-checked against two independent sources, refusal
unit-tested in `pinned-artifact.test.ts`, and proved on a real runner by
`verify-ollama-pin.yml` on any PR that touches the pin. The mechanism, the
refresher, the verifier and the doc all shipped. These two workflows kept the
old line.

So this is not new engineering; it is adoption. Inventing a second install path
here would have been the duplication that registry exists to prevent.

## A step that errored on every run and reported success

Measured in run 34420600400 (2026-09-10T00:17Z), the hourly job that reports
`success`:

```
00:18:02.34  >>> Creating ollama systemd service...
00:18:05.06  >>> The Ollama API is now available at 127.0.0.1:11434.
00:18:05.10  Error: listen tcp 127.0.0.1:11434: bind: address already in use
```

`install.sh` registers and starts a systemd unit, so the step own `ollama serve &`
could never bind. It is backgrounded, so `set -e` never saw it, and the step
concluded `success`. Removing the installer removes the systemd unit, which makes
the serve line load-bearing again rather than dead -- so this is fixed as a
consequence of the pinning, not as a separate patch.

## An open question this change does NOT answer, stated so it is not lost

In the same run the payload step -- four hats, each meant to take a completion
from the model that was just installed and pulled -- ran in **9.7 ms**:

```
00:18:16.1739702  --- SWARM TICK ---
00:18:16.1836430  Swarm test tick complete.
```

Four CPU completions against a freshly loaded qwen2.5:0.5b cannot take 9.7 ms.
That is consistent with `observeWithLlm` taking its silent fallback
(`if (result.fallback) return observe(world)` in `observe/observe.ts`), which
returns the deterministic oracle and prints nothing -- so a tick with no
inference is indistinguishable in the log from a tick with inference.

CONSISTENT WITH IS NOT MEASURED. Nothing here proves the model went unqueried;
what IS proved is that the workflow cannot tell you either way. The missing
signal is the defect worth naming, and it is a swarm-lane change rather than a
security one, so it is recorded here and not fixed in this PR.

## Also changed, and also not new engineering

`arc-swarm-fanout.yml` had no `persist-credentials: false` on the checkout that
preceded the runtime-fetched installer. Its sibling set exactly that, with a
comment naming the installer as the reason. One of two identical lanes got the
mitigation. It now has it too.

## Verification, and its honest limit

- `actionlint` rc=0 on both files.
- The install path is the one `agent-heartbeat.yml` has run since 2026-08-16 and
  that `verify-ollama-pin.yml` proves on a real runner.
- LIMIT: both swarm lanes are `ubuntu-22.04`; verify-ollama-pin runs on
  `ubuntu-24.04`. The tarball is laid into /usr/local and starts nothing, so the
  runner image should not matter -- but "should not" is not a measurement. The
  hourly schedule exercises it within the hour of merge, and the step is
  `continue-on-error` so a failure degrades the tick loudly rather than
  stopping it.
- `.github/ollama-pin.json` is at v0.32.13 (2026-08-14) while upstream latest is
  v0.33.3 (2026-09-02). NOT bumped here: a pin bump has its own proof workflow
  and belongs in its own PR.
