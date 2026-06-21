# ANTLR Grammar Survey & ZetaParse Compiler Pipeline Design

Date: 2026-06-13
Participants: Lior (Antigravity / Gemini CLI)
Operational status: research-grade preservation; 081KS3X9Y0008QG0R000EKJE9S/081KS3X9Y0008QG0R00323NSZA design survey phase

---

## 1. ANTLR v4 Target Ecosystem & Licensing Matrix

To build a universal cross-language parser/generator pipeline that operates identically across Zeta's 6 consensus languages (F#, C#, TypeScript, Rust, Go, Python), we must evaluate the support, license compatibility, and maintenance status of ANTLR v4 runtimes and target grammars.

The ANTLR v4 tool itself and its official runtimes are distributed under the **BSD 3-Clause License**, which allows unrestricted commercial and research use. The canonical grammars maintained in the [antlr/grammars-v4](https://github.com/antlr/grammars-v4) repository are primarily licensed under **MIT** or **BSD**, presenting zero compliance hazards for Zeta.

### Target Support Matrix

| Language | Runtime Target Type | Maintenance / Quality Status | License | Integration Path |
| :--- | :--- | :--- | :--- | :--- |
| **C#** | Official (.NET Standard) | **Tier-1** (Highly Active) | BSD 3-Clause | Reference assembly package |
| **F#** | Official (via C# wrapper) | **Tier-1** (Leverages C# runtime) | BSD 3-Clause | F# wrapper with active type-erasure helpers |
| **TypeScript** | Official (JS/TS target) | **Tier-1** (Active, Bun-compatible) | BSD 3-Clause | Bun/NPM package `antlr4` |
| **Rust** | Community (`antlr4rust`) | **Tier-2** (Moderate, unsafe blocks) | MIT / Apache | Cargo crate with customized code generator |
| **Go** | Official (Go target) | **Tier-1** (Active, Go modules) | BSD 3-Clause | standard library package import |
| **Python** | Official (Python3 target) | **Tier-1** (Active, Pip-compatible) | BSD 3-Clause | PyPI package `antlr4-python3-runtime` |

### Key Ecosystem Trade-offs

1. **Rust Target Overhead**: The community Rust target generator (`antlr4rust`) relies heavily on reference-counted trees (`Rc`/`RefCell`) to match ANTLR's object-oriented memory model. This introduces performance overhead and code verbosity compared to native parser generators like `nom` or `pest`.
2. **F# Native FParsec Alternative**: While ANTLR provides a unified grammar definition (`.g4`), F# developers typically prefer `FParsec` for combinator-based monadic parsing. However, for 6-language parity, using the ANTLR C# runtime wrapped in F#-friendly active patterns ensures 100% grammar-level consistency across all target environments.

---

## 2. Unified Grammar IR (`.zg` Schema Design)

To avoid compiling language-specific AST structures manually, we propose the **Zeta Grammar IR (`.zg`)**. The `.zg` schema represents AST nodes in a language-agnostic intermediate format, making it easy to serialize, validate, and generate code.

A `.zg` definition acts as both the data schema and the unparsing directive.

### Conceptual Schema Layout (`antlr_grammar_ir.zg.json` shape)

```json
{
  "$schema": "https://zeta.dev/schemas/zg.v1.json",
  "name": "ZetaCoreAST",
  "types": {
    "ZetaObservation": {
      "kind": "Record",
      "fields": [
        { "name": "version", "type": "Int32" },
        { "name": "timestamp", "type": "Int64" },
        { "name": "chromosome", "type": "String" },
        { "name": "category", "type": "String" },
        { "name": "firefly", "type": "String" },
        { "name": "authority", "type": "Authority" },
        { "name": "persona", "type": "String" },
        { "name": "momentum", "type": "Momentum" },
        { "name": "location", "type": "String" }
      ]
    },
    "Authority": {
      "kind": "Union",
      "cases": [
        { "name": "Raw", "type": "Int32" },
        { "name": "Registered", "type": "String" }
      ]
    },
    "Momentum": {
      "kind": "Union",
      "cases": [
        { "name": "Raw", "type": "Int64" },
        { "name": "Default", "type": "Null" }
      ]
    }
  }
}
```

### Type Mapping Protocol

- **Primitives**:
  - `Int32` / `Int64`: Mapped to safe integer bounds check (±$2^{53} - 1$ in TS/Python, standard bounds in Rust/Go/C#).
  - `String`: UTF-8 clean scalar string (Lone surrogates rejected natively).
  - `Null`: Represents optional/null values.
- **Algebraic Data Types (ADTs)**:
  - `Record` maps to F# records, C# positional records, TS interfaces, Rust structs, Go structs, and Python dataclasses.
  - `Union` maps to F# discriminated unions, C# class hierarchies (or source-generated unions), TS tagged unions, Rust enums, Go interface/struct implementations, and Python `Union` type-hints.

---

## 3. ZetaParse GLR/LR Integration with F# Type Providers

To achieve compile-time verification of language-agnostic syntax structures, **ZetaParse** integrates with F# Type Providers. This exposes parsed AST definitions directly as strongly-typed members at compile time.

```
+------------+       +-----------+       +-------------------+       +-----------------------+
|  .zg Schema | ----> | ZetaParse | ----> | F# Type Provider  | ----> | Strongly-Typed F# AST |
| Definition |       | Compiler  |       | (Compile-Time)    |       | (e.g. Expr.Add, etc)  |
+------------+       +-----------+       +-------------------+       +-----------------------+
```

### The Compile-Time Pipeline

1. **Schema Ingestion**: The Type Provider is initialized with a path to a `.zg` schema file:
   ```fsharp
   type ZetaAST = ZetaParse.TypeProvider<"CoreAST.zg">
   ```
2. **Metadata Generation**: The Type Provider reads the `.zg` schema, parses the nodes, and programmatically defines corresponding F# types (Records, DUs) within the compilation context.
3. **GLR/LR Parser Generation**: A specialized parser is compiled under the hood. F# code gains access to a strongly-typed parse entrypoint:
   ```fsharp
   match ZetaAST.Parse("version: 1 timestamp: 12345...") with
   | Ok observation -> printfn "Category: %s" observation.Category
   | Error err      -> printfn "Parse failed: %s" err.Message
   ```
4. **Compile-time Safety**: Any changes in the upstream `.zg` grammar schema immediately invalidate downstream F# consumers, forcing compile-time verification of AST structures across the entire compiler toolchain.

---

## 4. Unparser Codegen Architecture (Reverse Generation)

The unparser pipeline converts structural AST models back into canonical string representations. Instead of writing manual template engines, we use **Layout Combinators (pretty-printers)** that respect language-specific formatting layouts.

### Architecture of the Unparser Pipeline

```
                     +----------------------------+
                     |  Language-Agnostic AST     |
                     +----------------------------+
                                   |
                                   v
                     +----------------------------+
                     |     Zeta Grammar IR        |
                     |     Layout Combinator      |
                     +----------------------------+
                                   |
                                   v
                     +----------------------------+
                     |     Layout Document (Doc)  |
                     +----------------------------+
                                   |
            +----------------------+----------------------+
            |                      |                      |
            v                      v                      v
  +------------------+   +------------------+   +------------------+
  |    F# Target     |   |    TS Target     |   |   Rust Target    |
  | (Spaces, Indent) |   | (ESLint-Clean)   |   | (cargo fmt style)|
  +------------------+   +------------------+   +------------------+
```

### Step-by-Step Generation Flow

1. **Ast to Doc Mapping**: The `.zg` engine maps each AST node to a structural `Doc` node using layout combinators (e.g., `Concat`, `Group`, `Line`, `Nest`, `Align`).
2. **Constraint Application**: The layout engine calculates ideal line breaks, indentation levels, and alignment constraints based on maximum line width limits (typically 100 or 120 characters).
3. **Target Formatting Output**:
   - **TypeScript**: Outputs code matching Prettier/ESLint rules.
   - **Rust**: Outputs code compliant with `rustfmt` formatting standards.
   - **F# / C#**: Generates code formatting standard with `dotnet format` analyzers.
   - **Go**: Emits source files pre-processed by `gofmt`.
   - **Python**: Emits formatting compliant with `ruff format`.

By abstracting AST generation into unified layout models, the unparser pipeline guarantees that generated code across all 6 languages is syntax-valid, readable, and linter-compliant by default.

---

## 5. Unified IR Metaclassification (ZetaId, Category, Generator & Cartridges)

To establish absolute structural honesty and compile-time traceability across the pipeline, every intermediate representation (IR) type or interface defined via the `.zg` parser/unparser compiler must be treated as a first-class registered shape.

Specifically, the compiler enforces a **four-part metadata contract** on every schema-defined node:

```
+-------------------------------------------------------------+
|                     Zeta Grammar IR Type                    |
+-------------------------------------------------------------+
   |             |                     |                |
   v             v                     v                v
+------+   +----------+   +----------------------+   +--------------+
| Zeta |   | Category |   | Generator Function   |   |  .lines Cart  |
|  Id  |   |   Code   |   | (Deterministic Mock) |   | (Treaty/Law) |
+------+   +----------+   +----------------------+   +--------------+
```

### 5.1. Content-Addressed ZetaId & Category

To prevent silent layout shifts and enforce static equivalence, each type carries a deterministic `ZetaId` and a `Category` header:

- **Category**: Classifies the structural subsystem (e.g. `category 1` for core AST tokens, `category 3` for metadata, `category 8` for shapes).
- **ZetaId**: A 128-bit hash (represented as a 32-hex string) computed deterministically from the type's fully qualified name, its category, and its fields schema layout.
  - Since the ID is content-addressed, any structural change in a type's definition (e.g. adding a field, renaming a case) changes its `ZetaId`. This immediately breaks compiler compatibilities and forces developers to explicitly bump versions and re-ratify downstream treaties, avoiding silent runtime bugs.

### 5.2. Auto-Generated Mock Generators

Every compiled IR type programmatically exposes a deterministic generator function (e.g. `ZetaAST.sample(seed: Int) -> T` or F#'s `Generator.sample<'T>()`):

- Uses standard PRNG seeds to generate high-fidelity, structurally valid mock instances of the type.
- Serves as the test harness for property-based testing and cross-language serialization comparisons. If all 6 languages execute the generator with the same seed, they must produce identical canonical outputs (e.g. `canonical-json` byte streams).

### 5.3. Homoiconic `.lines` Cartridges

For every compiled type, the build tool generates a companion `.lines` cartridge file under `db/shapes/cartridges/` (e.g. `db/shapes/cartridges/zeta-observation.lines`):

- **Metadata Registration**: Formally registers the type’s `ZetaId` and metadata.
- **Law Definitions**: Defines known-answer algebraic identities and constraints (e.g. `law field-count` or `law byte-budget`).
- **Treaty Assertions**: Lists the ratification status for all 6 language oracles (TS, F#, C#, Rust, Go, Python). An oracle cannot claim ratification unless it passes the cartridge's local verification check.
- **Visual Shape Preview**: Integrates with the `zeta shape render` tool to generate interactive visual projections (SVG/HTML) of the type's memory structure.

This guarantees that the entire compiler pipeline is self-documenting, verifiably stable, and audit-ready across all platforms.

### 5.4. Static Enforcement of the 7 Always-Active Disciplines & 13 Manifesto Specs

To ensure the generated code is correct and secure, the ZetaParse compiler pipeline embeds the **7 always-active engineering disciplines** (from `.claude/rules/dv2-data-split-discipline-activated.md`) and the **13 root specifications** (from `.claude/rules/manifesto-13-specifications.md`) directly into the compiler's output generation logic. By translating these specifications into static types, structural invariants, and compile-time lint rules, we make violations of these core tenets **statically impossible** or **automatically lint-rejected** in the generated targets.

#### Statically Enforced Invariants (Correct by Construction)

1. **Idempotency (Discipline 6 / Spec 12)**:
   - All generated update and mutation interfaces default to idempotent semantics (e.g. content-addressed payloads, upsert-by-key, or compare-and-swap state containers).
   - The code generator forbids generating simple "increment" or "append-without-deduplication" operations on the generated IR types.
2. **Noninterference / Entropy Quarantine (Discipline 7 / Spec 13)**:
   - Generated logic is 100% pure and stateless. The compiler is blocked from emitting code that references ambient environment clocks, global threadpools, system allocators, or asynchronous task escapes (like `Task.Run` in C# or unmonitored goroutines in Go).
   - Any external influence or side-effect (e.g. time, identity, randomness) must be threaded explicitly as injected arguments or `Source` streams.
3. **Lock-Free / Wait-Free & Scale-Free (Disciplines 1 & 2 / Specs 1 & 2)**:
   - Generated code constructs are strictly immutable and asynchronous-by-default.
   - The generator is structurally blocked from emitting blocking primitives (such as mutexes, semaphores, or synchronous sleep calls) or code that relies on shared mutable state.
4. **Deterministic Simulation Testing (Discipline 4 / Spec 7)**:
   - Because all generated operations are pure state-transitions and are fed deterministically from explicit PRNG seeds, any execution path can be completely and reliably replayed in simulation testing.

#### Lint Rules Enforced during Code Generation

- **Opaque Blobs Rejection (BP-09 / Spec 8)**: The code generator lints the generated outputs to verify that all serialized states map to readable, git-diffable ASCII structures. The compiler will reject any attempt to generate binary payloads or base64-encoded strings inside the primary IR type contracts.
- **Data Vault 2.0 Partitioning (Discipline 5 / Spec 8)**: The schema validator audits code generation to ensure clear separation of change rates: stable keys (hubs) are separated from relationships (links) and rapidly shifting data payloads (satellites) at the type definition layer.
