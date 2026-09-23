---
id: 081M35K3ZYD087G0R001JN6544
type: bug
state: backlog
priority: P2
slug: arity-nonequality-red-on-main-strengthen-opensearch-hex-draw
title: "arity-nonequality red on main: strengthen OpenSearch hex-draw regex falsifier"
created: 2026-09-22T22:17:26.733Z
depends_on: []
composes_with: []
---

# arity-nonequality red on main: strengthen OpenSearch hex-draw regex falsifier

`lint (bash retirement inventory + hygiene unit tests)` on `57ae57dab3`
(`#17540` WP22). R5 count rose 0 -> 1 in
`src/Core.TypeScript/cluster/dev-cluster/lib.test.ts`:

```ts
expect(plainHex).not.toMatch(OPENSEARCH_ADMIN_PASSWORD_REGEX);
```

The matcher names PASSWORD, so it is an absence-under-a-taint-claim site.
A string-absence search witnesses one rendering of a leak, never its
absence. Strengthen to equality on `.test()` plus a positive hex
character-class pin. Do not `--accept-raises`.

Prior art: `#16881` / `081M1WDDHQG087G0R001NWF589` (same ratchet, NCI
oracle independence).
