# GitLab Valkey after a hard shutdown: the repair is in the pod, not in a runbook

> **Carved sentence.** A power cut must never leave the GitLab Valkey unable to start. Whatever state the volume is in,
> the pod reads it on every start and either leaves it alone or cuts it back to the last good command, keeping a copy.

Where it lives: StatefulSet `gitlab-valkey` in `gitlab-runner.extraObjects` of
`full-ai-cluster/k8s/applications/gitlab/Application.yaml` (init container `aof-repair`). Falsifier:
`src/Core.TypeScript/cluster/gitlab-valkey-aof-self-heal.test.ts`.

## What happened (2026-11-24, hard power cut on the owner's node)

`gitlab-valkey-0` crash-looped on `Bad file format reading the append only file appendonly.aof.447.incr.aof`. Rails,
Sidekiq, the registry and the runner all depend on it, so GitLab stayed down until `valkey-check-aof --fix` was run by
hand on the volume.

The last 682 bytes of the incr file were NUL. The filesystem had extended the file but never written the data blocks, so
the tail was not a half-written command. Valkey's `aof-load-truncated yes` (the default) forgives only a cut-off final
command; NUL padding after a complete one is "bad file format" and the server refuses to start. Nothing in the pod
repaired it.

## The algorithm

The init container is level-triggered: it reads the volume's state at every start and acts on that state alone.

| state of `/data/appendonlydir` | action |
|---|---|
| no manifest (fresh volume) | nothing |
| `valkey-check-aof` says valid | nothing, and nothing is written |
| invalid | copy the directory to `/data/aof-repair-backups/<UTC stamp>` (newest `KEEP_BACKUPS`, 3, kept), then `valkey-check-aof --fix` |
| still invalid after `--fix` (corrupt base or manifest) | the copy is already kept; the AOF directory is removed so the server starts empty |

If the copy cannot be made (volume full) the init container fails and the AOF is left exactly as found: it never repairs
with no copy. Lost state in the last row is the Sidekiq queue and sessions; GitLab itself comes up.

## What bounds the loss

The server flags are pinned in the StatefulSet instead of inherited from the image: `--appendfsync everysec` (at most
about a second of writes), `--aof-use-rdb-preamble yes`, `--aof-load-truncated yes`, `--no-appendfsync-on-rewrite no`,
`--auto-aof-rewrite-percentage 100`, `--auto-aof-rewrite-min-size 64mb`, `--save "3600 1 300 100 60 10000"`. With the
AOF on, the RDB snapshot is not read at start; it is a second copy for a human. `terminationGracePeriodSeconds: 60` gives
a graceful stop time to flush.

## After a restart that repaired something

```bash
kubectl -n gitlab logs gitlab-valkey-0 -c aof-repair      # "AOF repaired" or "cannot be repaired"
kubectl -n gitlab exec gitlab-valkey-0 -- ls -la /data/aof-repair-backups
```

Backups are kept inside the volume (2Gi) and are small (tens of MB). Delete old ones by hand if the volume fills.

## Not covered here

The shared `redis` Application (Valkey chart 0.12.0, namespace `redis`, Orleans membership) runs the same server on a
different chart and has no such repair; that is a follow-up, not part of this change.
