# Granular tool dependencies: the setup side never got the graph, and ace already has one

**Status:** design finding, not a proposal to land. Nothing here is built.
**Author:** Dejan (devops-engineer), 2026-08-24.
**Specimen:** `pam-reattach`, declared this round in `tools/setup/manifests/brew`.
**Ask:** Aaron 2026-08-24 — *"per-repo-wide definition is too large for this
monorepo … we need to treat deps almost like connected to the code, so the code
tracks what deps it needs … ace is the package manager of package managers, even
helm and k8s."*

## 1. The specimen, and why it is a good one

`pam-reattach` has **exactly one consumer in the entire repo**:
`tools/setup/touchid-sudo.ts`, which emits it into `/etc/pam.d/sudo_local` so the
Touch ID prompt can appear inside tmux. Nothing else references it, and nothing
else ever will — it is a macOS PAM module.

The only place to declare it is `tools/setup/manifests/brew`, which
`tools/setup/macos.sh` walks in full on **every** macOS setup. Measured on
`origin/main` today with the installer's own parser:

```
awk '{ sub(/#.*$/,""); gsub(/^[[:space:]]+|[[:space:]]+$/,"") } NF>0 {print}' \
  tools/setup/manifests/brew | wc -l
-> 26
```

26 formulae, installed as a set. A workflow that only typechecks TypeScript
installs `agda`, `emscripten`, `llvm`, `r`, `tectonic` and now a PAM module,
because **nothing in the tree knows which code needs which tool**. That is the
monorepo union-of-everything thesis, arriving in the dependency graph exactly as
Aaron has described it arriving everywhere else.

This is why the one-line append shipped alongside this document is labelled a
**stopgap**. It is correct, it is reversible, and it unblocks a real defect today
(Touch ID sudo is inert in tmux on the maintainer's host right now). It is also
one more row in a union that is already too wide.

## 2. The finding: ace has the graph, pointed at the other half

`src/Core.TypeScript/ace/` contains **two dependency systems at two different
granularities**, and only one of them got the graph.

| | `deps.ts` | `setup-manifest.ts` + `manifests/*` |
|---|---|---|
| granularity | **per unit** — nodes, edges, resolution | **repo-wide** — flat lists |
| models | Helm charts / k8s apps | tools and packages |
| has `dependsOn` | **yes** | no |
| temporal versions, rollback safety | **yes** | no |
| data in tree | 1 file (`examples/helm-dependency-graph/my-app-postgres/zeta-deps.yaml`) | 20 manifests, ~26 brew rows alone |

So the **app side got the graph and the setup side did not** — and the side with
the graph has one example file, while the side without it carries all the real
data. That inversion is the finding.

**A negative result worth recording, because Aaron asked whether we "regressed to
advance":** I searched history for deleted granular tool-dependency files —
`git log --all --diff-filter=D --name-only -- '*zeta-deps*' '*deps.yaml' '*.deps'`
— and found **none**. On that evidence granular *tool* deps were never built and
lost; the manifest set is the only tool-dependency surface this repo has had.
The limit of that search is stated plainly: it matches filenames, not a mechanism
that might have lived under some other name, so it is weak evidence of absence
rather than proof.

## 3. Can `deps.ts` carry tool deps as-is?

**No — but the shape transfers and should be generalized rather than copied.**

`DependencyNode` requires `chart: string`, and its wiring is Helm-specific:

```ts
export interface DependencyNode {
  chart: string;                       // REQUIRED, and meaningless for a brew formula
  version?: string | TemporalVersionSpec;
  dependsOn?: string[];                // <- this part is exactly right
  outputs?: Array<{ name: string; source: string;
    consumes?: Array<{ target: string }>;  // "my-app.values.database.url" — Helm values path
  }>;
}
```

`chart` and the `consumes.target` values-path plumbing do not generalize. What
does generalize is `dependsOn` + `resolveGraph`'s reachability walk + the
temporal-version handling — which is the majority of the value. The honest move
is to lift the node type to an interface over `{ id, dependsOn, version }` and
make the chart fields one *instance* of it, with a tool instance beside it. That
is the repo's own rule about interfaces being free and concrete types being
earned, applied to a type that was written concrete first.

**`capability-manifest.ts` is not the carrier.** I checked it because it was
suggested as one: it models *permissions* (`CapabilityScheme`, `parseCapability`,
`authorizedCapabilities`, `capabilityPermitted`) — what a package may **do**, not
what it **needs**. Those are duals and conflating them would produce a system
where declaring a dependency grants an authority.

## 4. The unit is DERIVED, not declared

Aaron 2026-08-24, settling it:

> *"track import statements and includes, things like this, command line names —
> the code tracks its dependencies. And foreign command lines we should try to
> rewrite … In the interim we hexagonal-port behind our interfaces and make sure
> ace can resolve what the code needs to work."*

This is strictly better than any manifest granularity, for the reason the whole
repo runs on: **a manifest can drift from the code; an import cannot.** The
declaration is not a file someone maintains beside the code — it *is* the code.

### What is mechanically extractable today

| source | edge carrier | cost |
|---|---|---|
| TS / JS | `import` / `export … from` | cheap — static, already parsed by tsc |
| F# / C# | `open` / `using` | cheap — one parser each |
| Rust · Python · Lean | `use` · `import` · `import` | cheap |
| **invoked command names** | **string literals inside `spawnSync` / `sh(...)`** | **not extractable in general** |

The last row is the whole problem. `spawnSync("brew", …)` and
`sh("git rev-list …")` are dependency edges hidden inside string literals, and no
import graph sees them. They are also, exactly, **undeclared dependencies on
whatever `PATH` produces** — which is why the next section is not a digression.

### The port is what makes the edge visible — that is its real job

The hexagonal port is presented as an interim compromise. It is better than that:
**a foreign command behind a named effects object is legible to a dependency
graph in a way a bare `spawnSync` is not.** Testability was the reason it got
built; declarability is what it turns out to buy.

The specimen is in-tree and I read it rather than assuming it:
`tools/setup/persona-keys/biometric.ts` exports `SudoGateEffects` (line 265) and
`realSudoGateEffects()` (line 319), with the port injectable at the call site
(line 364). One port, two goals, no trade.

**And the security work already landed today is the first instance of this
vision, not a neighbour of it.** `resolveElevator("sudo")` — Nazar's #14727,
**merged** as `7fcae2f28` — replaces name-resolution with an absolute path from a
committed registry. Read as security it closes a `PATH`-forgery P1. Read as
supply chain it is *the same operation*: an undeclared dependency on ambient
`PATH` became a declared dependency on a named artifact. Aaron's standing "no
ad-hoc sudo — privileged operations are committed, tested code" is the same
sentence again. The Touch ID installer shipped in #14753 consumes that port for
its one elevation.

So the sequencing writes itself: **port the foreign commands, and the derived
graph becomes possible.** Not "port them, and separately build a graph."

### Incremental builds over this graph is DBSP pointed at the repo

Aaron: *"and then the incremental builds on top of those graphs."* Change a
dependency → retract → re-derive the affected set. Zeta is an F# DBSP
implementation; `src/Core.TypeScript/ace/build-graph.ts` already computes an
affected-set from a diff. This is not an idea borrowed from Bazel or Nx — it is
**the repo's own algebra applied to its own build**, and the incremental-view-
maintenance framing is the one Zeta can state most precisely. (Bazel and Nixpkgs
remain the Beacon anchors for the *defined-whole-graph* half; build-graph.ts
already cites both.)

## 5. Storage: commit the derivation — and the guard is the hard part

Aaron 2026-08-24: *"since the declaration surface is small i think the derivation
should be versioned and checked in too."*

Four reasons, and the first is the strongest:

1. **Scientific reproducibility — an uncommitted derivation is UNFALSIFIABLE.**
   A graph that exists only transiently cannot be checked by anyone else; a third
   party has to take our word for what the dependencies were. Committed, anyone
   can re-derive at any revision and compare. That turns *"these are the
   dependencies"* from an assertion into a **checkable claim**, which is the
   whole difference between the two registers this repo runs on. Aaron's standing
   standard, quoted rather than paraphrased: *"prove your work lets others
   reproduce exactly"* and *"reproducibility is where the meter and the
   communications live, decorrelation is where the individual lives"* (both
   2026-08-23). **A committed derivation is a meter reading someone else can
   check.**
2. **`clone-at-tag-stays-sufficient` satisfied for free.** A clone at a tag with
   no `ace` on `PATH` already has the graph; nothing resolves at build time. The
   constraint dissolves rather than being negotiated with.
3. **The diff is the review surface.** A new dependency appears as a line in a
   PR instead of entering silently through an import.
4. **Byte-lockable.** A committed artifact can carry a golden vector; a
   computed-on-demand one cannot.

Reason 1 is also why the re-derive-and-compare guard below is not bureaucracy:
**without it the committed file is a *claim about* a derivation rather than the
derivation itself** — unfalsifiable again, with extra steps.

**The failure mode is the entire design:** a committed derivation that nobody
re-derives is the stale manifest it replaced, wearing the authority of a
checked-in file. So CI must re-derive and compare.

### The in-tree precedent — and a finding about it

`src/Core.TypeScript/ace/build-graph.json` (87,114 bytes) is the precedent, gated
by `build-graph-completeness` (`gate.yml:1542`). I read the guard before copying
it, and it does **not** do what the pattern needs:

- `audit-build-graph-completeness.ts:361` does
  `JSON.parse(readFileSync(GRAPH, "utf-8"))`. It **reads** the committed graph and
  checks three internal-consistency directions (target→leg, leg→job, job→target)
  against `.github/workflows/`. **It never re-derives from the source tree and
  never diffs.**
- So it enforces **completeness**, not **currency** — and those are different
  properties. A tree that grows a new source directory nobody added to the JSON
  stays internally consistent and passes all three directions.
- `gate.yml` runs the audit and its tests. Grepping the workflow for `derive`
  turns up no re-derive-and-compare step.

This is not a contradiction of the doctrine — `build-graph.json` is *DEFINED, not
CALCULATED* by an explicit maintainer decision (build-graph.ts:12, Aaron
2026-06-07), so a hand-authored row is legitimate there. But it means **the
currency guard the derived-dependency design depends on does not yet exist in
this repo, even though something that looks like it does.** Notably the machinery
is half-built already: there is a `build-graph:derive` verb and a
`derivationInputsTouched()` helper (build-graph.ts:1439) whose stated purpose is
deciding when skipping re-derivation is sound. Nothing calls it in CI.


### The guard is scaffolding, and its successor is named

Stated so nobody hardens a workaround into an invariant.

**Re-derive-and-compare is the MANUAL version of what DBSP does automatically.**
The check is needed because git *recomputes* derived state and never *maintains*
it. DBSP is precisely "maintain a view under insertion and retraction". Aaron
2026-08-24:

> *"DBSP is how i plan to replace git with a mono repo alternative based on our
> zetafs/db … content-based addressing, multi-foldered files, symlinks as first
> class, and merkle dags / dagfs … all this rounds up to zsets, gsets, dbsp —
> that's the deepest core and what the project was started on."*

Note what the replacement is **not**: git is *already* a content-addressed Merkle
DAG, so a better DAG is not the point. What git lacks is **incrementality over**
that DAG. The successor is a DAG whose derived views are maintained.

**REGISTER: this is a design claim, not a measured one — `unmetered`.** The
substrate is real (measured on `origin/main` 2026-08-24, case-insensitive, with a
zero-hit control term to prove the search discriminates: `DBSP` 1,639 files ·
`ZSet` 1,432 · `content-addressed` 549 · `merkle` 538 · `GSet` 352 · `symlink`
251, plus `src/Core.CSharp.Merkle`, `src/Core.Rust.Merkle`,
`experiments/zetafs-webdav`). But **nothing in the tree demonstrates
"drift becomes structurally impossible" end to end**, and that sentence is the
load-bearing one. What would demonstrate it: a derived view materialised in the
store, a retraction applied, and the view observed correct without any
recompute-and-compare step — with a golden vector over the result.

Also worth keeping honest per `numerology-vs-number-theory`: *git is a Merkle DAG
and Zeta is a Merkle DAG* is a **structural match worth stating**; it is not
evidence that the replacement works.

**The successor must keep BOTH guarantees, and they are different.** Maintenance
buys the drift property; it does **not** buy reproducibility. A maintained view
that is never materialised and addressable is not checkable by a third party, so
the falsifiability of reason 1 would be lost exactly while the drift problem was
solved. Do not trade the first away to get the second.

**Git's one-path-per-blob tree model is the other named limitation** ("multi-
foldered files, symlinks as first class"). A content-addressed DAG naturally lets
one blob be reachable from many paths; git's tree model does not. That is
load-bearing here rather than cosmetic: a shared tool required by many code units
is exactly a node with several parents — **and `pam-reattach` is that shape the
moment a second consumer appears.**

**And every lockfile in this tree is the same scaffolding.** `bun.lock`,
`flake.lock`, `build-graph.json` are all committed derivations with (or, as §5
shows, without) a re-derive check, existing for the same reason. If the DBSP
store lands they are one thing, and all removable. That is the scale of the
eventual payoff, and the reason not to invest heavily in bespoke per-artifact
guards now.

### The model to copy instead: `bun.lock`

`bun install --frozen-lockfile` **is** re-derive-and-compare, and it has caught
real drift here — PR #14303 left `main` red for hours when `workspaces` changed
without regenerating the lock. That is the right ergonomics: **the check is the
command the developer already runs, with one flag.** The dependency graph should
be `--frozen`-checkable the same way, not audited by a bespoke linter.

## 6. Why the repo split argues for doing this before, not after

Aaron says splits are planned. If dependencies are code-local edges, they
**travel with the code for free** when a directory becomes its own repo — the
graph re-roots and nothing is lost. If they stay in a repo-wide union, every
split requires someone to partition 26 brew rows by hand and guess which half
needs `agda`. The union has to be taken apart eventually; it is cheaper to never
build a bigger one.

## 7. What I could not settle

- **Substitution, not just resolution.** Aaron: *"we are trying to rewrite all
  our dependencies, even our OS eventually — this is the ultimate supply chain
  control."* That is a direction rather than this PR, but it sets an acceptance
  test on any model proposed here: **a dependency model that cannot express "we
  replaced this one with our own" is the wrong model.** Resolution alone is not
  enough; the graph needs a substitution edge.
- **Whether the four OS-native manifests should get ace realizers at all.**
  There is no `from-brew.ts`; brew/apt/brew-cask/windows are realized by shell
  loops while the 15 `from-*` mechanisms go through `ace-realize --all`
  (`macos.sh` step 6). Whether that is a deliberate boundary or just unfinished,
  I do not know, and the answer changes the design.
- **Where the per-row rationale goes.** `manifests/brew` carries substantial
  hand-written justification per row (the `pam-reattach` row added this round is
  ~25 lines of it). If the flat manifests become generated, that prose needs a
  home in the derived model or it is lost — and it is some of the most useful
  documentation in the setup tree.
- **Whether `build-graph.json`'s missing currency guard is a bug or a
  consequence of DEFINED-not-CALCULATED.** I did not settle it. It matters
  because the derived-dependency design cannot reuse that guard as-is.
- **Cost.** I have not measured what fraction of CI runner-time is spent
  installing tools a job does not use. That number is the actual argument for
  this work and it does not exist yet. Someone should measure it before anyone
  builds anything here.

## Pointers

- `tools/setup/manifests/README.md` — where a dependency goes today, measured.
- `docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-*` — ace as package-manager-of-package-managers,
  N-dimensional dependency space. The fourth dimension (code-unit) is the one this doc is about.
- `docs/backlog/P1/B-0854-*` — the install.sh -> ace migration trajectory; names `scratch` and `SQLSharp` as models.
- `src/Core.TypeScript/ace/deps.ts` — the graph that exists · `capability-manifest.ts` — the dual (authority, not need).
- `.claude/rules/clone-at-tag-stays-sufficient.md` — the constraint §5 is written against.
