---
id: 081M3VPT17V087G0R001Z6SS1E
type: bug
state: backlog
priority: P2
slug: mimir-components-crash-loop-at-first-boot-because-they-start
title: "mimir: components crash-loop at first boot because they start before the S3 gateway and buckets exist"
created: 2026-10-01T12:25:12.187Z
depends_on: []
composes_with: []
---

# mimir: components crash-loop at first boot because they start before the S3 gateway and buckets exist

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3VPT17V087G0R001Z6SS1E-*.md` glob. -->

## Evidence

Constrained first-boot replica, run 36831938019 (main@15bbbc3433): mimir's start-up sanity check logged
`Unable to successfully connect to configured object storage (will retry) ... The specified bucket does not
exist` until its 20 retries (1-5s backoff, ~85s, mimir v3.2.0 `sanity_check.go`) ran out, then
`module failed module=sanity-check`, `error running application`, exit 1: CrashLoopBackOff, restartCount 1-4
on querier, ruler and store-gateway. The same logs show the S3 Service refusing connections on :8333 first.
Loki logged `NoSuchBucket` / S3 500s in the same run and tolerated them (no exit).

## Root cause

Nothing orders consumers after the buckets. seaweedfs is wave -5 and mimir wave 0, but the root's
Application health check is deliberately non-gating (`zeta.io/gates-later-waves` is opt-in), so wave 0 does not
wait for wave -5. And a gating seaweedfs would still not close it: the buckets come from the chart's
`post-install` hook Job, which only starts after the all-in-one Deployment is Healthy.

## Fix

A `wait-for-s3-buckets` init container on the six components whose start-up runs the object-storage sanity
check (ingester, store_gateway, compactor, querier, ruler, alertmanager): a SigV4-signed ListObjectsV2 against
the same endpoint, access key and minted secret mimir uses, for every bucket the Application names; 200 =
ready, 404 = bucket missing, 000 = gateway down; status printed every 5s; gives up after 1200s with exit 1
(a visible Init:Error). Same image the seaweedfs chart already pulls (curl 8.21), so one new
`image-source-provenance.json` row (anonymous pull 200, measured by `--refresh`, no other row touched).
`mimir-wait-for-s3-buckets.test.ts`: 28 cases, 13 red without the init containers, plus the script run under
sh against a stub curl for ready / ready-after-waiting / gave-up. The script was also run for real, read-only,
non-root, against seaweedfs 4.45 in docker: 200 when the bucket exists, 404 and a wait when it does not.

## Not claimed

That this is why `mimir` read `Degraded` in the WP11 installed-disk run 36832486494 (metal-rung requests of
2612m / 6180Mi for mimir alone against ~3250m / 9228Mi allocatable on the whole guest). It removes a real
first-boot crash loop that would also have hit metal on a slow boot.
