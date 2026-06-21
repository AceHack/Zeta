# The plugin-convergence audit — four plug-shaped systems, one port grammar (081KTZ4EF0008QG0R000WJGSWX second half)

Aaron 2026-06-13: "we already have a plugin system, and they are set up — we might have multiple
plugin systems that need to converge." Audited. We have FOUR, grown separately and honestly; the
DV2 lens says they are one HUB concept with four satellites, and the audit's job is to name the
shared grammar so the fifth system reuses it instead of growing.

## The four, as they stand

| system | the port (interface we own) | the adapter | resolution | nonconformance |
|---|---|---|---|---|
| **PluginApi/Harness** (operator plugins) | `IOperator`/`IStrictOperator`/`IAsyncOperator` + capability interfaces (C#, Abstractions) | `PluginOperatorAdapter` wraps a plugin into a circuit `Op` | capability checks ONCE at wiring (`asStrict`/`asAsync` probes) | wiring-time refusal |
| **MediaLines io** (cartridge capabilities) | the `io` line: a ZetaId-named interface | host capability / door grant / toolbox piece | THE LADDER: Live → Injected → Adapted(via, from) → Mock | honest degradation (Mock = rehearsal; the red light shows it) |
| **GeneratorRegistry** (content-addressed generators) | the ZetaId itself (name@version → 128-bit id) | the registered implementation per oracle language | `byId` lookup; version bump = NEW id (never silent) | dangling id = catalog-law test failure; collisions gated |
| **MagneticPorts** (typed snap, kid-UX) | `Port.TypeId` (a ZetaId) | a `Piece` (two-faced: sink type → source type) | `compatible` (the magnet) + `findAdapter` (the missing piece) | REPULSION — visible, physical, constructive refusal |
| *(new, today)* **IInferenceEngine** | the Gaussian port (Abstractions) | ZetaBayesianEngine / InferNetEngine | direct construction (no resolution yet) | conformance-test divergence |

## The shared grammar (what converges)

Every system above is the same five-part sentence:
1. **A port we OWN**, named by a stable identity (interface type or ZetaId — and the ZetaId IS
   the more general one: content-addressed, version-bumped, language-neutral).
2. **Adapters** supplying the port (ours and theirs; the hexagonal rule — theirs never enters Core).
3. **A resolution step** binding port → adapter against what the host actually has.
4. **An honesty register on the binding** — this is the part only MediaLines does fully (the
   ladder + the red light: Live/Adapted/Mock VISIBLE), and every other system should inherit:
   a plugin that bound via a capability probe, a generator that resolved by id, an inference
   engine that's the mock — each should be able to SAY so in one glance form.
5. **A refusal mode that teaches** — MagneticPorts does this best (repulsion + the missing-piece
   suggestion); PluginApi refuses at wiring; the registry fails a test; the port grammar should
   make "what piece is missing" a standard answer, not a per-system invention.

## The convergence verdict (what to do, what NOT to do)

- **CONVERGE the vocabulary, not the implementations.** The four runtimes serve different physics
  (process-level operators vs text-format capabilities vs id lookup vs pixel snapping) — merging
  code would be unearned coupling. What converges is the GRAMMAR: ZetaId as the universal port
  name; the Live/Injected/Adapted/Mock LADDER as the universal binding result; the red-light
  glance form as the universal honesty register; findAdapter as the universal missing-piece
  answer. (Interfaces are free; the rules of the game are interfaces.)
- **The rule for system five:** new plug-shaped surfaces MUST name their port by ZetaId, return a
  ladder-shaped binding, render its light, and answer "what's missing" via the toolbox — or carve
  an explicit exception. IInferenceEngine is the first customer: its adapters should register
  ZetaIds (engine.zeta-bayesian / engine.infer-net) and its construction should become a ladder
  resolution (the named follow-up on 081KTZ4EF0008QG0R000WJGSWX).
- Beacon: Cockburn's hexagonal architecture (ports/adapters); Fowler's plugin pattern; OSGi/MEF
  as the cautionary maximal versions we are NOT building (capability ladders without the
  framework weight).

## Pointers

- `PluginApi.fs`/`PluginHarness.fs` · `MediaLines` (resolveIoWith/bindingsReport/bindingLight) ·
  `GeneratorRegistry` (idOf/collisions) · `MagneticPorts` (compatible/findAdapter) ·
  `IInferenceEngine` (the first customer of the converged grammar) · 081KTZ4EF0008QG0R000WJGSWX (this closes its
  audit half; the engine-ZetaId + ladder follow-up stays on the row)

## Addendum (same day) — Aaron: "we have universal interfaces too; this smells like that"

Correct, and SENIOR: `universal/extension.md` already carried Probe/Zero/Vectors — the resolution,
the honest zero-case binding, and the conformance halves of this grammar, written before the audit.
The verdict therefore lands where it belongs: the converged vocabulary is now a UNIVERSAL SHAPE —
[`universal/port.md`](../../universal/port.md) (Name/Adapters/Ladder/Light/Missing, cross-anchored
to extension.md) — not a research-doc convention. The rule for system five becomes: implement
universal/port, or carve the exception.
