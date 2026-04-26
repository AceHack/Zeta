# F# profile — durability-modes

This profile documents how the durability-modes capability is realised in F#
today. Prose bullets, no RFC-2119; those live in the base `spec.md`.

## Namespace and source files

- Types and the factory live in the `Zeta.Core` namespace, across:
  - `src/Core/Durability.fs` — the `DurabilityMode` discriminated union,
    the `WitnessDurableBackingStore` skeleton, the `DurabilityMode` module
    with `createBackingStore` and `recoveryProperty`.
  - `src/Core/FeatureFlags.fs` — the `Flag` DU, the `FlagStage` DU, and
    the `FeatureFlags` module that does the resolution.
  - `src/Core/DiskSpine.fs` — `IBackingStore<'K>`,
    `InMemoryBackingStore<'K>`, and `DiskBackingStore<'K>` (which
    `createBackingStore` dispatches to).
  - `docs/FEATURE-FLAGS.md` — the flag reference table every new flag is
    required to update.

## DurabilityMode DU

- `DurabilityMode` is `[<RequireQualifiedAccess>]` so every call-site reads
  `DurabilityMode.OsBuffered` rather than a bare identifier — the mode is
  part of the vocabulary and the qualification makes the choice visible in
  review.
- The four cases are `InMemoryOnly`, `OsBuffered`, `StableStorage`, and
  `WitnessDurable`. Each case carries an XML-doc paragraph listing the
  correctness model it advertises and — where the shipped implementation
  does not yet match — an "honesty note" naming the delta. The
  `StableStorage` doc says plainly that the factory currently maps it to
  `DiskBackingStore` because per-save fsync is not yet implemented.

## Factory — `DurabilityMode.createBackingStore`

- `DurabilityMode` is `[<CompilationRepresentation(ModuleSuffix)>]` so the
  DU and its companion module share a name; callers write
  `DurabilityMode.createBackingStore mode workDir witnessDir quota` and it
  reads naturally.
- The factory's match arm for `WitnessDurable` consults
  `FeatureFlags.isEnabled Flag.WitnessDurable`. When the flag is off, the
  factory raises `invalidOp` with a message that identifies the mode as a
  research preview and names `OsBuffered` as the usable alternative.
- The `allowResearchPreview: bool` parameter that existed on earlier
  revisions of `createBackingStore` was migrated off in favour of the
  feature-flag lookup; boolean parameters masquerading as flags are listed
  as an anti-pattern in `docs/FEATURE-FLAGS.md`.
- For `WitnessDurable`, the factory instantiates
  `WitnessDurableBackingStore<'K>(workDir, witnessDir, 512)` where `512` is
  the default NVMe atomic-write size (AWUPF) on most consumer drives.
  Callers running on enterprise SSDs with 4 KB AWUPF are responsible for
  measuring their device before shipping — this is called out in the
  doc-comment.

## IBackingStore surface

- `IBackingStore<'K when 'K : comparison>` (in `DiskSpine.fs`) has three
  members: `Save(level, batch) -> obj`, `Load(handle) -> ZSet<'K>`, and
  `Release(handle) -> unit`. The `obj` handle is deliberately opaque so the
  factory can vary the concrete type per backing store.
- `InMemoryBackingStore<'K>` keeps a locked `Dictionary<int64, ZSet<'K>>`;
  `DiskBackingStore<'K>` spills to a per-instance subdirectory under
  `workDir` and keeps small batches resident under `inMemoryQuotaBytes`.
- `WitnessDurableBackingStore<'K>.Save` throws `NotImplementedException`
  before any state mutation. An earlier revision incremented a `nextId` and
  inserted into a hot dict before throwing, leaking memory per retry; that
  bug has been fixed and the discipline is called out in a comment.

## Feature-flag module

- `Flag` is `[<RequireQualifiedAccess>]` with four cases today:
  `WitnessDurable`, `CountingSemiNaive`, `SignedSemiNaive`, and
  `CqfCountingFilter`. New flags are added narrowly — one case per feature,
  no umbrella toggles.
- `FeatureFlags.stage` classifies a flag into `FlagStage.Experimental`,
  `FlagStage.ResearchPreview`, or `FlagStage.Stable`. `WitnessDurable` and
  `SignedSemiNaive` are research preview; `CountingSemiNaive` and
  `CqfCountingFilter` are experimental.
- `FeatureFlags.isEnabled` resolves in this order: programmatic override
  (`ConcurrentDictionary<Flag, bool>`); per-flag env var
  (`DBSP_FLAG_<UPPER_NAME>`, parsed as true for `1`/`true`/`on`/`yes`);
  meta-flag (`DBSP_FLAG_RESEARCHPREVIEW` enables every research-preview
  flag, never experimental ones); default false.
- `FeatureFlags.set`, `FeatureFlags.reset`, and `FeatureFlags.resetAll`
  manipulate the override dictionary. The dictionary is a
  `ConcurrentDictionary<Flag, bool>`, so reads and writes from different
  threads see a coherent value without extra locking.
- The evaluator reads only process environment variables and the in-process
  override dictionary — there is no network call, no config-file read, and
  no centralised flag service. That pledge is stated on the module and
  restated in `docs/FEATURE-FLAGS.md`.

## Flag lifecycle discipline

- Every new flag requires five touches: a `Flag` DU case, a `stage` mapping,
  an `envName` mapping, a row in `docs/FEATURE-FLAGS.md`, and a default-off
  test. The feature-flags reference doc lists the checklist.
- Retirement: a flag graduates by having its stage flipped to `Stable`;
  `isEnabled` then reads `true` unconditionally and emits a
  `Trace.TraceWarning` on first read for exactly one release. The next
  release removes the case, the env-var mapping, and the doc row.
