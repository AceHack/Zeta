# `git clone` at a tag stays sufficient — forever, not transitionally

Carved sentence:

> A repo must stay buildable and checkable from **`git clone` at a pinned tag**,
> with no package manager present — **permanently**, never "until `ace` ships".
> `ace` may be the *good* path and may accumulate any amount of use; the moment it
> becomes the *only* path, it is an **appointed hub** and manifesto §1 is violated.
> The discriminator is **exit, not degree**: if a consumer can resolve without it,
> it is an oracle you chose; if it must route through it, it holds you.

## Why now, before it can happen

`docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` says the
`.forge-version` glue is *"replaced by `ace pull forge@<version>`"*. **Replaced**
is the word that costs. A dependency-driven split makes this more tempting, not
less — the argument for splitting on dependency closure is that resolution should
be subset-aware, and the next thought is always *"so let `ace` resolve the
subsets."* That is how a good tool becomes a mandatory one. Free to adopt while
`ace` is optional; unretrofittable once the fleet depends on it.

## The falsifier (prose rots; a check does not)

`src/Core.TypeScript/hygiene/lint-clone-at-tag-is-sufficient.ts` — refuses `ace`
as a **resolver** in any bootstrap surface (`tools/setup/`, `.github/workflows/`,
the build props, `flake.nix`). Using, testing and publishing `ace` are untouched;
only *needing it to make the tree buildable* is refused. Honest limit, stated in
the file: the real falsifier is "clone at a tag with no `ace` on PATH and build",
which cannot run until a second repo exists — this is the reachable proxy until
then, and the file is where the real test replaces it.

## Pointers

- [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](itron-hub-patent-boundary-p2p-is-the-upgrade.md) — appointed vs emergent hub; **exit** as the discriminator (Hirschman 1970)
- [`manifesto-13-specifications.md`](manifesto-13-specifications.md) — §1 scale-free (no central point of control), §3 weight-free
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — the "replaced by `ace pull`" sentence this guards
- `docs/research/2026-08-19-repo-split-round-2-*.md` §6 and `-round-3-*.md` §11 — where the requirement was measured out and why it sharpened
