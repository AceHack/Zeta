# No binary in the proof lineage

Carved sentence:

> Verification artifacts are TEXT, never binary blobs. Byte-lock every binary
> format (CBOR · Arrow · protobuf · Merkle roots · metric sketch tables · …) as
> hex/decimal strings inside JSON golden vectors — so each byte-lock is diffable,
> DST-replayable, and human-auditable in a `git` diff. No format's golden vectors
> are a checked-in binary; the proofs never depend on bytes you cannot read or
> merge. New format whose vectors are tempting to store raw → encode hex-in-JSON.

## Why

A checked-in binary in the proof lineage is opaque: a reviewer can't read it, a
merge can't reconcile it, and a malicious/accidental byte-swap hides where no diff
shows it. Hex-in-JSON keeps the entire verification substrate text — every
byte-lock change is a readable diff, replays deterministically (DST), and stays
mergeable. (Tradeoff accepted: large fixtures get verbose, still diffable.)

Binary files in the repo are otherwise NON-verification (reference PDFs, a couple
images, forensic logs) — never proofs. This paragraph used to read "the only
binary files in the repo are…", which was false when written: `src/wasm-dla/bytelock/`
held six committed `.wasm` files from 2026-08-01 to 2026-09-10, in a directory
literally named "bytelock". The exception below is what the rule always meant — and
as of 2026-09-10 **nothing in the repository exercises it**, because those six are
now built in CI instead. It is kept as a boundary, not as a description of the tree.

## The one exception: the artifact UNDER TEST

> **The evidence is text. The thing under test is not evidence.**

A binary may be committed inside a verification directory when it is the **subject**
of the comparison rather than the **expectation** it is compared against. Six DLA
substrate modules — `dla-canonical-{wat,llvm,emcc,rust,asc,zig}.wasm` — were that case
from 2026-08-01: `run-bytelock-ci.mjs` *loads and executes* each one and compares its
trajectory against `testdata/golden-seed-*.json`, which is hex-in-JSON exactly as the
carved sentence requires.

**They are no longer committed, and condition 3's own parenthesis is why.** It said
"where the toolchain also exists in CI, prefer *building* over *committing*", and
`src/wasm-dla/bytelock/.gitignore` recorded the trade the six were accepted under —
they were tracked *because* no CI leg could rebuild them, and "add a toolchain to the
workflow and the corresponding file should stop being tracked, not start being
trusted." Run 34490525095 measured all five byte-lock legs: every substrate builds,
in 52–75 s of toolchain install on Linux and macOS, and every rebuilt module
reproduces the **unchanged** golden vectors. So the toolchains were added and the
files were deleted — six OpenSSF `BinaryArtifactsID` alerts closed by removal rather
than by dismissal. Two per-leg gaps are upstream and are recorded in the matrix
(Chocolatey's `wabt` ships no `wat2wasm`; emsdk publishes no Windows-arm64 SDK).

The exception's *reasoning* stands unchanged, and it is why the condition list stays:
encoding a `.wasm` as hex would not make it more auditable — nobody reviews a
WebAssembly module by reading its bytes; you review its **source**, which is committed
beside it as `.wat` / `.c` / `.rs` / `.ts` / `.zig`. What changed is that the source is
now the *only* thing committed.

**The exception is exhausted by these five conditions, all machine-checked:**

1. **Subject, not evidence.** Something loads and *runs* it. A binary that is only
   read and compared is a golden vector wearing a disguise — that is the rule,
   not the exception.
2. **Its expectation is text, and is read.** The vectors it is judged against are
   hex-in-JSON *and a consumer opens them*. A golden vector nothing reads is the
   vacuity class in its purest form: it looks like compliance and constrains nothing.
3. **Reproducible from committed source.** A build recipe exists in the repo and its
   input source file is committed text. Without that the binary is *trusted*, and
   trusted bytes in a proof lineage are the thing this rule forbids. (Where the
   toolchain also exists in CI, prefer *building* over *committing* — as
   `bytelock.yml` does for the Go substrate.)
4. **Named in an enumerable roster.** A check can list every exempt file by parsing
   the runner, not by consulting a hand-written allowlist that drifts from it.
5. **Stripped.** No DWARF/debug sections. Unreviewable bulk proves nothing about the
   trajectory and is not covered by "under test".

**An exception with no scope is a licence, so this one has an enforcer:**
`src/Core.TypeScript/hygiene/audit-proof-lineage-binaries.ts`, run in the
`cross-verify` floor job on every PR. It derives the allowed set from the byte-lock
runner's own roster and the build script's own declared outputs, so a new binary in
that directory fails until it is wired into both. It went red on `main` when written
— a stray `.rcgu.o` rustc intermediate, and the unread golden vectors of condition 2.

**And DELETING a binary has to be guarded too, which is the half that did not exist
before.** A roster substrate with no committed file used to be a flat failure; now it
must be *built*, and the audit demands two things it reads out of `bytelock.yml`
itself: the job runs the shared build action, **and** the substrate is named in a
`BYTELOCK_REQUIRED_SUBSTRATES` list. The second is the load-bearing one — it is what
turns "the file is gone" from an absence nobody sees into a named, red per-route
floor, which is the guarantee the committed file used to give by simply existing.

**Not covered by this exception** (each is a *rule* case, not an *exception* case):
build intermediates (`.o`, `.a`, `.bc`, `.rcgu.o`), binaries nothing executes,
binaries with no committed source, and any binary that *is* the expected value.

**A note on the tooling.** OpenSSF Scorecard's `Binary-Artifacts` check
(`BinaryArtifactsID`, surfaced in code scanning by `.github/workflows/scorecard.yml`,
*not* a CodeQL query) flags every committed binary and offers no in-repo allowlist.
Six such alerts stood against the substrate modules. They were closed on 2026-09-10
**by deleting the binaries**, not by dismissing the alerts — which is the disposition
to prefer whenever it is reachable: a dismissal is a claim about the alert, a deletion
is a change to the tree. The audit above, not any dismissal, is what keeps the claim
true for whatever is committed next.

## Pointers

- `docs/PROVEN-COVERAGE-AND-GAPS.md` — the audit (all golden vectors `.json`/hex).
- The `golden-vectors-*.json` files (cbor/arrow/merkle/bloom/countmin) — the pattern.
- `docs/backlog/P2/081KT07NV0008QG0R0032MCYER-four-oracle-multi-format-golden-vector-seeds-cbor-json-yaml-*` — the seed doctrine.
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md) — DST (#4) + idempotency: text golden vectors replay deterministically.
- `src/Core.TypeScript/hygiene/audit-proof-lineage-binaries.ts` — the enforcer of the
  exception above (`cross-verify` floor job).
- `src/wasm-dla/bytelock/` — formerly the one exempt directory. Now: nine substrates'
  committed **sources**, the hex-in-JSON vectors that judge them, and no committed
  `.wasm` at all. `.gitignore` there carries the measurement.
- `.github/actions/build-wasm-substrates/` — the shared build step the four lanes that
  need these artefacts all use (byte-lock, Pages deploy, and two gate jobs), with the
  per-leg install costs measured in its header.
- `docs/research/2026-08-15-which-locally-produced-artifacts-does-ci-never-reproduce-narrowing-the-corruption-window-claim.md`
  — §1's REFERENCE-ONLY disposition ("the file is compared to itself") is the general form
  of what condition 2 above forbids.
