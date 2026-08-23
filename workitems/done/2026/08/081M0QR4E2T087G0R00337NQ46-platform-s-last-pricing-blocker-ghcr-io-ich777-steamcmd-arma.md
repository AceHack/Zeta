---
id: 081M0QR4E2T087G0R00337NQ46
type: bug
state: done
priority: P2
slug: platform-s-last-pricing-blocker-ghcr-io-ich777-steamcmd-arma
title: "platform's last pricing blocker: ghcr.io/ich777/steamcmd:armareforger is a tag upstream never published"
created: 2026-08-23T16:44:18.394Z
completed: 2026-08-23T17:13:43.856Z
depends_on: []
composes_with: []
---

# platform's last pricing blocker: ghcr.io/ich777/steamcmd:armareforger is a tag upstream never published

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QR4E2T087G0R00337NQ46-*.md` glob. -->

## The measurement

`ghcr.io/ich777/steamcmd:armareforger` is referenced twice in the tree:

- `full-ai-cluster/k8s/applications/platform/blueprints.yaml` — the `arma-reforger` Blueprint
- `full-ai-cluster/portal/src/blueprint-agent.ts:67` — the same image in the portal's catalogue

Measured 2026-08-23 against the live registry, anonymously:

- `ghcr.io/ich777/steamcmd` publishes **94 tags**. `armareforger` is **not** among them;
  the nearest are `arma3` and `arma3exilemod`.
- `ich777/arma-reforger`, `ich777/armareforger` and `ich777/steamcmd-armareforger` all
  refuse an anonymous pull token — no such repositories are published.

So this is not a visibility problem and not a rate limit. The reference has never
resolved, and `measure-lane-footprints.ts` reports it honestly as `manifest HTTP 404`.

## Why it is left open rather than fixed in passing

It is the LAST blocker keeping `platform` in the partitioner's `CANNOT BE PRICED`
quarantine (blockers went 3 → 1 on 2026-08-23 when the two `lucent-financial-group`
images were re-measured). Closing it means choosing a different upstream publisher for
an Arma Reforger server image, or retiring the Blueprint — a content decision about a
third-party workload, not a measurement fix. Recorded rather than guessed.

Note the Blueprint's own `install` line already runs
`steamcmd +app_update 1874900 validate`, i.e. it installs the game at runtime, so the
image may only need to be a generic SteamCMD base. That is a hypothesis for whoever
takes this, not a verified answer.

## Done when

`bun src/Core.TypeScript/cluster/lane-partition.ts` reports `platform` in a lane rather
than under `CANNOT BE PRICED`, with the image reference it prices resolving anonymously.

## CLOSED AS A DUPLICATE — and the duplication is the interesting part

Filed 2026-08-23T16:44Z. **#14282 had already landed at 16:29Z**, fifteen minutes
earlier, and closed it: `081M0QB1ZCV087G0R001P9YCPX` re-pointed the Blueprint at
`ghcr.io/acemod/arma-reforger` pinned by digest, on provenance read from the image's
own `org.opencontainers.image.source` label. Its `install:`/`command:`/`args:` went with
it, because that image installs itself and overriding the entrypoint would have produced
a _measurable_ image that still cannot run.

Two agents re-enumerated the same publisher independently and reached the same finding —
94 tags, `arma3` + `arma3exilemod`, no reforger tag anywhere at ich777. That agreement is
worth keeping precisely because it was reached twice without contact. Where they differed
is that the other went on to find a publisher that does ship one; this item stopped at
"it's a content decision" and declined to choose. Recorded rather than quietly deleted:
the decline was the more cautious call and it was also the less useful one.

Kept, moved to done, superseded by `081M0QB1ZCV087G0R001P9YCPX`.
