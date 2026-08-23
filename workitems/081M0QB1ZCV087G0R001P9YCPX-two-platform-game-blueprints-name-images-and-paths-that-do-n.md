---
id: 081M0QB1ZCV087G0R001P9YCPX
type: bug
state: backlog
priority: P2
slug: two-platform-game-blueprints-name-images-and-paths-that-do-n
title: "Two platform game Blueprints name images and paths that do not exist — arma-reforger has no publisher image, and every steamcmd blueprint calls the wrong steamcmd path"
created: 2026-08-23T12:55:46.331Z
depends_on: []
composes_with: []
---

# Two platform game Blueprints name images and paths that do not exist — arma-reforger has no publisher image, and every steamcmd blueprint calls the wrong steamcmd path

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QB1ZCV087G0R001P9YCPX-*.md` glob. -->

## Two findings, both measured against the registry on 2026-08-23

### 1. `arma-reforger` names an image nobody publishes

`full-ai-cluster/k8s/applications/platform/blueprints.yaml` pins
`ghcr.io/ich777/steamcmd:armareforger`. That tag does not exist:

```
$ GET ghcr.io/v2/ich777/steamcmd/tags/list?n=1000   ->  94 tags
   arma-family entries: arma3, arma3exilemod          (no reforger)
$ gh api /users/ich777/packages?package_type=container -> no arma-reforger package
```

The sibling `gmod` blueprint had the same defect with a fix available — the publisher's tag
is `garrysmod`, and that is landed on `fix/unpriced-charts-measurable`. **Arma Reforger has
no such fallback: ich777 ships no Arma Reforger image at all.**

Substituting another game's tag was considered and REFUSED as unevidenced. The four
game tags checked share only their first two layers:

```
latest     7e0fe432,0469edde,3ac72d1b,59d8a5a7,01282ad6,efe9015b
garrysmod  8cf9fb7a,06185312,1b89c702,658258b3,f1ce510a,6a196ad1
unturned   8cf9fb7a,06185312,f9018171,f76541a3,bdc4f3b2,fbe526b8
arma3      8cf9fb7a,06185312,fc46ba4f,71216d42,8cf52763,1037bb50
```

Layers 3-6 differ per game, so "they are all the same steamcmd base" is FALSE as stated,
and picking one would be a guess wearing a pin's clothes.

This is one of `platform`'s five remaining CANNOT-BE-PRICED blockers. **It needs a
decision, not a lookup:** drop the blueprint, build an Arma Reforger image, or find another
publisher.

### 2. Every steamcmd blueprint calls a steamcmd that is not there

All three blueprints run:

```
install: "/opt/steamcmd/steamcmd.sh +force_install_dir /data +login anonymous +app_update <id> validate +quit"
```

The image's own config blob says otherwise — identical across `latest`, `garrysmod`,
`unturned` and `arma3`:

```
Entrypoint ["/opt/scripts/start.sh"]
Env  DATA_DIR=/serverdata  STEAMCMD_DIR=/serverdata/steamcmd
     SERVER_DIR=/serverdata/serverfiles  GAME_ID=template  USER=steam
```

steamcmd lives under `/serverdata/steamcmd`, and `/serverdata` is the data volume the
image's own `start.sh` populates at runtime — there is no `/opt/steamcmd`. So `gmod`,
`unturned` and `arma-reforger` would all fail at install even once the image pulls.

`unturned` is the tell: it MEASURES fine and has always measured fine, so no pricing
signal ever pointed at it. A blueprint that is priceable and wrong is exactly the failure
the pricing work is not built to catch.

## Done when

`arma-reforger` names a real image or is removed, and the `install:` commands agree with
whatever `STEAMCMD_DIR` the chosen image declares — checked against the image config, not
against this file.

---

## UPDATE 2026-08-23 — finding 1 is CLOSED, finding 2 is STILL OPEN

### Finding 1 resolved: kept, not removed — the provenance was findable

Aaron's framing was _keep-if-real, remove otherwise_: "the steamcmd we can keep if we can
find the right provenance — if not, let's just remove it. It's not core, but I'd rather
keep it if it makes sense and we can find where it comes from, the latest version."

**ich777 was re-checked first and the "no fix at this publisher" conclusion held**, by
enumeration rather than by a single 404:

```
GET ghcr.io/v2/ich777/steamcmd/tags/list?n=1000   -> 94 tags
   arma-family: arma3, arma3exilemod              (nothing reforger-shaped)
manifests: armareforger / arma-reforger / reforger -> HTTP 404, HTTP 404, HTTP 404
gh api /users/ich777/packages?package_type=container -> 98 packages, none Arma Reforger
hub.docker.com/v2/repositories/ich777/            -> same set, no Arma Reforger
```

The `gmod -> garrysmod` precedent is why the tag list was enumerated instead of trusting
the 404. It changed nothing here: the publisher genuinely ships no Arma Reforger image.

**A different publisher does, and it survived the evidence bar:**
`ghcr.io/acemod/arma-reforger`, pinned as
`ghcr.io/acemod/arma-reforger:sha-cd226c0@sha256:90883ce2f3d8b3b5b132ae7f4b3377afdc9e6be7e7c8cb1a290f8bd7b39d079c`.

| test                                                | result                                                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| resolves anonymously                                | yes — manifest HTTP 200, linux/amd64, no auth                                                                                           |
| measurable                                          | 55,712,029 compressed bytes via this repo's own `measureImage`                                                                          |
| provenance is the image's own, not a claim about it | label `org.opencontainers.image.source = https://github.com/acemod/docker-reforger`                                                     |
| maintained                                          | ACE Mod, MIT, 117 stars; tip commit `cd226c0` 2026-07-30                                                                                |
| **is it the latest version**                        | `latest` and `sha-cd226c0` resolve to the SAME digest, and `cd226c0` is the tip of the repo's default branch — so yes, and checkably so |
| does it agree it is this game                       | the image's config sets `STEAM_APPID=1874900`, the same appid this Blueprint passed by hand — the `garrysmod`↔`4020` check, repeated    |
| is the game real on Linux                           | Steam app-info 1874900 = "Arma Reforger Server", type Tool, `oslist windows,linux`, Linux depot 1874902                                 |

**And the path half was fixed for this Blueprint at the same time**, which is the part that
would otherwise have produced a measurable image that still cannot run. The `install:`,
`command:` and `args:` keys are **gone**, deliberately: `/app/launch.py` (the image's Cmd,
read out of the layer) runs `/steamcmd/steamcmd.sh +force_install_dir /reforger +login
anonymous +app_update $STEAM_APPID validate +quit`, writes
`/reforger/Configs/docker_generated.json` from the environment, then execs
`./ArmaReforgerServer`. Overriding the Cmd would skip both. Storage moved to `/reforger`
and the knobs became env vars from the image's documented contract.

`platform`'s CANNOT-BE-PRICED blockers: **3 -> 2**. Both survivors
(`zeta-platform-controller:latest`, `zeta-portal:latest`) are ours, private, and waiting on
a UI-only package-visibility flip — nothing in the tree can move them.

### Finding 2 still open, and now measured harder than before

The original evidence was the image's _declared_ `STEAMCMD_DIR=/serverdata/steamcmd`. The
layers themselves were then read, which says something stronger: **`/opt/steamcmd` does not
exist in the image at all, and neither does any steamcmd binary.**

`ghcr.io/ich777/steamcmd:unturned`, every path in all six layers matching `steamcmd` or
`opt/`:

```
serverdata/steamcmd          <- an EMPTY directory
opt/scripts/start.sh
opt/scripts/start-server.sh
```

`start-server.sh` explains why: steamcmd is **downloaded at runtime**, not shipped —
`if [ ! -f ${STEAMCMD_DIR}/steamcmd.sh ]; then wget ... steamcmd_linux.tar.gz`. The same
script then runs `+force_install_dir ${SERVER_DIR} +app_update ${GAME_ID}` itself, driven
by the `GAME_ID` env var.

So `gmod` and `unturned` are wrong twice over, not once:

1. `/opt/steamcmd/steamcmd.sh` is not a path in the image, so the initContainer fails —
   and it would still fail if the path were corrected to `/serverdata/steamcmd/steamcmd.sh`,
   because nothing has downloaded steamcmd there yet at initContainer time.
2. Their `command:` override replaces `/opt/scripts/start.sh`, which is the only thing that
   _would_ have installed the game. Fixing the install path alone leaves the pod running a
   binary that was never fetched.

**This is why the two blueprints were not "fixed" in the same change.** The correct fix is
to stop hand-driving steamcmd and configure the ich777 images the way they are built to be
configured (`GAME_ID`, `SERVER_DIR`, their own entrypoint) — the same shape the
`arma-reforger` fix took, but it changes what `command`/`args`/`storage.mountPath` mean for
both, and it deserves its own diff and its own review. `unturned` remains the tell: it
measures fine, so no pricing signal will ever point at it.

## Done when (revised)

- [x] `arma-reforger` names a real image, pinned so it cannot float
- [x] that Blueprint's invocation agrees with what its image actually ships, checked against
      the image's own config and layers rather than against this file
- [ ] `gmod` and `unturned` stop calling a steamcmd that is not in their image, and stop
      overriding the entrypoint that would have installed the game
