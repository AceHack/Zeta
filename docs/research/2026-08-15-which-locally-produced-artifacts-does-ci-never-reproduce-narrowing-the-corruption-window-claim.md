# Which locally-produced artifacts does CI never reproduce? Narrowing the corruption-window claim

**Date:** 2026-08-15 · **Author:** shadow (Claude Opus 5) · **Register:** Mirror→Beacon
**Follows from:** PR #10795 / `docs/research/2026-08-15-139-and-134-are-signal-deaths-147-of-them-in-one-week-on-one-machine.md`
**Method is re-runnable:** every command in §7.

***

## 0. The answer

PR #10795 established a memory-integrity fault beneath every runtime on `AceHacks-Mac-Studio`
(147 crash reports, 2026-08-08 → 2026-08-15, cross-vendor, 38 inside garbage collectors, two
`SIGKILL (Code Signature Invalid)`) and drew the consequence:

> "Treat locally-produced byte-locks from 08-08 onward as suspect."

Audited. **The claim overstates its own scope by roughly two orders of magnitude, and the part
that survives is a different set than the one the brief expected.**

| | count | how it was narrowed |
| --- | --- | --- |
| distinct paths touched on `origin/main` in the window | **10,299** | `git log --since=2026-08-08 --until=2026-08-16 --name-only` |
| of those, written by CI on Linux runners, not locally | **8,519** | the archive/telemetry path set, §2 |
| remainder, locally produced | **1,780** | mostly prose, memory, work-items and ordinary source |
| of those, verification-artifact class | **38** | §3 |
| **not reproduced by any CI job** — the exposure set | **8** | §5 |
| still exposed after this change | **4**, all named, all low | §5 |

Two of the three "known members of the exposure set" in the brief that sent me are **not in the
window at all**, and the third turns out to be verified by measurement. The genuine finding is
somewhere the brief did not point: **six generated bit-layout source files, two of which no CI
job on earth executes.**

***

## 1. The test, stated before it is applied

The brief's premise, which I was asked to verify rather than accept:

> A corrupted artifact usually fails loudly. If a golden vector is generated locally with a bad
> value and committed, CI regenerates and compares — and CI is clean, so it would fail.

**Half true, and the false half matters.** Three dispositions, not two:

| disposition | what CI does | corruption is |
| --- | --- | --- |
| **REGENERATED** | runs the producer and byte-compares against the committed file | detected, and it fails the job |
| **CROSS-CHECKED** | does not regenerate, but ≥2 *independently written* implementations must agree with it | detected, if the corruption is exercised |
| **REFERENCE-ONLY** | reads the committed file as the expected value; nothing else produces it | **undetectable by construction** — the file is compared to itself |

The exposure set is the third row. And there is a fourth disposition that the two-way framing
hides, which the byte-lock lane occupies:

> **REPORTED-BUT-NOT-GATED.** `bytelock.yml` compares nine substrates and **exits 0 on
> divergence** — a deliberate design choice, documented in the workflow header ("a divergence is
> a finding you want delivered, a broken instrument is a finding you want STOPPED"). So a
> corrupted committed `.wasm` that still loads yields a drift report and a green job. Detection
> without a gate is not the same as "fails loudly", and the brief's premise does not hold there.

***

## 2. Provenance: 83% of the window was never on the suspect machine

The single largest narrowing is not verification at all — it is **who wrote the bytes.** These
paths are written by GitHub Actions on `ubuntu-24.04` and arrive as squash-merged archive PRs:

| path | files in window | writer |
| --- | --- | --- |
| `docs/github/prs/shards/**` | 6,544 | `pr-archive-on-merge.yml` (`git add docs/history/pr-reviews/ docs/github/prs/shards/`, line 173) |
| `docs/history/**` | 633 | same workflow |
| `data/tick-shards/**` | 586 | heartbeat/telemetry flush |
| `docs/observe-events/**` | 382 | `github-actions[bot]` / `society[bot]`, 300 of 300 commits |
| `docs/drift-events/**` | 206 | `github-actions[bot]`, 205 of 205 commits |
| `workitems/events/**`, `docs/hygiene-history/**`, `docs/budget-history/**` | 168 | cadence workflows |
| **total** | **8,519** | |

Each archive commit's subject carries the run id that produced it (`archive(pr-reviews): PR
#10779 on merge -- run 31889772945`), so the provenance is checkable per commit rather than
assumed. §1 of PR #10795 measured CI clean across 836 runs; that clean bill applies directly to
these 8,519.

**Correction to my own first instinct:** committer name is *not* the provenance signal here.
8,844 of the window's file-touches carry committer `GitHub` (squash-merge) and 8,970 carry author
`Aaron Stainback`, because agents commit under his identity. Path plus the writing workflow is
the signal; the name is not.

***

## 3. The artifact class, enumerated

Of the 1,780 locally-produced paths, the verification-artifact class is **38 files** — committed
binaries, generated sources, golden-vector seeds, oracle outputs, lockfiles and registries.
The full mechanical filter is in §7; here is what it found, with what CI does to each.

### 3a. REGENERATED — a CI step runs the producer and compares

| artifact | the step |
| --- | --- |
| `vocab/Vocab.Generated.fs` | `vocab-hygiene.yml:35` — `bun vocab/gen/Reify.ts --check` |
| `vocab/MASTER-INDEX.md`, `vocab/words/INDEX.md` | `vocab-hygiene.yml:31,33` |
| `memory/MEMORY.md` | `memory-index-drift.yml:74` — `reindex-memory-md.ts --check` |
| backlog index | `backlog-index-integrity.yml:111` — `generate-index.ts --check` |
| `tests/cross-verification/zeta-id/mumps-output.json` | `gate.yml:1558` step *Execute MUMPS zeta-id packer* — `bun run-mumps.ts` |
| `bun.lock` | `gate.yml:1539` and 8 other workflows — `bun install --frozen-lockfile` |
| generated law-property tests | `gate.yml:1587` — `codegen-law-drift.test.ts` |
| `dla-canonical-go.wasm` | `bytelock.yml` — `node build-substrates.mjs --only=Go` |
| `src/Core.TypeScript/ace/build-graph.json` | `gate.yml:1542` — `bun test src/Core.TypeScript/ace/` → the DRIFT GATE in `build-graph.test.ts:392` |

Verified locally, not inferred: `Reify.ts --check`, `GramsView.ts --check`, `MasterIndex.ts
--check` and `generate-index.ts --check` all exit 0 on `origin/main` @ `e4481f19a`; `bun install
--frozen-lockfile` succeeds.

> **This class caught *this* change, which is the best evidence available that it works.** The
> first CI run on this branch went red in `cross-verify`, at the ace suite, before ever reaching
> the step §6 adds. Cause: `build-graph.json` carries a derived `count: 286` of the files under
> `tests/cross-verification/`, and the two files §6 adds make it 288. Confirmed as *mine* rather
> than pre-existing by running the same suite against a pristine `origin/main` checkout — 556
> pass, 0 fail — and against this branch — 2 fail, both the drift gate. `bun … build-graph.ts
> derive --write` produced a one-line diff and the suite returned to 556/0. A generator that
> re-derives and byte-compares noticed a two-file change in a directory nobody was thinking
> about. That is precisely what the eight artifacts in §5 had nothing of.

> **Side observation, measured and not acted on.** `reindex-memory-md.ts --check` exits **2** on
> `origin/main` @ `e4481f19a` — "Entries: 1629. Index STALE." The workflow treats that as a
> failure, but is path-triggered on `memory/**` only, so a stale index can sit on `main` between
> memory-touching commits. Not this audit's subject; recorded because I ran the command and saw
> it, and an unreported red is the failure class this fleet has been clearing all week.

### 3b. CROSS-CHECKED — not regenerated, but ≥2 independent producers must agree

**The ZetaId lane.** `compare.ts` pins all seven committed oracle outputs to `vectors.yaml`
(`gate.yml:1553`, step *Cross-language byte-lock + golden-vector oracles* → `cross-verify-all.ts`
→ `compare.ts`; the `cross-verify` job is in the blocking floor). Of the seven oracles,
**five are independently re-executed in CI**:

| oracle | re-executed by |
| --- | --- |
| TypeScript | bare `bun test` (`gate.yml:1700`) |
| F# · C# | `dotnet test Zeta.sln -c Release` (`gate.yml:436`) on **five** OS legs |
| Python | `uv run … pytest src/Core.Python/tests` (`gate.yml:1750`) — `test_cross_verify_zeta_id` |
| MUMPS | `bun run-mumps.ts` (`gate.yml:1558`) |
| **Go** | **nowhere** — `gate.yml:1763` runs `go test ./algebra/`; `src/Core.Go/cross_verify_test.go` is `package main` at the module root and is not in that path |
| **Rust** | **nowhere** — `gate.yml:1760` runs `cargo test --manifest-path src/Core.Rust.Observe/Cargo.toml`, one of **36** `Core.Rust.*` crates |

`cross-verify-all.ts` says so in its own header, which is the honest place for it to be said:

> "It does NOT regenerate the F#/C#/Rust outputs (no dotnet/rust toolchain needed) — it asserts
> the committed outputs."

**Other cross-checked members.** `src/Core.TypeScript/consensus/golden-vectors.json` is a shared
seed replayed by four independently-written implementations (TS test, `src/Core.Rust.Consensus`,
`src/Core/Consensus.fs`, the C# oracle), two of which execute in CI.
`tests/Tests.FSharp/QuantumArith.ByteLock.Tests.fs` carries inline expected constants that
`dotnet test` recomputes from the F# implementation on Linux — with the honest caveat that its
`Assert.InRange(±1e-12)` tolerance is ~10,000 ULP wide at these magnitudes, so it constrains a
wrong *decimal digit* and not a wrong low mantissa bit.

### 3c. The `.wasm` set — discharged by measurement, not by argument

Seventeen committed binaries live under `src/wasm-dla/`. **Sixteen of them were last written
2026-08-01 — seven days before the window opens.** Only `dla-canonical-zig.wasm` was rewritten
in the window (2026-08-15, PR #10757).

And that one was checked, in CI, on Linux, after it landed. Run **31886039431**:

```
Summary: 9 PASS, 0 FAIL, 0 TOOLING-ABSENT, 0 MALFORMED, 0 SKIP
Byte-lock AGREED — 9 of 9 substrate(s) executed and produced identical trajectories.
…
All 7 fault-injection negative controls PASS.
```

Nine independently-compiled substrates produced byte-identical trajectories over four seeds, and
the seven negative controls proved the instrument can detect corruption, a liveness shortfall, an
absent toolchain and a malformed artefact. A corrupted `.wasm` would have to reproduce eight
other toolchains exactly. **The wasm exposure in this window is empty, and it is empty by
measurement.**

The standing hazard remains and is named above in §1: divergence exits 0. That is a deliberate,
argued choice, not an oversight, and it is out of scope to relitigate here — but it means "the
byte-lock is green" and "the byte-lock agreed" are different statements, and only the log
distinguishes them.

***

## 4. Three corrections to the brief that sent me

Flagged explicitly, as asked.

**1. The four IR primitives are not in the window.** `lcg32_glibc`,
`lcg32_numerical_recipes`, `lcg64_mmix` and `murmur3_32_tail` were briefed as known members of
the exposure set. Their directories were last touched **2026-06-21** — 48 days before the window
opens (`git log --since=2026-08-08 … -- tests/cross-verification/<p>/` returns 0 commits for each;
`git log -1` returns `64933769d 2026-06-21`). They are a real **structural** exposure — an
artifact that is its own only reference — and they are *not* a **corruption-window** exposure.
Those are two different sets and the brief conflated them. The sibling agent's files were not
touched, per the brief.

**2. `db/shapes/golden/` is not in the window either.** All 42 rendered `.svg`/`.html` goldens
were last written **2026-07-02** (`be2d713c8`). What the window touched under `db/shapes/` is
four hand-written `.lines` cartridge specs — text, not renders.

**3. Five of the six `.wasm` were already outside the window**, per §3c, and the sixth is
verified. The brief's "one is now CI-built, five remain committed binaries" is accurate about the
*build* topology and inaccurate about the *exposure*: being a committed binary is not the same as
being a committed binary that changed while the machine was faulting.

**And a correction to the source finding's own consequence.** "Locally-produced byte-locks from
08-08 onward are suspect" reads as a claim about byte-locks. Byte-locks are the *best-covered*
class in the repo — they are redundant by construction, which is the entire point of an N-oracle
treaty. The exposed class is the one with **no redundancy**: generated source, emitted by one
generator, consumed by one compiler, verified by nobody.

***

## 5. The exposure set

Eight files. What each is, why nothing reproduced it, and what I did.

| # | artifact | why exposed | disposition |
| --- | --- | --- | --- |
| 1 | `src/Core.Go/zeta_id/zeta_id.gen.go` | Go is re-executed nowhere in CI; its stale committed `go-output.json` still matched `vectors.yaml`, so a wrong constant here was green everywhere | **closed** — §6 gate; and re-derived byte-identical from the YAML today |
| 2 | `src/Core.Rust.ZetaId/src/bit_layout.gen.rs` | same, for Rust | **closed** — §6 |
| 3 | `src/Core.CSharp.ZetaId/GeneratedBitLayout.cs` | no YAML↔gen check existed at all | **closed** — §6 |
| 4 | `src/Core.FSharp.ZetaId/GeneratedBitLayout.fs` | same | **closed** — §6 |
| 5 | `src/Core.TypeScript/zeta-id/zeta-id.gen.ts` | same | **closed** — §6 |
| 6 | `src/Core.Python/src/zeta/zeta_id_gen.py` | same | **closed** — §6 |
| 7 | `src/Core.TypeScript/complexity/complexity-registry.gen.ts` + `src/Core/ComplexityRegistry.fs` | no CI job regenerates them from `registry/complexity-registry.yaml` | **verified today**, no gate added — §5b |
| 8 | `src/Core.TypeScript/identity/generated-registry.ts` + `src/Core/IdentityRegistry.fs` | regenerated only by `bun run preflight`, which is a *local* hook; `grep -rn preflight .github/workflows/` finds no invocation | **verified today**, no gate added — §5b |

The hole at 1–6 was not discovered by me. It was **already written down**, in
`tests/cross-verification/zeta-id/README.md`, by the audit that produced that file:

> "`docs/zeta-id-v1-layout.yaml` — the source of truth; `zeta-id-generator.ts` regenerates six
> `.gen` files from it. **There is no CI gate verifying the `.gen` files match the YAML**, so an
> edit without regeneration fails nowhere until a codec stops compiling."

What this audit adds is *why it is sharper than it reads*: for Go and Rust the phrase "until a
codec stops compiling" is optimistic, because those codecs are never compiled-and-run by CI at
all. A wrong constant in `bit_layout.gen.rs` produces no compile error, no test failure, and no
oracle disagreement, because the oracle it would disagree with is a JSON file committed beside it.

### 5a. Why the window made this the sharp one

`cabe946d8` (2026-08-11 07:57 EDT, Aaron, **pushed directly to `main`**, no PR) is the largest
artifact-bearing commit in the window: it rewrote `docs/zeta-id-v1-layout.yaml`, **all six**
generated layout files, **all seven** oracle output JSONs and `vectors.yaml`, in one commit,
during the window, on the machine.

Two things to say about it, one reassuring and one not.

**The reassuring one, checked rather than assumed.** `push: main` triggers `gate.yml`, so the
full gate did run on it — run **31488980802**, 30 jobs, all green, including `cross-verify`,
`full-verify (7-lang oracle + cost + proofs)` and `build-and-test` on **five** OS legs
(ubuntu-24.04, ubuntu-24.04-arm, macos-26, windows-2025, windows-11-arm). The F# and C# codecs
were rebuilt from those generated constants on Linux and Windows and produced the pinned hex.

**The one that is not.** On 2026-08-11 `compare.ts` **did not open `vectors.yaml`**. Per the same
README, it compared the six output JSONs *against each other* with TypeScript as reference — so
"a fully stale but mutually consistent set of outputs passed cleanly." The pinning landed three
days later in PR #10614 (2026-08-14). So the gate that ran on the window's sharpest artifact
commit was **weaker than the gate that exists now**, in exactly the dimension that matters here.

That is retroactively closed by measurement rather than by argument: `bun compare.ts` on current
`origin/main` reports **"All implementations agree on 16 vectors (pinned to vectors.yaml)"**,
7 of 7, 16 of 16.

### 5b. What I verified by re-derivation, today, and its honest limit

Every generated artifact in the exposure set was re-derived from its source and byte-compared:

| generator | result |
| --- | --- |
| `bun src/Core.TypeScript/zeta-id/zeta-id-generator.ts` | 5 of 6 lanes **byte-identical**; the 6th differs by one character |
| `bun tools/codegen/generate-identity-registry.ts` | **byte-identical**, both lanes |
| `bun src/Core.TypeScript/complexity/complexity-generator.ts` | **byte-identical**, both lanes |

The single difference was `NewType("Bits", int)` → `NewType('Bits', int)` in
`zeta_id_gen.py`. Mechanism found rather than guessed: `zeta-id-generator.ts:228-230` runs
`src/Core.Python/.venv/bin/ruff format` on the Python output and skips it when the venv is
absent, which it is in a fresh clone. Quote style, from a missing formatter. Not content.

**The limit, stated plainly.** I ran those re-derivations on the suspect machine. A machine that
does not reproduce its own memory is a poor place to check whether memory was reproduced. Two
things bound how much that costs:

- Every one of the 147 observed manifestations is a **detected** integrity failure — 145 process
  deaths and 2 code-signature kills. The fault's observed signature is *loud*. There is not one
  recorded instance in that population of a silent wrong answer, and the SIGKILLs are the OS
  catching the bad page rather than passing it on. That is evidence about the failure mode, not
  proof that a silent flip cannot happen.
- The §6 gate moves the same check to a Linux runner, where §1 of PR #10795 says the population
  of signal deaths is zero across 836 runs. **The local result is the finding; the CI step is the
  falsifier.** That distinction is the whole of `toy-is-free-metered-must-be-earned` applied to
  my own work.

### 5c. Residual, named rather than closed

Four things stay open. Each is named because a partial audit reported as complete is the defect
class this fleet has been clearing all week.

1. **`go-output.json` and `rust-output.json` are still never re-derived.** Pinning to
   `vectors.yaml` makes silent *corruption* impossible (a corrupted output no longer matches the
   vectors) but leaves *staleness* possible — the committed output can be right while the source
   that would produce it has drifted. §6 closes the drift for the generated constants; the
   codecs' own logic is still unexecuted in CI. Filed.
2. **`complexity-registry.gen.ts` is consumed by nothing.** `grep -rn complexity-registry.gen src
   tests tools` finds only the generator that writes it. A generated file nobody imports is
   `unmetered` by definition; the F# sibling `src/Core/ComplexityRegistry.fs` *is* compiled
   (`Core.fsproj:456`) and exercised by `Ben.Tests.fs` / `MagneticPorts.Tests.fs`.
3. **`package-lock.json`** (locally written 2026-08-10) is referenced by no workflow except a
   CodeQL path filter; no `npm ci` or `npm install` appears in any of the 65 workflows. It is
   nonetheless **self-verifying**: 376 of 376 package entries carry an SRI `integrity` hash that
   npm checks at install. Exposed by the audit's definition, harmless in practice.
4. **`registry/*.yaml|json`** (9 files, all touched in the window) are hand-authored declarations
   rather than derived artifacts, so "regenerate and compare" does not apply. Two are checked
   against reality by CI (`unexecuted-test-files.json` via `hygiene/unexecuted-test-files.ts`,
   `uncompensatable-floor.yaml` as the blocking floor); the rest are read as given.

***

## 6. The remediation

One new check, wired into a **blocking** job, with a falsifier.

`tests/cross-verification/zeta-id/gen-layout-drift.ts` compares the offset/width constants
declared by all six generated lanes against `docs/zeta-id-v1-layout.yaml`, and
`gate.yml` runs it in `cross-verify` — the job `compare.ts` and `run-mumps.ts` already live in,
which is in the blocking floor. `test (TS suite)` was the wrong home: `gate.yml:1628` says it
"RUNS, DOES NOT BLOCK", deliberately.

**Constants, not a byte diff of the regenerated file.** Regenerating in CI would need prettier,
gofmt, cargo fmt and ruff on the runner, and then a formatter bump fails the check for a reason
that is not drift — which §5b already caught happening. The offsets and widths are the
load-bearing content, so those are what is compared: formatter-immune, and still red on any
wrong number.

**Anti-vacuity, because this is the document where that matters.** A regex that matches nothing
returns an empty set, and an empty set agrees with every file — the same shape as the `grep -q`
that passed while the prover segfaulted, and as the byte-lock that reported "1 of 8 executed".
So each lane must yield **exactly 2 × 9 constants**; short or empty is a hard failure whose
message says the check *did not run*, never that it passed.

**Watched failing.** 13 tests in `gen-layout-drift.test.ts`, each mutating one thing against a
`mkdtemp` copy — a wrong Go constant, a wrong Rust constant, a layout edit with no regeneration
(all six lanes red at once), an emptied lane, a lane short by exactly one constant, a deleted
lane, a zero-field layout, a deleted layout. Each mutant asserts the mutation actually landed
before asserting the finding, because a `.replace()` that silently no-ops is how a mutation test
becomes vacuous. End-to-end through the CLI on the real tree: wrong Go constant → **exit 1**
naming `'personaoffset' = 52, docs/zeta-id-v1-layout.yaml says 51`; restored → **exit 0**.

***

## 7. Reproduce it

```bash
# The window and its shape
git log --since=2026-08-08 --until=2026-08-16 --oneline origin/main | wc -l          # 1443
git log --since=2026-08-08 --until=2026-08-16 --name-only --format='' origin/main \
  | sort -u > /tmp/files-all.txt; wc -l /tmp/files-all.txt                            # 10299

# Provenance split (§2)
grep -cE '^(docs/github/|docs/history/|docs/observe-events/|docs/drift-events/|data/tick-shards/|docs/hygiene-history/|docs/budget-history/|workitems/events/)' /tmp/files-all.txt   # 8519

# Binary files touched in the window (§3c)
git log --since=2026-08-08 --until=2026-08-16 --numstat --format='' origin/main \
  | awk -F'\t' '$1=="-" && $2=="-" {print $3}' | sort -u

# Last write of each committed wasm — 16 of 17 predate the window
for f in $(git ls-tree -r origin/main --name-only src/wasm-dla | grep -E '\.(wasm|o|bc|luac)$'); do
  echo "$(git log -1 --format='%ad' --date=short origin/main -- "$f")  $f"; done | sort

# The four IR primitives are outside the window (§4.1)
for d in lcg32_glibc lcg32_numerical_recipes lcg64_mmix murmur3_32_tail; do
  echo "$d $(git log --since=2026-08-08 --until=2026-08-16 --oneline origin/main -- tests/cross-verification/$d/ | wc -l) $(git log -1 --format=%ad --date=short origin/main -- tests/cross-verification/$d/)"; done

# Who re-executes what (§3b) — read the steps, do not infer them
grep -n 'cargo test\|go test\|pytest\|dotnet test\|run-mumps' .github/workflows/gate.yml
git ls-tree -r origin/main --name-only | grep -c 'Core.Rust.*/Cargo.toml'             # 36 crates, 1 tested

# Re-derive every generated artifact and diff (§5b)
bun src/Core.TypeScript/zeta-id/zeta-id-generator.ts && git diff --stat
bun tools/codegen/generate-identity-registry.ts        && git diff --stat
bun src/Core.TypeScript/complexity/complexity-generator.ts && git diff --stat

# The new gate, and proof it discriminates (§6)
bun tests/cross-verification/zeta-id/gen-layout-drift.ts; echo $?                      # 0
bun test tests/cross-verification/zeta-id/gen-layout-drift.test.ts                     # 13 pass
perl -pi -e 's/PersonaOffset(\s+)Bits = 51/PersonaOffset$1Bits = 52/' src/Core.Go/zeta_id/zeta_id.gen.go
bun tests/cross-verification/zeta-id/gen-layout-drift.ts; echo $?                      # 1
git checkout -- src/Core.Go/zeta_id/zeta_id.gen.go
```

***

## 8. What I examined, and what I did not

No silent caps.

**Examined.** All 1,443 commits and all 10,299 touched paths in the window, by path and by
`--numstat` binary detection. The 38-file artifact class in full. All 65 workflows, grepped for
regeneration/diff patterns (`--check`, `--write`, `git diff --exit-code`, `cmp`, `diff -u`) and
for every test-runner invocation. `cross-verify-all.ts`, `compare.ts`, `run-bytelock-ci.mjs`,
`build-substrates.mjs`, `zeta-id-generator.ts`, `complexity-generator.ts`,
`generate-identity-registry.ts`, `Reify.ts` read directly. The `bytelock` run log for
31886039431 and the `gate` job list for 31488980802, read from the API rather than assumed.

**Not examined, deliberately.**

- **The 8,519 CI-produced files** were excluded by provenance (§2), not opened individually.
  If the pr-archive workflow's *inputs* were locally corrupted the outputs would inherit it — but
  those inputs are PR bodies and review text, not verification artifacts.
- **The four IR primitives and `db/shapes/golden/`** — out of window (§4). Cited as exemplars of
  the structural shape, not touched, per the brief.
- **The ~230 golden-vector files outside the window.** The structural question "which of the
  repo's *entire* golden-vector population is reference-only?" is a bigger and different audit.
  The 36-crate / 1-tested Rust ratio found in §3b is the thread to pull, and it is filed rather
  than followed here.
- **The mutation-finding ledgers under `db/`** (5 files) — append-only records of findings, not
  verification references.
- **`dotnet build -c Release`** was not run: this change touches no F#, C# or `.fsproj`. Stated
  rather than skipped silently, since the brief asked for it conditionally.

**Runs that failed and were retried.** One: a per-file `head | grep` loop over 3,706 files hit
my own 2-minute tool timeout (SIGTERM 143 — my cap, not the machine) and was replaced with a
single `xargs -0 grep -l` pass. No `dotnet` or `bun` signal death occurred during this audit.

***

## 9. Why this is a discipline, not a chore

- **§7 DST.** An artifact nothing can re-derive has no replay. It is not deterministic *or*
  nondeterministic; it is unmeasured, which is a third thing and the honest name for it.
- **`toy-is-free-metered-must-be-earned`.** Six generated files were being read as verified
  because they sat inside a lane whose *other* files are verified. Adjacency is not a falsifier.
  They were `unmetered`; §6 is what buys them the promotion.
- **`no-binary-in-proof-lineage`.** The rule's worry is a byte you cannot read in a diff. This
  audit found the sharper sibling: a byte you *can* read in a diff and that **nothing ever reads
  back.** `zeta_id.gen.go` is plain text, fully diffable, and until §6 no process on any machine
  compared it to anything.
- **`numerology-vs-number-theory`.** "147 crashes, therefore local byte-locks are suspect" is a
  count reasoning about a population it has not partitioned. The count is real; the inference
  needed the structure — which artifacts, produced when, reproduced by what. 8 of 10,299, and
  the interesting ones were not byte-locks.

***

## 10. Open

1. **`go-output.json` / `rust-output.json` are never re-derived** — the Go and Rust ZetaId
   codecs execute in no CI job. Adding them means a Go toolchain and a `cargo test` for a second
   crate in `cross-verify`; both are cheap and neither is done here.
2. **35 of 36 `Core.Rust.*` crates run no tests in CI**, including ~20 `golden_vectors.rs` suites.
   Found while answering a different question; not scoped, not fixed, worth its own audit.
3. **`memory/MEMORY.md` is stale on `main` right now** (§3a) and the workflow that would say so
   is path-triggered.
4. **Apple Diagnostics on `AceHacks-Mac-Studio`** — still the root question, still needs a human
   at the machine. This audit narrows the blast radius; it does not touch the cause.

***

## Pointers

- `docs/research/2026-08-15-139-and-134-are-signal-deaths-147-of-them-in-one-week-on-one-machine.md` — the finding this narrows
- `tests/cross-verification/zeta-id/gen-layout-drift.ts` (+ `.test.ts`) — the new check and its mutants
- `tests/cross-verification/zeta-id/README.md` — where the gap was already written down
- `.github/workflows/gate.yml` `cross-verify` — the blocking job the step joins · `bytelock.yml` — the drift-not-gate design, argued in its own header
- `src/Core.TypeScript/ci/cross-verify-all.ts` — "It does NOT regenerate the F#/C#/Rust outputs"
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `no-binary-in-proof-lineage.md` · `numerology-vs-number-theory.md` · `dv2-data-split-discipline-activated.md` §4 DST
- Goguen & Meseguer 1982, *Security Policies and Security Models* — noninterference; an unreproduced artifact is an unmetered channel into the proof lineage
- Schroeder, Pinheiro & Weber, *DRAM Errors in the Wild* (SIGMETRICS 2009) — the anchor for the source finding's hardware hypothesis
