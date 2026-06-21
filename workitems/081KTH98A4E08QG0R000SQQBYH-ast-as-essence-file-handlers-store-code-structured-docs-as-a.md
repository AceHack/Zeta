---
id: 081KTH98A4E08QG0R000SQQBYH
type: task
state: backlog
priority: P2
slug: ast-as-essence-file-handlers-store-code-structured-docs-as-a
title: "AST-as-essence file handlers: store code/structured-docs as AST-in-YAML, render per-developer style from editorconfig (semantic merge, no formatting noise)"
created: 2026-06-07T14:54:39.246Z
depends_on: []
composes_with: ["081KTGTJC1Q08QG0R002VCB55A", "081KT07NV0008QG0R001YDB73K"]
---

# AST-as-essence file handlers: store code/structured-docs as AST-in-YAML, render per-developer style from editorconfig (semantic merge, no formatting noise)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH98A4E08QG0R000SQQBYH-*.md` glob. -->

## Purpose

Aaron 2026-06-07: custom file handlers for code + structured-doc types that store the **AST (in YAML)**
instead of the source text, removing all formatting/whitespace/style noise. The AST is the content-addressed
**essence** (confluent, dedupable, semantic-merge); **style is a per-developer lens** rendered from the AST +
editorconfig ("almost") — each dev gets their own view, NOT forced into team style. Full design:
`docs/research/2026-06-07-canonical-essence-bit-perfect-serializers-ast-as-essence-yaml-per-developer-style-views-aaron.md`.

## Why (the chain)

Content-addressing/confluence need a canonical essence (same logic -> same hash). Source text carries style
noise -> spurious diffs/conflicts. Storing the AST removes it: AST = content; style = per-dev view. Better
than format-on-checkin (which forces ONE team style) — per-dev style freedom + semantic (AST-level) merge.

## Storage form is flexible (Aaron cont.): canonical-code-text | AST | DynamicValue

The essence is a CANONICAL FORM ("Zeta style" per language, arbitrary-but-fixed), not necessarily an AST.
Bidirectional Roslyn-like translators: checkout/edit -> dev's chosen style; check-in -> Zeta canonical
(gofmt-on-checkin made BIDIRECTIONAL). Pragmatic first cut: **canonical-code-text** + a deterministic+
idempotent formatter on check-in + per-dev re-style on checkout — preserves comments naturally (vs naive
AST), works with existing formatters (Roslyn/Fantomas/Prettier/rustfmt). Upgrade to AST (semantic merge) or
DynamicValue where wanted.

## Build (incremental, per file type)

- A ZetaFS custom file handler (per-file-type plugin): on save text->AST(YAML, canonical); on open
  AST->styled-text per the dev's editorconfig/style config. Round-trip-faithful (MUST preserve comments /
  doc-comments / trivia as AST annotations).
- AST node = a DynamicValue/Bonsai tree, content-addressed; merge is semantic (AST-level) -> no whitespace
  /style conflicts, only real conflicts.
- Start with ONE language (e.g. F# or a structured-doc like markdown/JSON) end-to-end; expand per language.

## Acceptance

For one file type: text->AST->text round-trips preserving semantics + comments; two devs with different
style configs see different views of the same AST node (same content hash); a formatting-only change
produces NO diff; a semantic change merges at the AST level.

## Anchors

- canonical-essence research doc · ZetaFS per-file-type plugins (081KTGTJC1Q) · confluence (081KTH8RSXS) ·
  bit-perfect serializers / 081KT07NV0008QG0R001YDB73K · DynamicValue/Bonsai (AST-as-data) · Unison (content-addressed code),
  MPS/Lamdu (projectional), tree-sitter/Roslyn (faithful AST incl. trivia), editorconfig, gofmt/Prettier.
