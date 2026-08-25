# Second tick source — bare local service

A heartbeat tick produced by compute that is not GitHub Actions. Design rationale and the
measurements behind it: `docs/research/2026-08-25-the-second-tick-source-and-the-watchdog-that-could-not-see-one-browser-pwa-blocked-on-delivery-not-auth.md`.

## Run one tick by hand

```bash
bun src/Core.TypeScript/agent-heartbeats/local-tick.ts \
  --agent <lane> --repo-root <your-own-clone> \
  --model qwen2.5:0.5b --runtime "launchd/com.lucent.zeta.heartbeat.<lane>" --dry-run
```

Drop `--dry-run` to push. `--dry-run` still prepares the lane, runs the tick body and commits
locally; it only declines to move the remote ref.

## Install as a service

Substitute `AGENT`, `REPO_ROOT`, `MODEL`, `BUN_PATH` in the template for your platform and load it:

- macOS — `com.lucent.zeta.heartbeat.plist.template` → `~/Library/LaunchAgents/`, then
  `launchctl bootstrap gui/$(id -u) <plist>`
- Linux — `zeta-heartbeat.service.template` + `zeta-heartbeat.timer.template` →
  `~/.config/systemd/user/`, then `systemctl --user enable --now zeta-heartbeat-<agent>.timer`

## Three things that are easy to get wrong

**Use your OWN clone.** Never the shared checkout at
`/Users/acehack/Documents/src/repos/Zeta` — that is everyone's read-only view of `origin/main`
(GOVERNANCE §35). The tick does `git checkout -B` and `git push`, which is a workspace operation.

**One source per lane.** Every tick rebuilds the lane over main and pushes with
`--force-with-lease`. Two sources on one lane do not merge — they alternately refuse each other's
lease and each refusal is a lost tick. Give a new source a new `--agent`.

**No credential goes in the unit file.** The push rides the invoking user's existing git
credential; a user-scope service inherits it. If the push fails, fix `gh auth` / your ssh agent —
do not put a token in the plist.

## What it does and does not decouple

Removes GitHub **Actions** from the critical path of producing a tick. Does **not** remove GitHub:
the lane is still pushed to a git remote. `--remote` is a parameter so that stays config, not code.
