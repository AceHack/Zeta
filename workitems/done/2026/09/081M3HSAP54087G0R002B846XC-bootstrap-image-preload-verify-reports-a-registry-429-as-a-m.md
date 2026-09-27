---
id: 081M3HSAP54087G0R002B846XC
type: bug
state: done
priority: P2
slug: bootstrap-image-preload-verify-reports-a-registry-429-as-a-m
title: "bootstrap-image-preload --verify reports a registry 429 as a moved digest (a supply-chain event) instead of could-not-check"
created: 2026-09-27T15:56:50.724Z
completed: 2026-09-27T16:01:35.227Z
depends_on: []
composes_with: []
---

# bootstrap-image-preload --verify reports a registry 429 as a moved digest (a supply-chain event) instead of could-not-check

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3HSAP54087G0R002B846XC-*.md` glob. -->

## The measurement

build-iso on PR #17695 (job 108649139794) failed at "Verify the bootstrap image pins
still resolve" with:

    UNRESOLVABLE ecr-public.aws.com/docker/library/redis:8.6.4-alpine — manifest HTTP 429
    1 of 26 images no longer resolve to the pinned digest ... a supply-chain event

A 429 says the registry declined to answer, not that the digest changed. Reporting it as
a supply-chain event teaches readers to dismiss the one message that must never be
dismissed.

## Fix (closed in the same change)

- `withTransientRetry` in `bootstrap-image-preload.ts` retries 429, 5xx and network
  errors up to 5 attempts, with backoff of 5/10/20/40 s. It honours `Retry-After`
  (delta-seconds or HTTP-date). Total wait is capped at 180 s. A `Retry-After` beyond
  what is left ends the retries rather than hanging the job.
- `resolveAmd64Digest` returns `couldNotCheck: true` when the budget is spent.
  `verifySnapshot` (what `--verify` now calls) counts **COULD-NOT-CHECK** separately
  from MOVED/UNRESOLVABLE. It still exits 1, because a verification that did not run
  is not a pass, but its sentence says "rate limited, rerun" and never
  "supply-chain event". A 404 is not retried and still counts as UNRESOLVABLE.
- `--build-archive` pulls the same images and would hit the same limit, so its
  manifest and blob fetches retry too. A spent budget there throws "COULD NOT FETCH ...
  rerun, this is not a moved digest".

Falsifiers are in `bootstrap-image-preload.test.ts`:
- 429 → retry → ok, honouring Retry-After
- a persistent 429 becomes COULD-NOT-CHECK after exactly 5 attempts
- a network error becomes COULD-NOT-CHECK
- a 404 is not retried
- a Retry-After past the budget stops the retries
- `verifySnapshot`'s wording for each outcome
- negative control: a different digest is still a supply-chain event
- blob 429 → retry, and a persistent blob 503 reports COULD NOT FETCH
