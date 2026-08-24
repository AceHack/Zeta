// runtime-candidates.ts — the declared rungs, with MEASURED costs and ATTRIBUTED judgments.
//
// Every `metered` cost below was produced by a command run on a named host on a named date,
// and the method is recorded beside the number so a reader can re-run it. Every rung whose
// cost is `unmetered` says why. Every `enablement` is a dated judgment with an author.
//
// This file is data, not logic. The chooser (`runtime-cost.ts`) is a pure function over it,
// so disagreeing with a judgment is an edit here and never a change to the algorithm.

import type { RuntimeCandidate } from "./runtime-cost.ts";

/** The host every `measuredOn` below refers to. */
export const MEASUREMENT_HOST = "darwin/arm64, macOS 25.5.0, bun 1.3.14, node v24.16.0, dotnet 10.0.303";

/**
 * Enablement judgments are Dejan's, dated, and contestable. They are `unmetered-by-nature`:
 * "installing .NET unlocks a lot" is a claim about future usefulness, not a property of the
 * host. Nobody can measure it today and the true value drifts year over year.
 */
const DEJAN = "dejan (devops-engineer)";
const ON = "2026-08-24";

export const CANDIDATES: readonly RuntimeCandidate[] = [
  {
    // RUNG 1a — recompile/run from committed source on a toolchain already here.
    id: "source-on-bun",
    requires: ["bun"],
    cost: {
      register: "metered",
      addedBytes: 889_457,
      method:
        "CORRECTED 2026-08-24 (second measurement). The first measurement recorded 0 and said " +
        "'no install step'; it was taken with a populated `node_modules` already on disk and is " +
        "the classic check-that-did-not-run. Re-measured from a clean tree with `node_modules` " +
        "moved aside: `bun src/Core.TypeScript/ace/ace.ts list` -> rc=1, " +
        "\"Cannot find module '@noble/hashes/blake3.js'\". ace's runtime closure needs exactly ONE " +
        "npm package and it has zero transitive dependencies (MIT, pinned 2.2.0): with only " +
        "`node_modules/@noble/hashes` present (98 files, 889,457 apparent bytes, 1,072 KiB on disk) " +
        "both bun AND node reach rc=0. So this is the cost of the SOURCE rung, not of any one runtime.",
      measuredOn: MEASUREMENT_HOST,
      measuredAt: ON,
    },
    enablement: {
      score: 0.55,
      by: DEJAN,
      on: ON,
      rationale:
        "bun is this repo's declared packageManager, so it already unlocks the TS/JS half of the tree " +
        "(tests, hygiene lints, most tooling). It unlocks none of the .NET or Rust legs.",
      register: "unmetered-by-nature",
    },
    trust: {
      rank: 0,
      mustTrust: [
        "the committed TypeScript source",
        "the bun runtime already on the host",
        "@noble/hashes 2.2.0 from npm (ace's only runtime dependency; see the corrected cost above)",
      ],
      derivedByUser: true,
    },
    buildable: {
      state: "yes",
      evidence:
        "`bun src/Core.TypeScript/ace/ace.ts list` -> rc=0 ('No DLC packages installed.'); " +
        "keygen/trust/registry subcommands exercised, 2026-08-24. Requires @noble/hashes on disk " +
        "(see cost) — 'works' here means 'works after one package install', never 'works from a bare clone'.",
    },
  },
  {
    // RUNG 1b — same source, different runtime already here. Measured, and NOW UNBLOCKED.
    id: "source-on-node",
    requires: ["node"],
    cost: {
      register: "metered",
      addedBytes: 889_457,
      method:
        "Now measurable, because the rung works (see `buildable`). The cost is IDENTICAL to " +
        "`source-on-bun`: the same one npm package, `@noble/hashes` 2.2.0 (98 files, 889,457 apparent " +
        "bytes). Verified by running ace under BOTH runtimes against a `node_modules` containing " +
        "nothing but that package — rc=0 under each. node itself adds nothing: the rung only applies " +
        "when node is already on the host.",
      measuredOn: MEASUREMENT_HOST,
      measuredAt: ON,
    },
    enablement: {
      score: 0.5,
      by: DEJAN,
      on: ON,
      rationale:
        "node unlocks roughly the same TS/JS surface as bun for running purposes, but not bun's " +
        "test runner or `bun build --compile`, both of which this repo uses.",
      register: "unmetered-by-nature",
    },
    trust: {
      rank: 0,
      mustTrust: ["the committed TypeScript source", "the node runtime already on the host", "@noble/hashes from npm"],
      derivedByUser: true,
    },
    buildable: {
      state: "yes",
      evidence:
        "UNBLOCKED 2026-08-24 (work-item 081M0TKBDXN087G0R003HTKSAZ). The 16 extensionless relative " +
        "specifiers in ace's import closure now carry explicit `.ts` extensions, which node's ESM " +
        "resolver requires and bun's does not. `node src/Core.TypeScript/ace/ace.ts list` -> rc=0. " +
        "Output identity is PROVEN, not asserted: `ace-node-runtime-parity.test.ts` runs the same " +
        "commands under bun and node in an identical sandbox and compares stdout BYTE-FOR-BYTE — " +
        "help, empty store, error paths, and an install/list/verify/registry transcript carrying " +
        "BLAKE3 digests and an Ed25519 signature. Ablation measured which specifiers were load-bearing: " +
        "of the 16, ELEVEN break node when reverted; the other five sit behind `import type` and are " +
        "erased by node's type-stripping. All 16 are fixed anyway — leaving five as a trap for the next " +
        "reader is how the rung rots back to broken. ONE MEASURED LIMIT, stated because a rung's " +
        "limits must be as legible as its capabilities: `ace deps` on a graph using out-of-subset " +
        "YAML (flow sequences, folded block scalars) routes through `yaml/vendor.ts`, whose adapter " +
        "is the Bun built-in `Bun.YAML`. On node that path REFUSES BY NAME (rc=1, 'Bun.YAML is " +
        "unavailable on this runtime') rather than crashing or answering differently. Subset-YAML " +
        "graphs validate identically on both. Every other ace surface is at full parity.",
    },
  },
  {
    // RUNG 3 — one portable sandboxed artifact for every platform.
    id: "portable-wasm",
    requires: ["wasm-runtime"],
    cost: {
      register: "unmetered",
      reason:
        "No artifact exists to weigh. Producing one is not a build-flag change (see `buildable`), so any " +
        "number here would be invented rather than measured.",
    },
    enablement: {
      score: 0.15,
      by: DEJAN,
      on: ON,
      rationale:
        "A wasm runtime unlocks almost nothing else in this repo — it runs ace and the wasm-dla byte-lock " +
        "modules and stops there. Its virtue is portability and sandboxing, not enablement.",
      register: "unmetered-by-nature",
    },
    trust: {
      rank: 1,
      mustTrust: ["one prebuilt wasm artifact", "its checksum", "the host's wasm runtime"],
      derivedByUser: false,
    },
    buildable: {
      state: "no",
      blocker:
        "TypeScript does not compile to wasm. ace is ~24 files of TS using node:crypto, node:fs and " +
        "@noble/hashes, so this rung requires EITHER an AssemblyScript rewrite (a rewrite, not a port — " +
        "AssemblyScript is a different language with no node:crypto) OR shipping a JS engine compiled to " +
        "wasm (Javy/QuickJS) and running ace inside it, which imports a whole second runtime and its " +
        "supply chain. `src/wasm-dla/bytelock/` proves the repo can PRODUCE wasm (6 modules, 1-468 KB) but " +
        "every one is a small numeric kernel hand-written in wat/C/Rust/AssemblyScript/Zig — none is a port " +
        "of a TypeScript program, so it is not precedent for this rung.",
    },
  },
  {
    // RUNG 4 — platform-specific native executable. Last resort, strictest integrity.
    id: "native-dotnet-aot",
    requires: [],
    cost: {
      register: "metered",
      addedBytes: 1134392,
      method:
        "`dotnet new console -lang F#` + <PublishAot>true</PublishAot>, `dotnet publish -c Release " +
        "-r osx-arm64`; `ls -l` on the published binary. This is a HELLO-WORLD, not ace — see `buildable`.",
      measuredOn: MEASUREMENT_HOST,
      measuredAt: ON,
    },
    enablement: {
      score: 0.9,
      by: DEJAN,
      on: ON,
      rationale:
        "HIGHEST of any rung, and this is the judgment most worth contesting. A .NET SDK unlocks the entire " +
        ".NET/F# half of this repo — the solution builds, the test suite runs, the oracles compile. Aaron's " +
        "framing: '.NET has a huge enablement on every OS'. But note this rung as specified does not INSTALL " +
        "an SDK; it ships a self-contained binary, which unlocks nothing but itself. The high score belongs " +
        "to 'the host has .NET', not to 'we handed the host a native binary' — and conflating the two would " +
        "be the model lying to itself.",
      register: "unmetered-by-nature",
    },
    trust: {
      rank: 2,
      mustTrust: ["a prebuilt binary per platform", "its checksum", "N build legs you did not run"],
      derivedByUser: false,
    },
    buildable: {
      state: "no",
      blocker:
        "TWO independent blockers, both measured 2026-08-24. (1) ace is TypeScript; there is no .NET ace, so " +
        "this rung is a full rewrite and not a build target. (2) Even for F# itself the toolchain is not " +
        "ready here: `dotnet publish -c Release -r osx-arm64 -p:PublishAot=true` on a hello-world F# console " +
        "app returned rc=0 and produced a 1,134,392-byte binary that CRASHES ON EXECUTION with rc=134, " +
        "`System.IO.FileNotFoundException: FSharp.Core`, and it emitted ZERO IL2*/IL3* trim warnings while " +
        "doing so. A publish that reports success and yields a binary that cannot start is a false green — " +
        "the exact defect class this repo treats as a bug. A mitigation attempt (TrimMode=partial + " +
        "TrimmerRootAssembly FSharp.Core) failed to build (rc=1), so the crash above is from the prior " +
        "artifact and the mitigation is unproven, not disproven.",
    },
  },
  {
    // The rung that actually exists as a shippable artifact today.
    id: "native-bun-compile",
    requires: ["bun"],
    cost: {
      register: "metered",
      addedBytes: 63627746,
      method:
        "`bun build --compile --outfile ace-native src/Core.TypeScript/ace/ace.ts` -> rc=0, bundle 28 modules; " +
        "`ls -l` on the output. Verified runnable: `./ace-native list` rc=0 and `./ace-native keygen` rc=0.",
      measuredOn: MEASUREMENT_HOST,
      measuredAt: ON,
    },
    enablement: {
      score: 0.05,
      by: DEJAN,
      on: ON,
      rationale: "A sealed single-purpose executable. It unlocks ace and nothing else, by construction.",
      register: "unmetered-by-nature",
    },
    trust: {
      rank: 2,
      mustTrust: ["a prebuilt 61 MB binary per platform", "its checksum", "N build legs you did not run"],
      derivedByUser: false,
    },
    buildable: {
      state: "yes",
      evidence:
        "Built and RUN 2026-08-24: 63,627,746 bytes (61 MiB) for darwin/arm64; `list` and `keygen` both rc=0. " +
        "Note the size: this is a whole bun runtime wrapped around ~24 files of TypeScript.",
    },
  },
];
