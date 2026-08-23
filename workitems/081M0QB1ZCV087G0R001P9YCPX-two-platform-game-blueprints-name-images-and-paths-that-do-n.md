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
