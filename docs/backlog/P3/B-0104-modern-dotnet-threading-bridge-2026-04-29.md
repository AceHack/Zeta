---
id: B-0104
priority: P3
status: open
title: Modern .NET Threading Bridge — connect Deepseek's C# review to docs/LOCKS.md + Gemini Pro threading research
tier: research-grade
effort: M
ask: Multi-AI synthesis packet 2026-04-29 (Deepseek review of 2026-04-28 Gemini Pro threading doc + Amara filter)
created: 2026-04-29
last_updated: 2026-04-29
composes_with: []
tags: [threading, locks, dotnet, csharp, async, documentation, modernization-bridge]
---

# Modern .NET Threading Bridge

The 2026-04-29 multi-AI packet contained a Deepseek review of
the existing 2026-04-28 Gemini Pro threading research doc
(`docs/research/2026-04-28-gemini-pro-deep-research-threading-net10-csharp14-modernization.md`).
The review surfaced 5 specific corrections worth integrating
into the canonical threading documentation.

Aaron's framing: *"we have a few different docs not just the one
amara mentioned on threading and locks"* — the bridge needs to
connect:

- `docs/LOCKS.md` (Amara's primary cite — existing lock inventory + replacement criteria)
- `docs/research/2026-04-28-gemini-pro-deep-research-threading-net10-csharp14-modernization.md` (Gemini Pro deep-research)
- Any other threading docs surfaced via grep (verify before edit)

## The 5 corrections (from Deepseek)

### 1. ReaderWriterLockSlim → SemaphoreSlim(1,1) replacement nuance

**Bad** (current Gemini doc): "replace ReaderWriterLockSlim with SemaphoreSlim(1,1)"

**Better**:

```text
ReaderWriterLockSlim is not async-safe across awaits due to
thread-affinity / ownership assumptions.

Replacement depends on intent:
- If reader/writer distinction is not actually needed:
  use SemaphoreSlim(1,1) as async mutex.
- If true concurrent readers are required:
  use an async reader/writer lock implementation
  (e.g., Nito.AsyncEx) or redesign around channels,
  immutable snapshots, copy-on-write state, or actor
  ownership.
```

### 2. System.Threading.Lock cast-to-object nuance

**Add to the doc**:

```text
Do not upcast System.Threading.Lock to object before locking.
The compiler special-case (translation to using EnterScope())
depends on the expression type. If you cast Lock to object
and lock on that object, the compiler treats it as a standard
object lock, losing the ref-struct scope semantics.
```

### 3. FrozenSet/FrozenDictionary wording softening

**Bad**: "deeply analyzes the specific structural characteristics
of the ingested data payload to generate a perfectly optimized,
custom hashing algorithm"

**Better**:

```text
FrozenSet/FrozenDictionary trade construction cost for optimized
read-heavy lookup. They are appropriate for build-once/read-many
tables, not frequently mutated state.
```

### 4. Task.WhenEach internals caveat

**Bad**: relying on `AddCompletionAction mechanics in MoveNext`
without source/version pinning.

**Better**:

```text
Task.WhenEach yields tasks as they complete (IAsyncEnumerable).
Order is unspecified. Implementation internals may change
between .NET versions; do not rely on specific allocation
mechanics without source-pin + version-pin.
```

### 5. Cross-link to operator algebra async lifecycle invariants

The threading doc should not just be "C# tips" — it should
connect to the Zeta invariant that the operator algebra spec
already defines:

```text
Concurrency primitive choice is implementation detail.
Observable tick contract is the source of truth.

Async implementation flags do not weaken observable contracts.
Async continuations must complete before a tick is observable
as complete; tick t+1 cannot advance while tick t continuations
remain outstanding.
```

(Per `openspec/specs/operator-algebra/spec.md`.)

## Suggested doc structure (per Amara's outline)

```markdown
# Modern .NET Threading Bridge

## Purpose
Connect classic threading primitives to Zeta's current lock
inventory and async lifecycle contracts.

## Source-of-truth docs
- docs/LOCKS.md
- openspec/specs/operator-algebra/spec.md
- docs/research/2026-04-28-gemini-pro-deep-research-threading-...md

## Replacement map
Thread -> Task / ThreadPool / dedicated scheduler only when justified
Monitor / lock(obj) -> System.Threading.Lock where C# surface supports it
ReaderWriterLockSlim -> async mutex only if reader concurrency is not needed
BlockingCollection -> Channel<T>
BackgroundWorker -> Task / async APIs
ManualResetEvent -> Async coordination primitive where possible

## Zeta rule
Do not replace a lock because it looks old.
Replace it only when the new primitive preserves the observable
contract and reduces measured contention/allocation risk.

## ReaderWriterLockSlim nuance (see §1 above)
## System.Threading.Lock nuance (see §2)
## Frozen collections (see §3)
## Task.WhenEach (see §4)
## Operator algebra async lifecycle (see §5)
```

## Best distilled blade (Amara)

```text
Do not modernize primitives.
Modernize guarantees.
```

## Why P3 (research-grade)

The corrections are valuable but not blocking — the existing
`docs/LOCKS.md` is correct and the existing Gemini Pro research
doc is research-grade (not authoritative-current-state). The
bridge can wait until threading work is the active focus, OR
land as a small low-risk PR if a contributor picks it up.

## Migration path (when active)

1. Locate ALL threading-related docs via
   `grep -rlE 'ReaderWriterLockSlim|System.Threading.Lock|FrozenDictionary|FrozenSet|Task.WhenEach|SemaphoreSlim' docs/`
   (the `-E` flag enables ERE so unescaped `|` is alternation;
   without `-E`, BSD/macOS grep treats `\|` as a literal in
   BRE rather than alternation).
2. Author the bridge doc (likely
   `docs/threading/MODERN-DOTNET-THREADING-BRIDGE.md`).
3. Cross-link from `docs/LOCKS.md` and the existing Gemini Pro
   research doc.
4. Apply the 5 specific corrections to the existing Gemini Pro
   research doc OR mark sections as "see bridge doc for current
   correction."
5. Land as one PR; do not split (chunking pattern).

## Composes with

- `docs/LOCKS.md` — primary connection point.
- `docs/research/2026-04-28-gemini-pro-deep-research-threading-net10-csharp14-modernization.md`
  — reviewed doc; corrections target this.
- `openspec/specs/operator-algebra/spec.md` — async lifecycle
  invariants to cross-link.
