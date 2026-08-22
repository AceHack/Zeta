# inventory/items/ — the LFG asset register, git-as-database

One markdown file per physical asset, **ZetaId-keyed** (`Category.InventoryAsset`,
conflict-free, time-sortable — same discipline as `workitems/`). **Git IS the
database**: the immutable who/what/when change log is `git log` on the item file
(no separate change_log table), identity never renumbers (the ZetaId is the
surrogate key), and edits are commits/PRs — humans and agents use the same write
path. Open by design.

## File shape

`inventory/items/<zetaid>-<slug>.md` — flat YAML frontmatter + free-text notes body:

```markdown
---
id: <ZetaId>            # identity; minted by new-item.ts, never reused
name: RTX 4090 FE       # required
brand: NVIDIA
model_pn: 900-1G136-2530-000
qty: 1                  # required, integer >= 1
device_type: gpu        # gpu | cpu-system | laptop | networking | storage | display | peripheral | rack | power | other
category: compute       # freeform section, e.g. compute / lab / office
status: active          # active | storage | attention | repair | retired | disposed | missing
location: rack-1        # where it physically is
assignment_purpose: k3s-gpu-node
value_usd: 1599.00      # acquisition value; drives the depreciation schedule
serial: "..."           # quote if it could parse as a number
acquired: 2026-01-15    # optional, YYYY-MM-DD
assigned_machine: ""    # optional; a machines/ hostname when racked into the cluster
---

Free-text notes: provenance, quirks, warranty, links.
```

Statuses map 1:1 onto the original spec enum (Active/In Use → `active`, In
Storage → `storage`, Needs Attention → `attention`, In Repair → `repair`,
Retired(Archived) → `retired`, Disposed → `disposed`, Missing → `missing`).
Archive = `status: retired`, never file deletion (memory preservation).

## Tooling

- Mint a new item: `bun src/Core.TypeScript/inventory/new-item.ts --name "..." [--qty N ...]`
- Regenerate the index: `bun src/Core.TypeScript/inventory/generate-items-json.ts`
  → writes `inventory/items.json` (committed; the static viewer + dashboards read it).

## Lineage

Supersedes the Supabase backend (see `../spec.md` §Pivot 2026-07-02). Items
carrying `sample: true` frontmatter are placeholders proving the shape — they are
replaced by the transcription of the paper register.
