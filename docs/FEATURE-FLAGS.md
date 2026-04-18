# Dbsp.Core Feature Flags

Flags gate research-preview and experimental code so production
callers opt in explicitly. All flags default **off**.

Resolution order (first match wins):

1. **Programmatic override** — `FeatureFlags.set flag true`.
2. **Per-flag env var** — `DBSP_FLAG_<UPPER_NAME>` set to
   `1` / `true` / `on` / `yes` (case-insensitive).
3. **Meta-flag** — `DBSP_FLAG_RESEARCHPREVIEW=1` enables every
   flag in stage `ResearchPreview` (does NOT enable
   `Experimental` flags).
4. Default: off.

No flag reads the network. No flag reads a config file the caller
did not hand us. Offline-safe by construction.

See also:
- `src/Dbsp.Core/FeatureFlags.fs` — the module.
- `docs/WONT-DO.md` — why we're not using LaunchDarkly / Unleash /
  any centralised service.

## Active flags

| Flag | Stage | Since | Until | Gates | Tracking |
|------|-------|-------|-------|-------|----------|
| `witnessDurable`    | ResearchPreview | r17 | —   | `DurabilityMode.WitnessDurable` | `docs/papers/WDC-draft.md` (not yet written) |
| `signedSemiNaive`   | ResearchPreview | r18 | —   | `RecursiveSignedSemiNaive` (not yet implemented) | `docs/research/retraction-safe-semi-naive.md` |
| `countingSemiNaive` | Experimental    | r19 | —   | `RecursiveCounting` / `CountingClosureTable`    | `src/Dbsp.Core/Recursive.fs`, `src/Dbsp.Core/Hierarchy.fs` |
| `cqfCountingFilter` | Experimental    | r18 | —   | CQF replacement for `CountingBloomFilter` (not yet implemented) | `docs/research/bloom-filter-frontier.md` |

`Since` = the round the flag was introduced.
`Until` = the round the flag will be retired (blank = no date yet).

## Stages — what they promise

- **Experimental** — the code exists; the shape may change in any
  future round. Consumers opting in accept churn. Do NOT use in
  production.
- **ResearchPreview** — the API is stable enough to wire in, but
  the correctness story is not complete (e.g. TLA+ spec
  outstanding, paper draft pending). Semantics may still shift
  under the same flag name. OK for staging; NOT for production.
  `DBSP_FLAG_RESEARCHPREVIEW=1` is the "turn them all on" knob.
- **Stable** — the flag has graduated. After one release in which
  it is a warning-only no-op, the flag is removed.

## Lifecycle — how flags retire

Super-greenfield, pre-v1. No backward-compat promise. When a flag
graduates to `Stable`:

1. Code matures; tests + benchmark + (where applicable) formal
   spec land.
2. Architect + Spec Zealot + Paper Peer Reviewer sign off.
3. The flag case, the env-var handling, and the doc row are all
   deleted in the same commit. Callers using the flag get a
   compile error pointing them at the now-unconditional
   behaviour. `docs/ROUND-HISTORY.md` records the graduation.

No warning-then-delete grace period. Opt-in callers adjust in the
same round the graduation ships. This rule lives in
`docs/WONT-DO.md` under "warning-then-delete retirement for flags."

## How to add a flag

1. Add a case to `Flag` in `src/Dbsp.Core/FeatureFlags.fs`.
2. Add the stage mapping in the same file's `stage` function.
3. Add the env-var-name case in `envName`.
4. Add a row in the **Active flags** table above with a `Since`
   round.
5. Add a default-off test in
   `tests/Dbsp.Tests.FSharp/FeatureFlagsTests.fs` (will be
   created on first flag test).
6. Gate the feature in the calling code with
   `if FeatureFlags.isEnabled Flag.<yours> then ... else ...`
   or an `invalidOp` in the default branch.

## Anti-patterns (see `docs/WONT-DO.md`)

- Centralised server (LaunchDarkly / Unleash / GrowthBook) — no.
- Config-file-based flags that require `IConfiguration` wiring —
  no; too heavy for a library.
- Umbrella flags that lock many features at once — no; per-
  feature + `researchPreview` meta-flag only.
- Boolean parameters on public APIs masquerading as flags (like
  the old `allowResearchPreview: bool` on
  `DurabilityMode.createBackingStore`) — no; migrate to
  `FeatureFlags.isEnabled` lookup.
