# Character asset storage

Status: operational user direction, 2026-09-09
Scope: AceHack/Xenaa character experiments and their successors

## Git contains the recipe and evidence index

Commit generator source, parameters, compact measurements, provenance, hashes
and links to versioned release ZIPs. Do not commit generated character PNGs,
other full-resolution previews, Blender files, GLBs, videos or delivery ZIPs.
Full-resolution images belong inside the release ZIP, not as raw Git files or
individual release attachments. The character-research `.gitignore` patterns
reinforce this convention; they are not a server-side prohibition on force-add.

The v14 PNGs were an unsuitable example. They have been removed from the current
Git tree. This is an ordinary deletion, not a shared-history rewrite; historical
clones can still contain the earlier blobs.

## Each release contains its own version

A new release ZIP contains that version's selected assets, source recipes and
validation receipts. It does not duplicate previous releases for rollback.
Link the preceding release and any separately archived source inputs. Retain
existing immutable releases as provenance. Do not change historical manifest
claims to make old bundles appear to follow the newer convention.

On the workstation, keep the current candidate, a useful rollback when needed,
and original source inputs required for ongoing quality work. These need not
all be copied into the next release. Remove obsolete render caches and duplicate
restore/download folders only after verifying exact bytes against a preserved
archive. Record what was deleted, the byte count and the restoration source.
Do not remove unique reference art, environments or checkpoints merely because
their directories are large.

## Quality is a separate acceptance criterion

A rig or import test passing does not establish visual quality. Compare against
the best pre-rig source at a matched neutral camera before promoting a candidate.
Keep high-detail reference surfaces separate from mobile reduction; rigging is
not authorization to replace detailed anatomy/clothing with low-detail shapes.
Check neutral geometry, original UV retention, moving poses, head/hair attachment,
facial behavior and mobile runtime separately. Failed candidates can be recorded
as experiments without making them the default asset.

Current experimental records: [v15](research/2026-09-09-tiktok-character-v15/README.md),
[v14](research/2026-09-09-tiktok-character-v14/README.md)
and [pre-rig composition](research/2026-09-09-character-evolution/README.md).
