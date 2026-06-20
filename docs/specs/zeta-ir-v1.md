# `zeta-ir-v1` — the frozen generator-IR layout

**Status:** FROZEN (v1). **Owner:** Lumen. **Date:** 2026-06-20.
**Discharges:** math-team handoff row 10, Face 3 — *Phase A, "Freeze the IR (prerequisite, blocking)."*
**Source of truth:** `src/Core/ZetaIrV1.fs`. **Golden:** `tests/cross-verification/zeta-ir-v1/zeta-ir-v1.golden.json`. **Tests:** `tests/Tests.FSharp/ZetaIrV1.Tests.fs`.

## Why freeze

The gen-gen test plan is explicit that the Futamura `gen(gen) = gen` capstone (Face 3) is blocked on a stable IR: *"Nothing below can byte-lock against a moving IR."* `GeneratorIrRegistry` already carries the generator IR as a live row on a DBSP Z-set relation and reproduces the committed `*.ir.json` artifacts byte-for-byte — but the **shape was unfrozen and inconsistent** across the two shipped artifacts:

| Legacy artifact | `zetaId` field | `width` field |
| --- | --- | --- |
| `splitmix64.ir.json` | present | **absent** |
| `fmix32.ir.json` | **absent** | present |

A self-hosting fixed-point proof cannot point at a moving target. `zeta-ir-v1` pins **one** canonical envelope and golden-vectors it.

## The v1 envelope

Canonical key order (this *is* the frozen contract):

```json
{
  "schema": "zeta-ir-v1",
  "generator": "rng.splitmix64",
  "version": 1,
  "width": 64,
  "ops": [ { "op": "mul", "k": -7046029254386353131 }, { "op": "xorshr", "s": 30 } ]
}
```

| Key | Type | Notes |
| --- | --- | --- |
| `schema` | string | Always `"zeta-ir-v1"`. **New in v1** (the legacy files had no version tag). Required. |
| `generator` | string | Generator name, e.g. `rng.splitmix64`. |
| `version` | int | The **generator** version (not the schema version). |
| `width` | int | Word width in **bits**. **Required in v1** — resolves splitmix64's omission (u64 ⇒ 64). |
| `ops` | array | The finaliser pipeline; each node matches the op grammar below. |

### Op grammar (total)

The only two ops the cross-language oracles fold:

| Node | Meaning |
| --- | --- |
| `{ "op": "mul", "k": <int> }` | multiply mod `2^width`; u-word multipliers are stored as their signed-int64 bit-pattern (multiply mod `2^width` makes the reinterpretation bit-exact). |
| `{ "op": "xorshr", "s": <int> }` | `x ^= x >>> s`. |

Any other `op` is **rejected** by the validator (`ZetaIrV1.validate`).

## The homoiconic invariant: no stored `zetaId`

A v1 IR carries **no** `zetaId` field. The row's identity is the **derived** content-address `GeneratorRegistry.idOf generator version`, recomputed on read. Storing the id as data is exactly the mintable-identity anti-pattern the homoiconic rule forbids — *"DERIVED from name@version, never minted-and-forgotten."* The validator **rejects** any IR that carries a stored `zetaId`.

No information is lost: `idOf "rng.splitmix64" 1` reproduces the legacy stored id `129c1fac3a48075b481c0f10f30deb06` exactly (pinned in the tests). The legacy field was un-frozen redundancy.

## Relationship to the legacy `*.ir.json` files

The two `tests/cross-verification/**/_gen/*.ir.json` artifacts are **pre-v1 (grandfathered)**. They are *not* rewritten by this freeze — their existing cross-language byte-locks stand. `zeta-ir-v1` defines the canonical envelope **going forward**; the `ops` pipeline is identical (v1 is a re-enveloping of the same finaliser, asserted against the live `GeneratorIrRegistry` row), so a future migration of the legacy files to v1 is a pure envelope change, not a semantic one.

## Evolution contract (v2+)

1. **The schema tag is the version.** A breaking layout change MUST bump the tag (`zeta-ir-v2`) and ship its own frozen golden. The v1 validator rejects any other tag, so a v2 artifact can never be silently read as v1.
2. **Freeze-then-grow.** New optional keys MAY be added in a minor revision only if (a) absent ⇒ identical canonical bytes for every existing v1 IR, and (b) the v1 golden still reproduces byte-for-byte. Otherwise it is a new major (`v2`).
3. **Identity stays derived.** No version may reintroduce a stored `zetaId`; identity is always the content-address of `generator@version`.
4. **The golden is the gate.** `zeta-ir-v1.golden.json` is byte-locked in CI. Any shape drift changes those bytes and fails — which is the whole point of a freeze.

## Scope (honest tiering)

- **PROVEN here:** a single frozen v1 layout with a versioned, golden-vectored canonical serialisation; a total validator that accepts conformant IRs and names every shape deviation; the two known generators expressed under v1 with a byte-locked golden; and derived-id equivalence with the legacy stored id.
- **NOT claimed here:** the Face-3 Lean/Z3 `gen(gen) = gen` theorem itself (that remains the math team's), nor that v1 is the final layout. This freeze only makes the **substrate stable** so the proof has a fixed artifact to point at.
