# FriCAS and SageMath as toolchain dependencies — measured, per tool, per OS

**Status:** measurements complete; FriCAS landed; **SageMath NOT landed — awaiting sign-off on
one of three named acquisition mechanisms (§7).**
**Work item:** `081M29N1AX9087G0R001GSJD6G`.
**Measured:** 2026-09-11, on an Apple Silicon host (12 cores) and in `ubuntu:24.04` containers
under podman. Every number below is from a run whose command is quoted. Where a thing could
not be run, the row says so and does not substitute a plausible figure.

Aaron asked two questions, and they have different answers:

> *"Axiom/FriCAS — can we pull this in like lean4 and other formal analysis tools? if so lets
> route this now to all oses on our ace package manager / install.sh / ps1 and build on it."*
> *"yes i'd love to pull in sage as a dependency, i've used this a lot. can we do that with
> ace/install.sh/ps1?"*

**FriCAS: yes, on all three operating systems, natively, and it is landed in this PR.**
**SageMath: yes on macOS and Linux, no natively on Windows, and at a cost that needs a
decision rather than a default — 1 GB of downloads and 5.4 GB on disk, measured.**

---

## 1. The answer table

| Tool | OS | Mechanism | Version | Install time | Size added | Works? |
|---|---|---|---|---|---|---|
| **FriCAS** | macOS (arm64) | `manifests/brew` — bottled | 1.3.13 | **54 s** | **200 MB** | **YES**, smoke-tested |
| **FriCAS** | Linux amd64 | `manifests/apt` | 1.3.10 | **29 s** (emulated; upper bound) | **366 MB** | **YES**, smoke-tested |
| **FriCAS** | Linux arm64 | `manifests/apt` | 1.3.10 | 4 s | 410 MB | **NO — installs, cannot start** (§3) |
| **FriCAS** | Windows x86-64 | `manifests/from-zip`, sha256-pinned | 1.3.13 | not measured — **no Windows host** | 35.7 MB compressed | **not measured** (§4) |
| **FriCAS** | Windows arm64 | `manifests/from-zip`, sha256-pinned | 1.3.13 | not measured — **no Windows host** | 37.4 MB compressed | **not measured** (§4) |
| **FriCAS** | macOS (Intel) | `manifests/brew` — **source build**, no bottle | 1.3.13 | not measured — no Intel Mac | unknown | **not measured** |
| **FriCAS** | Linux amd64 | `manifests/from-autotools-tarball` — **the rejected alternative** | 1.3.13 | **455 s** (emulated; `-j12`) | **161 MB** | **YES**, smoke-tested |
| **SageMath** | Linux amd64 | conda-forge (**no mechanism exists yet**) | 10.9 | **142 s** | **5,410 MB** env + 6,721 MB cache | **YES**, smoke-tested |
| **SageMath** | Linux arm64 | conda-forge | 10.9 | not measured | ~1 GB download, 386 pkgs (solved) | solve succeeds |
| **SageMath** | macOS arm64 | conda-forge | 10.9 | not measured | ~1 GB download, 345 pkgs (solved) | solve succeeds |
| **SageMath** | macOS x86-64 | conda-forge | 10.9 | not measured | ~1 GB download, 328 pkgs (solved) | solve succeeds |
| **SageMath** | **Windows, native** | **none exists** | — | — | — | **NO — §5** |
| **SageMath** | Windows via WSL2 | the Linux answer, inside WSL | 10.9 | **not measured** (§6) | Linux figures + WSL distro | **not measured** |

**Commands behind the numbers.** macOS: `brew install fricas`, timed, with the Cellar delta
computed per newly-installed formula. Linux: `apt-get install -y --no-install-recommends
fricas` in `ubuntu:24.04`, with `df --output=used /` before and after. Sage: `micromamba create
-y -n sagetest -c conda-forge sage` in `mambaorg/micromamba`, with `du -sm` on the env and the
package cache.

---

## 2. FriCAS, and why Axiom itself is not the package

Aaron wrote "Axiom/FriCAS". They are not interchangeable, and the measurement settles which
one to depend on:

| | Ubuntu 24.04 universe | Homebrew | Windows | last release |
|---|---|---|---|---|
| `axiom` | 20170501-12build3 | absent | absent | 2017 |
| `fricas` | 1.3.10-1build3 | **1.3.13, bottled** | **1.3.13, vendor ZIP, x86-64 + arm64** | 2026-03 |

FriCAS is the maintained fork of Axiom; Axiom's own packaging is nine years stale on the one
platform that carries it at all. **The dependency is FriCAS.** The Axiom *design* — the thing
the work item actually needs — is fully present in FriCAS: `)show Ring`, the category
hierarchy, and the domain constructors are the same two-level system.

**Why it is a dependency and not a curiosity.** `081M29N1AX9087G0R001GSJD6G` records that
`IRing<Sedenion>` compiles and is not a ring, because 168 of 343 octonion triples refute
associativity. A type system that admits that is a type system in which a category's *laws*
are not carried by the type. FriCAS is the shipped system where they are — categories carry
laws, domains implement them, domain constructors build domains from domains. Having it
installed is the difference between reading about that design and running it.

---

## 3. THE FINDING: the Ubuntu arm64 FriCAS package installs and cannot start

Measured on a clean `ubuntu:24.04` arm64 container, twice:

```
INTERNAL-SIMPLE-FILE-ERROR: File error on
"/usr/lib/fricas/target/aarch64-unknown-linux-gnu/algebra/compress.daase": Cannot open
```

The cause is in the packaging, not in FriCAS. `fricas-databases` is a **hard `Depends`** of
`fricas` and is `Architecture: all`, and its arch-independent payload is installed at

```
/usr/lib/fricas/target/x86_64-pc-linux-gnu/algebra/
```

while the arm64 `fricas` wrapper script sets `FRICAS=/usr/lib/fricas/target/aarch64-unknown-linux-gnu`.
`dpkg -L fricas-databases` shows only the `x86_64-pc-linux-gnu` tree. So the package graph is
satisfied, 410 MB lands on disk, and nothing can start. This is an upstream Debian/Ubuntu
packaging defect and is not worked around here.

**A second, unrelated container artifact worth recording, because it will be mistaken for
this one.** The Ubuntu build uses GCL, and GCL calls `personality(ADDR_NO_RANDOMIZE)`, which
the default container seccomp profile blocks:

```
personality failure 38
```

That is the *container*, not the package — `--security-opt seccomp=unconfined` removes it, and
a GitHub Actions `ubuntu-24.04` runner is a VM, not a seccomp-confined container, so it does
not apply there. It *does* apply to `docker-ubuntu-install-sh-test` if that lane ever *runs*
FriCAS rather than merely installing it.

**Consequence for tiering, stated rather than hidden:** nothing in this tree invokes FriCAS
yet, so an arm64 runner spending 410 MB on an unusable install is wasted bytes and not a red
lane. The first lane that *does* invoke it must be pinned to amd64 or to macOS. `manifests/apt`
rows carry no `when=` clause, so this is documented in the row rather than gated; gating it
needs an architecture filter in `linux.sh`, which is a separate decision.

---

## 4. Windows: FriCAS does NOT need WSL, and that is a measured correction

The brief assumed Windows would need WSL or Cygwin for FriCAS, as it historically did.
Measured 2026-09-11, that is no longer true. Upstream publishes:

- `fricas-1.3.13-windows-x86-64.zip` — 35,723,884 bytes, published 2026-03-06
- `fricas-1.3.13-windows-arm64.zip` — 37,400,931 bytes, published 2026-07-09

Both contain `<top>/bin/FRICASsys.exe` and are self-contained. **So of the two systems asked
for, only SageMath needs WSL. FriCAS does not** — which is a materially better answer than
putting both behind WSL, and it is why the two tools are tiered differently.

**Mechanism: `manifests/from-zip`, not `manifests/windows`.** scoop *does* carry
`fricas` 1.3.13 — in the **Extras** bucket, and `tools/setup/install.ps1` deliberately
bootstraps Main alone (the same constraint recorded for `wabt`). Adding a third-party bucket to
reach a package we would then pin by package-id only is strictly worse than naming the
vendor's own asset and pinning its bytes: a scoop row lands in the **undeclared** half of
`docs/UNHASHED-DEPENDENCIES.md`, a `from-zip` row lands in the digest-covered denominator.

**The digests, and how many independent publications agree:**

| asset | sha256 | sources that agree |
|---|---|---|
| `…-windows-x86-64.zip` | `ad3deae8a403f03e8378e1a44324e65d61418bcbe669ac9652759ec0ae77156f` | upstream `sha256sum-1.3.13.txt`; GitHub release-API `assets[].digest`; ScoopInstaller/Extras `hash`; **and the bytes, hashed here** |
| `…-windows-arm64.zip` | `c742e05862fa90b2813bb67e75edb35bd8204f2f97449476173de9a86b4aacc8` | GitHub release-API digest; **and the bytes, hashed here** |

The arm64 asset's weaker coverage is stated rather than glossed: it was uploaded 2026-07-09,
four months after the `sha256sum-1.3.13.txt` file was cut, so that file does not list it, and
scoop's manifest has no arm64 architecture block.

**WHAT WAS NOT MEASURED: nothing ran on Windows.** There is no Windows host in this
environment. The row is correct by construction — the digest is verified before extraction, the
`bin=` path was read out of the actual archives with `unzip -Z1` — but *that FriCAS starts on
Windows* is a claim no run here supports. The cheapest way to close it is a one-job workflow on
`windows-2025` that sets `ZETA_INSTALL_FRICAS=1`, runs the from-zip realizer, and executes
`FRICASsys.exe` on a one-line expression. That is not added here (see §9).

**NAMED PARITY DRIFT (GOVERNANCE §24).** macOS and Linux get FriCAS automatically at
`tier=standard`; Windows gets it only when `ZETA_INSTALL_FRICAS=1`. This is forced by the
mechanism, not chosen: `from-zip` **refuses** a row without `opt-in=`, and its own advice for a
small artifact — `from-url` plus `from-shim` — cannot unpack an archive. 36 MB is not heavy;
the gate is a property of the only mechanism that can unzip. **This is DEBT.** Closing it needs
either a non-opt-in unpack mechanism or a Main-bucket scoop package, and both are separate
decisions.

---

## 5. SageMath: the Windows answer is "not natively, at all"

This was the constraint the brief flagged as needing verification rather than assumption.
Verified, three ways:

1. **conda-forge has no `win-64` build.** `micromamba create --platform win-64 --dry-run sage`
   fails to solve: `Could not solve for environment specs`. The other four platforms all solve
   — `linux-64` 387 packages, `linux-aarch64` 386, `osx-arm64` 345, `osx-64` 328, each ~1 GB.
2. **There is no Homebrew formula.** `formulae.brew.sh/api/formula/sage.json` and
   `sagemath.json` both return 404. (macOS Sage is therefore conda-forge too.)
3. **Upstream ships no Windows binary.** Native Windows support ended after Sage 9.3; the
   published route is WSL or conda.

**And the Linux package route is gone too, which the brief did not anticipate.** Querying
Launchpad directly:

| series | `sagemath` |
|---|---|
| Ubuntu 22.04 jammy | 9.5-4, universe |
| Ubuntu 24.04 noble | **absent** |
| Ubuntu 25.04 plucky | **absent** |
| Ubuntu questing | **absent** |
| Debian | 9.5-6 in bookworm/sid only |

So `manifests/apt` cannot acquire Sage on the runner OS this repo actually uses, and the
newest packaged Sage anywhere in the Debian family is 9.5 (2022) against upstream's 10.9.

**This is what makes the WSL answer narrower than it first looks.** `.github/workflows/wsl-install-sh-test.yml`
already exists and works — `Vampire/setup-wsl@d1da7f2c…` (v7.0.0), `windows-2025`,
Ubuntu-24.04, running `tools/setup/install.sh` inside real WSL2. Anything in `manifests/apt` is
therefore *already* acquired on Windows-via-WSL with no new machinery. **But Sage is not in
`manifests/apt` and cannot be**, because noble does not carry it. So "Windows via WSL" for Sage
does not reduce to the existing lane; it reduces to *"run the conda-forge mechanism, which does
not exist yet, inside WSL"*. The WSL leg is the easy half; the conda-forge mechanism is the
part that needs a decision.

**Measured cost of the conda-forge route** (`linux-64`, in a container, emulated x86-64):

```
SAGE_CONDA_INSTALL_SECONDS=142
SAGE_ENV_DISK_MB=5410
SAGE_PKGS_CACHE_MB=6721
```

387 packages, ~1 GB downloaded, **5.4 GB of environment and a further 6.6 GB of package cache
if it is not cleaned** — a ~12 GB transient peak. Smoke test passed: `factor(2^67-1)` returned
`193707721 * 761838257287` and `(x^2-1)` factored over `QQ[x]`.

---

## 6. What was NOT measured, and exactly what it would take

Stated as its own section because a missing measurement reported as a footnote reads like one
that passed.

| claim | status | what would close it |
|---|---|---|
| FriCAS starts on Windows x86-64 | **not measured** — no Windows host | one `windows-2025` job: `ZETA_INSTALL_FRICAS=1`, from-zip realizer, run `FRICASsys.exe` |
| FriCAS starts on Windows arm64 | **not measured** — no Windows arm64 host, and GitHub hosts none | a self-hosted arm64 Windows runner, or a maintainer's machine |
| FriCAS on an Intel Mac | **not measured** — no Intel Mac, and no x86-64 macOS bottle exists, so it source-builds | a `macos-13` job, or accept that the fleet has no Intel Macs |
| FriCAS source build on **arm64** | **not measured** — podman reused the cached `linux/amd64` image and said so (`image platform (linux/amd64) does not match the expected platform (linux/arm64)`), so the build below is the amd64 one run twice, not an arm64 datapoint | re-run with a pulled arm64 base image |
| `wsl --install` cost on a hosted runner | **not measured** | the existing WSL lane's own run logs already carry it; it is not re-derived here |
| SageMath inside WSL end to end | **not measured** | needs the conda mechanism of §7 first — there is nothing to run yet |

### The source build WAS measured, and it beat the estimate — and still loses

An early draft of this document asserted the source build "exceeds 20 minutes". **That was a
guess written while the run was still going, and it was wrong.** The run finished:

```
TARBALL_SHA256=dd4d5e06db0ba4a43a5bfb64e94f6c8d4b10e68ac65a77556891a6b24af148a2
NPROC=12 ARCH=amd64
FRICAS_SRC_BUILD_SECONDS=455
FRICAS_SRC_PREFIX_MB=161
```

`./configure --with-lisp=sbcl && make -j12 && make install` from the pinned tarball: **455 s**
under x86-64 emulation on a 12-core host (so a native runner is faster, by an unmeasured
factor), **161 MB** installed — which is *less than half* apt's 366 MB — and it produces
**1.3.13** rather than apt's 1.3.10, on any architecture, which would make the §3 arm64 defect
disappear. Smoke passed: `(2^64)::Integer` → `18446744073709551616`.

**And it is still the wrong default, for a reason the corrected number makes sharper rather
than weaker.** The trade is not "digest-pinned vs. not" — it is *which* rows become undeclared:

| route | FriCAS's own row | build deps it needs from apt | net undeclared | time |
|---|---|---|---|---|
| `manifests/apt` | +1 undeclared | none (transitive deps are not manifest rows) | **+1** | 4–29 s |
| `from-autotools-tarball` | +0, digest-covered | `sbcl`, `libgmp-dev`, `libx11-dev` — three new apt rows | **+3** | 455 s emulated |

So the source build **increases** the undeclared roster by two more than apt does, while costing
an order of magnitude more wall time on every Linux host, and CI install time is already the
heaviest cost this tree carries. The intuition that a digest-pinned source build is the
supply-chain-cleaner option is exactly backwards here, because the compiler and its libraries
have to come from somewhere and that somewhere is apt.

The pin is recorded so the option stays one edit away — it is the right answer the moment a
lane needs FriCAS **on arm64 Linux**:

```
https://github.com/fricas/fricas/releases/download/1.3.13/fricas-1.3.13-full.tar.bz2
sha256=dd4d5e06db0ba4a43a5bfb64e94f6c8d4b10e68ac65a77556891a6b24af148a2
```

(verified three ways: upstream's `sha256sum-1.3.13.txt`, the release API digest, and the bytes
as downloaded by the build run above.)

---

## 7. SageMath is NOT landed, and the three candidate mechanisms

No Sage installer ships in this PR. The reason is not the size on its own — it is that **every
route needs a mechanism this tree does not have**, and inventing one is a CI-graph decision
that needs sign-off rather than a guess (round-29 discipline).

| # | candidate | what it costs to build | digest story | Windows |
|---|---|---|---|---|
| **A** | a `from-conda` mechanism: pinned micromamba + a `conda-lock` lockfile | new realizer, new manifest, a `MECHANISMS` row in `unhashed-inventory.ts`, a bootstrap download to pin | **good** — `conda-lock` emits per-package sha256, so Sage would land digest-covered | via WSL only |
| **B** | a digest-pinned container image (`sagemath/sagemath@sha256:…`) invoked on demand | small — podman is already a declared dependency on all three OSes and `manifests/pinned-refs` already mirrors image digests | **good** — an image digest is a content digest | podman on Windows runs its Linux VM on WSL2, so this *is* the WSL answer, already wired |
| **C** | do not acquire it; keep Sage a maintainer-local tool | zero | n/a | n/a |

**My reading, offered as a recommendation and not a decision: B, then A if B proves too
coarse.** B costs almost nothing, is digest-pinned by construction, keeps 5.4 GB off every
laptop and runner until someone asks, and reuses the WSL2 path Windows already has through
podman. A is the better long-run answer if Sage needs to be *on PATH* rather than *callable*,
and it is also the answer that would let `sage` participate in the same tier/opt-in vocabulary
as everything else.

### Open questions — numbered, with the shape of the answer each needs

1. **Which of A / B / C for SageMath?** Expected answer: one letter. If A, it needs a
   follow-up sign-off on the micromamba bootstrap pin.
2. **Does anything actually need Sage on `PATH`, or is "callable" enough?** Expected answer:
   name a caller, or "callable is enough". This is what decides A vs B, and nothing in the tree
   currently calls Sage at all.
3. **Is a ~12 GB transient peak acceptable on a CI runner, and on which lanes?** Expected
   answer: a lane list, or "opt-in only, never in the gate".
4. **Is the Windows-arm64 FriCAS row wanted with no way to test it?** It is digest-pinned and
   correct by construction, and it is the only row here whose *runtime* nobody has observed.
   Expected answer: keep / drop / keep-behind-a-follow-up-test.
5. **Should the arm64 Linux FriCAS defect be carried upstream?** GOVERNANCE §23 says we open the
   PR rather than fork. Expected answer: yes-file-it / not-now. The bug is in the Debian
   `fricas` packaging (`fricas-databases` `Architecture: all` with an x86_64-only payload).

---

## 8. THE UNHASHED COUNT WENT UP BY TWO, AND HERE IS WHY

`docs/UNHASHED-DEPENDENCIES.md` says of its undeclared roster: *"This number must only fall."*
This PR moves it **169 → 171**, and digest-covered **1942 → 1945**. Reported rather than
smoothed:

- `+1` `apt fricas`, `+1` `brew fricas`. The `apt` and `brew` mechanisms have **no digest slot
  at all** — `unhashed-inventory.ts` hardcodes `coverage: "undeclared"` for them, so a row
  cannot opt in however carefully it is written. Any OS-native package added to this tree
  increments that number by construction.
- `+3` digest-covered: the two `from-zip` FriCAS rows land in the denominator, where the
  Windows acquisition was deliberately put for exactly this reason.

**The alternative was measured and rejected, and the measurement inverted the intuition.**
Acquiring FriCAS by `from-autotools-tarball` puts its own row in the digest-covered denominator
— but it needs `sbcl`, `libgmp-dev` and `libx11-dev` from apt to build, which is **three** new
undeclared rows against apt's one, on top of a 455 s build per host against 4–29 s (§6). The
route that looks supply-chain-cleaner is the one that adds more unhashed dependencies, because
the compiler has to come from somewhere.

### A separate finding, NOT fixed here: the roster over-counts `mise` by sixteen

While regenerating the inventory, `scanMise` was read and it hardcodes:

```ts
coverage: "undeclared",
blocker: "mise pins a VERSION; a per-tool digest needs a committed mise.lock, which this tree
          does not have yet. …"
```

**`mise.lock` and `mise.full.lock` are committed** — landed 2026-09-10 in
`4062a7b8c9` / #17231, one day before the inventory page was written. The sibling `scanNuget`
in the same file already does the right thing (`coverage: locks.length > 0 ? "digest" :
"undeclared"`); `scanMise` was not updated with it.

Measured against the committed lockfiles:

| file | tools | carry a `checksum` | do not |
|---|---|---|---|
| `mise.lock` | 18 | **10** | 8 — `1password-cli`, `dotnet`, `npm:markdownlint-cli2`, `pipx:{mypy,ruff,semgrep,yamllint}`, `rust` |
| `mise.full.lock` | 7 | **6** | 1 — `rust` |

So **16 of the 25 `mise` rows counted as undeclared are digest-covered in the committed
lockfiles**, and the blocker sentence is false about this tree. Correcting `scanMise` the way
`scanNuget` already works would move the roster to roughly **155**, i.e. net **−14** including
this PR's `+2`.

**It is deliberately not fixed in this PR.** Moving the supply-chain headline number by −16 is
a claim about the coverage of sixteen dependencies; asserting it inside a change whose subject
is "add two computer-algebra systems" buries a security-posture change where no reviewer is
looking for it. It wants its own PR, its own diff, and Mateo's eyes. Filed here with the exact
numbers so that PR is a small one.

---

## 9. Tier decisions, and the reason for each

| tool | tier | reason |
|---|---|---|
| **FriCAS**, macOS + Linux | **`tier=standard`** in `manifests/{brew,apt}` | 200 MB / 366 MB and a Lisp runtime, alongside `agda` (+242 MB), `opam`, `r-base`, `tectonic`, all already `tier=standard`. A slim host exists to run `dotnet build`; it has no use for a CAS. Untagged would mean `tier=slim`, i.e. everywhere. |
| **FriCAS**, Windows | **`tier=standard` + `opt-in=ZETA_INSTALL_FRICAS`** | the tier is the same judgement; the opt-in is imposed by `from-zip`, not chosen (§4). |
| **FriCAS** in `.mise.toml` | **no** | mise manages *language runtimes*; FriCAS is a system package, exactly like `agda` and `z3`. |
| **SageMath** | **nothing lands** | 1 GB down, 5.4 GB resident, ~12 GB peak. That is not a default-tier number under any reading, and it is not a `tier=full` number either until a mechanism exists to carry it (§7). |

**A precedent that was NOT used.** The brief offered `src/Core.Lean4.Cslib`'s UNCOVERED roster
entry — *"deliberately off the main gate because the lake cache is multi-GB"* — as the likely
tier for Sage. It is deliberately not cited: that precedent is being actively revisited (Aaron:
*"we need this cslib, all AI labs are contributing for AI research"*). Sage is tiered on its own
measured 5.4 GB, and on the absence of a mechanism, not on an analogy to a decision that is
itself in motion.

**No workflow is added.** `lean-proof.yml` is the precedent for keeping a heavy formal tool off
the main gate — but it exists because there are Lean proofs to check. **Nothing in this tree
invokes FriCAS yet.** A workflow that runs a CAS over no inputs is a green check that cannot
fail, which is the one artifact class this repo treats as worse than no check at all. The
workflow lands with the first caller. What §6 asks for instead is a *smoke* job — proof the
Windows acquisition works — and that is a different, smaller thing, listed there as an open
item rather than guessed at here.

---

## 10. Beacon — the human anchors

- **James H. Davenport, Richard D. Jenks, Barry M. Trager, Stephen M. Watt** — Scratchpad II /
  **Axiom**, and the two-level *category/domain* design this dependency exists for. Jenks &
  Sutor, *Axiom: The Scientific Computation System* (Springer, 1992) is the canonical statement:
  categories specify operations and their **laws**, domains implement them, and domain
  *constructors* are functions from domains to domains.
- **Waldek Hebisch** and the FriCAS maintainers — the fork that kept the system alive and
  releasing (1.3.13, 2026-03-06), including the Windows builds §4 depends on.
- **William Stein** — SageMath, and its stated goal of a free alternative to Magma/Maple/
  Mathematica/MATLAB by *integrating* existing systems (PARI, Singular, GAP, Maxima) rather
  than reimplementing them. That integration is precisely why its dependency closure is 387
  packages and 5.4 GB; the cost measured in §5 is the architecture, not bloat.

## Pointers

- `tools/setup/manifests/{apt,brew,from-zip}` — the three rows this PR lands.
- `src/Core.TypeScript/ci/manifest-symmetry.test.ts` — the `fricas` Windows disposition, and
  the test that refuses to let that disposition be prose.
- `docs/UNHASHED-DEPENDENCIES.md` — regenerated; §8 explains the delta.
- `.github/workflows/wsl-install-sh-test.yml` — the WSL2 lane that already exists.
- `docs/INSTALLED.md` — the FriCAS row.
