# The surface-declaration format — one more qualifier, not a new grammar

**Status:** design. **Register: UNMETERED, and closer to `toy`.** Nothing reads a surface
declaration; no install set has been computed from one; no wall-clock saving has been measured.
**Date:** 2026-08-20 · **Companion to:** `2026-08-20-surface-declarations-are-data-*.md`
**Surfaces are deliberately NOT enumerated** — per that note's §6c the roster stays open. The one
worked example below is the fork that *already happened*, used as an instance rather than a proposal.

## 0. The shape, in one sentence — and the anchor is Aaron's own

> **A manifest row declares what it PROVIDES; a surface declares what it NEEDS; the install set is
> the join.** Nothing is restated, because the two sides never speak the same vocabulary — rows name
> packages, surfaces name capabilities, and the only shared symbol is the capability id.

That sentence is already in the repo. `tools/setup/common/host-tier.sh` quotes Aaron 2026-06-12
(workitem `081KTWQZY7F08QG0R0034KN17T`):

> *"packages can declare their requirements and os declare their capabilities and that's how we know
> not to install on small/slow runners."*

**The tier system is that idea collapsed onto a CHAIN. This design is the same idea on a LATTICE.**

## 1. The format already exists — it is one more qualifier token

The repo has a manifest grammar with **four independent implementations of one token vocabulary**:
one line per entry, first token is the id, remaining tokens are `key=value` qualifiers, `#` comments,
blanks ignored. Live qualifiers today: `bin=`, `tier=`, `when=`, `winget=`, `choco=`, `optional`,
`sha256=`, `requires=`. Two parsers are already held in parity — `tools/setup/mechanisms/_when.sh`
and `src/Core.TypeScript/ace/setup-realizers/when.ts`.

So the format is **one more qualifier plus a file of capability names** — nothing new to parse and
nothing new to keep in N-oracle parity. Readable by `awk`, `grep`, `builtins.readFile`, TS, or a
human *by construction* rather than by promise.

**(1) `provides=` on existing rows**, in the same slot as `tier=`:

```
opam  provides=proof.tlaps  requires=lang.ocaml
```

An **untagged row defaults to `provides=base`**, and every surface implicitly needs `base`. That
default is load-bearing: forgetting to annotate makes a row reach *every* surface (over-install —
wasteful, safe), never *no* surface (silent omission — the #12876 failure). Same stance as
`Wall.Whitebox`: **unknown is not permissive.**

**(2) A surface file — capability names only, never a package:**

```
# tools/setup/surfaces/<name>
needs=<capability>
plays=<other-surface>
```

The absence of package ids is not a convention; it is what falsifier **F2** checks mechanically.

**(3) A link file for `.mise.toml`, because TOML has no token slot.** This is the ugliest seam and is
named rather than hidden: `manifests/mise-capabilities` maps mise **tool keys** → capabilities,
checked **bidirectionally** (every key must exist in `.mise*.toml`; every tool there must appear
here). Restating a key under a total two-way check is a **link** in the DV2.0 sense — the hub is the
key, the satellite (the version) never moves. Restating *content* with no check is what #12876 did.
**The difference is the check**, and saying so is what stops the seam rotting into the same fork.

## 2. Resolution — a pure function of files on disk

```
closure(S)  = least fixpoint over `requires=` of  ⋃ { needs(s) | s ∈ plays*(S) }
install(S)  = { row | provides(row) ∩ closure(S) ≠ ∅ }
```

No host probing, no execution — a human can evaluate it with `grep` and a pencil. And `closure` is a
least fixpoint over a DAG (a cycle is an error, reported, never resolved), which makes the companion
note's *"a surface set IS a dependency closure"* **literally true rather than a metaphor**: the same
fixpoint, queried once for install sets and once for repo boundaries.

## 3. The partial order — and tiers survive as a derived view

Surfaces are points in the powerset lattice **(𝒫(Caps), ⊆, ∪, ∩)**. `cloud-agent` and `proof-lane`
are simply **incomparable**, and the lattice has no opinion about that — which is the whole point. A
chain cannot express it; that is why "more tiers" fails.

**Tiers become derived, not discarded.** Rewrite `tier=X` as `provides=tier.X`, and make
slim/standard/full ordinary surfaces with `standard plays=slim`, `full plays=standard`. That
reproduces today's semantics exactly *and* converts the nesting from an **axiom** into an
**assertion**: `closure(slim) ⊆ closure(standard) ⊆ closure(full)` is now a check that can go red
(**F4**). If a real host ever breaks the chain, the assertion says tiers were the wrong axis for that
thing — information the current design cannot produce.

## 4. Composition is UNION, and it has to be

`plays=` unions closures. Union is **idempotent, commutative, associative**, so: playing a surface
twice equals playing it once (discipline #6, free); there is no install-order question; and two
agents computing a node's set independently **converge** — a join-semilattice, G-Set/CRDT-shaped
(discipline #2). Any other composition law breaks at least one of those.

Cargo's feature system reached the same constraint independently and states it as doctrine
(*"features should be additive"*) — a different ecosystem, a different decade, the same forced move.

## 5. Worked example — and a live inconsistency it exposed

`tools/setup/surfaces/cloud-agent`, six lines, **zero package ids, versions, URLs or commands**:

```
needs=lang.dotnet
needs=lang.ts
needs=repo.git
needs=agent.cli
```

Annotating real `manifests/apt` rows (one token each) resolves it to the four `base` rows + `git` +
the four .NET host libs. It does **not** get `opam`, `qemu-system-x86`, or the Yubico set — **by
declaration, not by a fork's omission.** The four Yubico packages that today *"will never reach that
environment, and nothing will notice"* become a row nothing needs, which **F3** reports.

> **And the failure mode inverts.** Today, adding a package to `manifests/apt` silently fails to
> reach the fork. Under this format, adding one with no `provides=` reaches *everything*. **The
> mistake becomes visible as cost instead of invisible as absence.**

**PREREQUISITE — a live inconsistency, worth reporting on its own.** `manifests/apt` cannot carry
qualifier tokens today: `linux.sh` strips comments and passes the **whole remaining line** to
`apt-get install`, and the manifest says so at line 179 (*"a `tier=` suffix would be read as a
version-pin — brew uses tier=, apt does NOT"*). But `parseManifest` in
`src/Core.TypeScript/ci/manifest-symmetry.test.ts` already takes **`l.split(/\s+/)[0]`** — first
token only. **The test already believes apt rows may carry qualifiers; the installer does not.** A
one-line `awk` change (`NF > 0 { print $1 }`) closes it, and it must land before any `provides=`
touches an apt row. `manifests/brew` already handles tokens.

## 6. What would falsify it

- **F1 — the bare-clone falsifier (the real one).** Clone at a tag with no `ace`, no `bun`, no
  `mise`. Read one surface file, satisfy it by hand, build. **If any step requires *executing* repo
  code to learn what is needed, the format is a program wearing a data file's name.**
- **F2 — the no-restatement lint (sharpest and cheapest).** Any token in `surfaces/*` that is also a
  package id in `manifests/*` or a key in `.mise*.toml` ⇒ **red**. The moment a surface names a
  package it has become #12876 with better formatting. *And if this lint can never fire because
  surfaces are trivially small, the format has not been exercised.*
- **F3 — closure coverage, both directions.** Dangling `needs=` ⇒ red. A row unreachable from every
  surface ⇒ a package nothing needs. Honest limit: the second half stays noisy while `base` is the
  default, and if it is noisy *forever* that is evidence the capability vocabulary is too coarse.
- **F4 — the tier chain.** `closure(slim) ⊆ closure(standard) ⊆ closure(full)`.
- **F5 — the economic falsifier, which decides toy vs metered.** Declare one surface, install exactly
  its closure in one lint job, measure against the union. **If that saves nothing measurable, the
  design is unmetered ceremony and must be labelled so.** The companion note prices the union cost
  but explicitly does not measure the saving, and names a stalled archive mirror as a live competing
  explanation for the `exit 124` timeouts.
- **F6 — the split falsifier.** Overlapping closures ⇒ the boundary is wrong. A closure spanning two
  candidate repos ⇒ either the split or the surface is mis-drawn.
- **F7 — inertness, mechanically.** Must parse in ≤5 lines of `awk` and in a Nix expression with no
  import of repo code — **and by the two parsers that already exist**. A format needing a third
  grammar has doubled the N-oracle parity surface to buy nothing.
- **F8 — the reconstruction test (anti-Babel).** Hand a peer only the capability ids and the rows,
  without the surface files, and ask which surface a row serves. If capability names are opaque
  coinages it cannot — and the **vocabulary** needs repair, not the format.

## 7. Considered and rejected

| option | why not |
|---|---|
| a new TOML/JSON/YAML surface format | second grammar, third parser, doubled parity surface (F7); YAML also fails the `awk`/Nix half of inertness |
| more `.mise.<name>.toml` via `MISE_ENV` | the merge is a **chain with last-wins override**, not a union — `.mise.full.toml`'s own comment records a bare `rust = "1.87.0"` there **silently disarming** the base file's components/targets |
| extending `tier=` with more tiers | total order — the reason this work exists |
| a per-surface install script | the failure under design (#12876) |
| generating surfaces from the CI matrix | a generator is a program you must run (F1). Kept instead as the **validation corpus**: the job names *are* the enumeration, so a surface set that cannot reproduce the matrix is wrong |
| Nix flake outputs as the surface set | makes Nix the mandatory resolver — a second appointed hub, forbidden by the same rule as `ace` |
| `provides=` in TOML comments | a comment is not a mechanism — the exact defect the mise-pin parity check just replaced |
| a hand-maintained surface→package allowlist | derive from declarations, never from a list that drifts from them |

## 8. Anchors (Beacon)

**Debian Policy §7.5** virtual packages — the canonical Provides/Depends prior art (moderns: RPM
`Provides`/`Requires`, `pkg-config` `Requires:`) · **Cargo features**, whose *"features should be
additive"* is §4 arrived at independently · **Birkhoff**, *Lattice Theory* (1940) — powerset lattice,
join-semilattice · **Shapiro, Preguiça, Baquero & Zawirski (2011)** — state-based CRDTs, why `plays=`
needs no coordination · **Dolstra (2006)**, *The Purely Functional Software Deployment Model* —
install set as a value, not a script · **Hirschman (1970)** via
`itron-hub-patent-boundary-p2p-is-the-upgrade` — exit, not degree · **Aaron 2026-06-12**, quoted in
`host-tier.sh` — the in-repo human anchor this design is a lattice-shaped restatement of.

*(All anchors cited, not checked — no entailment check was run against any of them.)*
