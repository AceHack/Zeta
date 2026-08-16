---
id: 081M05X879K087G0R003TSBM9D
type: task
state: backlog
priority: P2
slug: ace-graphmerkleroot-is-a-32-bit-java-string-hash-not-a-merkl
title: "ace graphMerkleRoot is a 32-bit Java string hash, not a Merkle root - replace with ZSetMerkle"
created: 2026-08-16T18:27:25.619Z
depends_on: []
composes_with: []
---

# ace graphMerkleRoot is a 32-bit Java string hash, not a Merkle root - replace with ZSetMerkle

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05X879K087G0R003TSBM9D-*.md` glob. -->

## The finding

`graphMerkleRoot` in `src/Core.TypeScript/ace/ace-cli.ts` is **not a Merkle root**
and is **not an integrity primitive**, despite the name and the `zeta:` prefix
that reads like a content address. The body is:

```ts
hash = ((hash << 5) - hash + entry.charCodeAt(i)) | 0;
```

which is `h = h * 31 + c` — Java's `String.hashCode` (Bloch, *Effective Java*).
Properties:

- **non-cryptographic** — collisions are constructible by hand, not merely
  birthday-bounded
- **32 bits** — the output space is 2^32 even before that
- **not a tree** — so it proves no inclusion and supports no partial verification,
  which is the entire point of a Merkle root

The existing comment said "STUB: simple deterministic hash", which is true but
badly under-states it: a reader who trusts the *name* over the comment will treat
the value as tamper-evident. The sweep PR expanded that docstring to say what it
actually is.

## The replacement

`src/Core.CSharp/ZSetMerkle.cs` is the real construction and already exists.

## Why it is a separate decision

Replacing the hash **changes every emitted root**. Anything that has recorded a
`zeta:...` value — a lockfile, a cached graph, a test fixture — has to be
regenerated. That is a deliberate change with a blast radius to establish, and it
was correctly kept out of a collation-cleanup PR that only reordered the hash's
input.

## Already done (in the sweep PR)

The entries feeding the hash were ordered with `localeCompare`, so the "root"
depended on the running machine's locale. That is fixed — it now uses the treaty
comparator. Measured: registry package names today are lowercase-alphanumeric, a
domain on which locale and code-point order agree (0 mismatches), so **no
currently-emitted root changed**. The divergence was latent and would have
activated on the first mixed-case package name.
