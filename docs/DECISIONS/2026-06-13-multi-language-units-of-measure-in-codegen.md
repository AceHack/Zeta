# ADR: Multi-Language Units of Measure (UoM) in Codegen

* **Status**: Draft / Proposed
* **Date**: 2026-06-13
* **Author**: Lior (structural synthesizer)
* **Task/Backlog Ref**: 081KS3X9Y0008QG0R000EKJE9S / 081KS3X9Y0008QG0R00323NSZA (Unified unparser/parser layout generation)

---

## Context & Problem Statement

In byte-layout encoding and decoding (such as ZetaId packing/unpacking), we work with various integer semantic values:

1. **Offsets** (positions within a 128-bit frame) in `bits`.
2. **Widths** (field lengths) in `bits`.
3. **Timestamps** in `milliseconds`.
4. **Raw values** representing domain items (e.g., categories, authority tags, chromosomes).

Mixing these up (for example, adding an offset directly to a width, or passing a raw millisecond timestamp to an offset argument) causes silent logical bugs that can only be caught by integration tests.

F# natively solves this via compile-time **Units of Measure (UoM)** (e.g., `let offset: int<bit> = 75<bit>`). We want to enforce this same class of dimensional correctness and type safety across all 6 of Zeta's target languages (F#, C#, TypeScript, Rust, Go, Python) using zero-overhead or lightweight compiler tricks.

---

## Proposed Design: 6-Language UoM Equivalents

We will configure the unified code generator to emit UoM type wrappers for each language. This enforces dimensional safety at compilation/lint time, while compiling down to zero runtime overhead.

```
                  +-----------------------------------+
                  |  Unified Schema (UoM Metadata)   |
                  +-----------------------------------+
                                    |
            +-------+-------+-------+-------+-------+-------+
            |       |       |       |       |       |       |
            v       v       v       v       v       v       v
          [F#]    [C#]    [Rust]   [Go]    [TS]    [Py]  [Schema]
```

### 1. F# Target: Native Units of Measure

- **Construct**: F# native `[<Measure>]` types.
- **Code Gen Output**:
  ```fsharp
  [<Measure>] type bit
  [<Measure>] type ms

  let VersionOffset = 123<bit>
  let VersionWidth  = 5<bit>
  ```

### 2. C# Target: Zero-Overhead Wrapper Structs

- **Construct**: Custom readonly structs with operator overloading (similar to Cysharp's `UnitGenerator` source-generation pattern).
- **Code Gen Output**:
  ```csharp
  public readonly struct Bits : IEquatable<Bits>
  {
      public int Value { get; }
      public Bits(int value) => Value = value;
      public static Bits operator +(Bits a, Bits b) => new Bits(a.Value + b.Value);
      // Operator overloads for comparison and arithmetic
  }
  ```

### 3. Rust Target: Tuple Structs with Trait Impls

- **Construct**: Zero-overhead wrapper tuple structs (`struct Bits(pub u32)`).
- **Code Gen Output**:
  ```rust
  #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
  pub struct Bits(pub u32);

  impl std::ops::Add for Bits {
      type Output = Self;
      fn add(self, other: Self) -> Self { Bits(self.0 + other.0) }
  }
  ```
  - The Rust compiler completely optimizes these wrappers out, executing direct `u32` arithmetic at runtime.

### 4. Go Target: Aliased Primitives

- **Construct**: Aliased types (`type Bits uint32`).
- **Code Gen Output**:
  ```go
  type Bits uint32
  type Milliseconds uint64
  ```
  - In Go, a named type cannot be implicitly converted to its underlying primitive type, preventing accidental assignments or math operations across different types without explicit casts.

### 5. TypeScript Target: Branded Types

- **Construct**: Intersection branded types (`type Bits = number & { readonly __brand: "Bits" }`).
- **Code Gen Output**:
  ```typescript
  export type Bits = number & { readonly __brand: "Bits" };
  export type Milliseconds = bigint & { readonly __brand: "Milliseconds" };

  export const makeBits = (n: number) => n as Bits;
  ```
  - Forces the TS compiler to reject raw numbers when a specific unit is expected.

### 6. Python Target: Static NewType Wrappers

- **Construct**: `typing.NewType`.
- **Code Gen Output**:
  ```python
  from typing import NewType

  Bits = NewType('Bits', int)
  Milliseconds = NewType('Milliseconds', int)
  ```
  - Type-checkers like `mypy` and `pyright` enforce assignment safety, while python executes standard `int` operations at runtime.

---

## Consequences

* **Pros**:
  * **Catastrophic Error Prevention**: Totally eliminates offset-width mixing and timestamp units confusion at build time.
  * **Zero Runtime Cost**: Every implementation compiles down to standard primitive operations without heap allocations or boxing.
  * **Self-Documenting API**: Signatures clearly convey units (e.g. `fn set_bits(val: u128, offset: Bits, width: Bits) -> u128`).
* **Cons**:
  * Slightly increases code generation surface to emit these type structures.
