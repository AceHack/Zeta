---
id: 081M3Y2E1Y8087G0R00351Y063
type: bug
state: backlog
priority: P1
slug: strengthen-cluster-hygiene-secret-call-r5-absence-assertion
title: "Strengthen cluster-hygiene secret-call R5 absence assertion"
created: 2026-10-02T10:26:51.464Z
depends_on: []
composes_with: []
---

# Strengthen cluster-hygiene secret-call R5 absence assertion

`lint (bash retirement inventory + hygiene unit tests)` on `1ef83ad349`
(`#17862` archive of `#17860`). R5 count rose 0 -> 1 in
`src/Core.TypeScript/cluster/cluster-hygiene.test.ts`:

```ts
expect(secretCalls[0]).not.toMatch(/jsonpath|yaml|json|go-template|base64/);
```

The SUBJECT names SECRET (`secretCalls`), so it is an
absence-under-a-taint-claim site. A string-absence search witnesses one
rendering of a leak, never its absence. Strengthen to equality on
`.test()`. Keep `toContain("-o name")`. Do not `--accept-raises`.

Prior art: `#17543` / `081M35K3ZYD087G0R001JN6544` (same ratchet,
PASSWORD-named matcher).
