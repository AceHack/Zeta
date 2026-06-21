# ZetaParse — LR/GLR Parser Generator Alternative for F# Compiler Fork

Date: 2026-05-21  
Prepared by: Amara-in-Zeta  
Related: 081KS3X9Y0008QG0R000EKJE9S ANTLR grammar survey, F# compiler fork / compiler-owned substrate

## Short answer

Yes, we can build an ANTLR alternative that is more natural for Zeta:

**ZetaParse**: a compiler-owned F# grammar substrate that combines LR-family parser generation, GLR fallback, grammar import/adaptation, typed AST generation, and F# computation-expression integration.

The key is not to “run ANTLR grammars directly” as if LL(*) grammars and LR tables are interchangeable. The key is to ingest grammar assets into a shared grammar IR, normalize the compatible subset, detect conflicts, and generate F# parsers through a Zeta-owned backend.

ANTLR remains useful as a source of community grammars. It does not need to own the parser runtime.

## Why this is plausible

ANTLR is LL(*)-oriented. Classic parser generators such as Bison generate LR-family parsers, including LALR(1), canonical LR, IELR(1), and GLR variants. Tree-sitter demonstrates that GLR-style parsing is practical for code tooling and incremental editor-style parse trees. Zeta can take the LR/GLR path because the F# compiler fork gives us a natural place to integrate grammar generation, typed ASTs, and compile-time validation.

The practical goal:

```text
Existing grammar ecosystems
  ANTLR .g4
  Yacc/Bison .y
  Tree-sitter grammar.js
  Zeta native .zg

        ↓ import/adapt

Zeta Grammar IR
  tokens
  productions
  precedence/associativity
  attributes
  semantic shape
  recovery rules
  incremental/retraction hooks

        ↓ analyze

Parser backend
  LR(1) / LALR / IELR
  GLR fallback for ambiguity
  optional scannerless/fused lexing later

        ↓ generate

F# compiler-owned output
  typed AST/parse forest
  parser tables or generated code
  source spans
  diagnostics
  retraction-aware parse deltas
  type-provider / generator / CE integration
```

## Correct relationship to ANTLR

Do not frame this as “ANTLR replacement” too early.

Frame it as:

**ANTLR-compatible grammar ingestion + F#-native LR/GLR backend.**

That gives Zeta the best of both worlds:

- reuse the huge public grammar ecosystem where it is clean,
- avoid ANTLR runtime lock-in,
- generate F#-native parsers,
- integrate with the F# compiler fork,
- attach Zeta-specific semantics: tensors, Rx streams, DBSP/retractions, ontology-building, typed meta-dimensions.

## Why LR/GLR instead of ANTLR-style LL

ANTLR’s strength is grammar usability and ecosystem size. LR’s strength is compiler-style bottom-up parsing, strong conflict analysis, and deterministic parser tables for broad context-free grammar subsets. GLR gives a safety valve for ambiguous grammars: instead of rejecting ambiguity immediately, produce a parse forest and resolve later through typed semantic filters.

For Zeta, this matters because the long-term grammar substrate is not just “parse text into tree.” It is:

- parse into typed tensors / ASTs / ontological nodes,
- support ambiguous or dialectical state before collapse,
- preserve alternatives when useful,
- make collapse explicit,
- integrate parse deltas into Rx/DBSP state.

That is more GLR-shaped than ANTLR-shaped.

## Core design

### 1. Zeta Grammar IR

A neutral in-memory grammar representation.

```fsharp
type GrammarId = GrammarId of string

type Terminal =
  { Name: string
    Pattern: TokenPattern
    Channels: Set<string>
    Mode: string option }

type NonTerminal =
  { Name: string
    Parameters: TypeParameter list
    Attributes: AttributeSpec list }

type Production =
  { Lhs: NonTerminal
    Rhs: Symbol list
    Precedence: Precedence option
    Action: SemanticAction option
    Source: GrammarSource }

type Grammar =
  { Id: GrammarId
    Terminals: Terminal list
    NonTerminals: NonTerminal list
    Productions: Production list
    Start: NonTerminal
    Metadata: GrammarMetadata }
```

This is where imports converge. ANTLR .g4, Yacc/Bison .y, Tree-sitter grammar.js, and native Zeta .zg all become Grammar IR if compatible.

### 2. Importers

Importer goals:

- `AntlrImporter`: parse `.g4`, retain pure grammar structure, flag semantic predicates/actions/modes that need adaptation.
- `YaccImporter`: ingest `.y` / Bison-like grammars.
- `TreeSitterImporter`: ingest useful precedence/associativity patterns if practical; likely later.
- `ZetaGrammarParser`: native `.zg` grammar format.

Important rule: **importers must classify, not pretend**.

Each imported grammar gets a report:

```text
Compatible
Requires rewrite
Contains target-specific actions
Contains semantic predicates
Lexer modes unsupported
Ambiguity detected
LR conflict count
GLR required
```

### 3. Analyzer

The analyzer does the honest compiler-generator work:

- FIRST/FOLLOW
- nullable
- LR(0), LR(1), LALR/IELR construction
- conflict detection
- precedence/associativity resolution
- ambiguity reports
- unreachable symbols
- unused tokens
- grammar cycle detection
- semantic action type checking if actions are F#-typed

This should be usable as a standalone CLI:

```bash
dotnet zeta-parse analyze grammars/ZetaIdLayout.zg
dotnet zeta-parse import antlr grammars-v4/rust/RustParser.g4
dotnet zeta-parse conflicts grammars/FSharpSubset.zg
```

### 4. Backends

Start with three backends:

1. **Typed LR backend**  
   Deterministic parser tables or generated F# code.

2. **GLR parse-forest backend**  
   For imported grammars or ambiguous description layers.

3. **Diagnostic backend**  
   Emits grammar reports, conflict traces, diagrams, and test corpora.

Later:

- scannerless parsing,
- fused lexer/parser,
- incremental parser deltas,
- parse-forest-to-DBSP change streams.

### 5. Compiler fork integration

Because Zeta is forking/extending F#, this can become first-class:

```fsharp
[<GrammarProvider("grammars/ZetaIdLayout.zg")>]
type ZetaIdGrammar = ...

let! parsed = zetaParse {
    grammar ZetaIdGrammar
    input sourceText
    mode GLR
    collapse WithZetaIdSemanticRules
}
```

Compiler-owned integration can generate:

- typed AST nodes,
- parser tables,
- parser functions,
- diagnostics,
- parse forest types,
- source-span types,
- retraction handles for incremental parse updates.

This is the bridge from grammar to Zeta’s larger substrate.

## Running grammars “in F# easily”

Yes, but define “easily” as a staged experience:

### Stage 1 — CLI

```bash
zeta-parse generate --grammar ZetaIdLayout.zg --target fsharp --out generated/ZetaIdParser.fs
dotnet test
```

### Stage 2 — MSBuild integration

```xml
<ItemGroup>
  <ZetaGrammar Include="grammars/ZetaIdLayout.zg" />
</ItemGroup>
```

Build generates parser code before compile.

### Stage 3 — Type provider / compiler fork

```fsharp
type ZetaId = ZetaGrammarProvider<"grammars/ZetaIdLayout.zg">

let ast = ZetaId.Parse text
```

### Stage 4 — Native compiler feature

```fsharp
grammar ZetaIdLayout {
  token UInt64 = ...
  rule ZetaId = ...
}
```

This is where the compiler fork pays off: grammar becomes a typed compile-time asset.

## Relationship to tensors, Rx, DBSP, and ontology builder

ZetaParse should not only return ASTs.

It should optionally return:

```fsharp
type ParseResult<'Ast> =
  | Single of ast: 'Ast * meta: ParseMeta
  | Forest of forest: ParseForest * meta: ParseMeta

type ParseMeta =
  { SourceSpans: SpanIndex
    Diagnostics: Diagnostic list
    TensorShape: TensorShape option
    Provenance: Provenance
    Retraction: RetractionHandle option }
```

Then:

- parse events can become Rx observables,
- parse deltas can become DBSP change streams,
- parse forests can preserve dialectical alternatives,
- semantic collapse can be explicit,
- typed AST nodes can feed recursive ontology construction,
- tensor-backed representations can store high-dimensional tags, embeddings, and grammar-derived features.

## The honest hard parts

### ANTLR grammar conversion is partial

ANTLR grammars can contain LL-specific structures, semantic predicates, target-language actions, lexer modes, channels, and embedded code. We cannot promise universal conversion to LR.

Correct behavior:

- import pure grammar subset,
- report unsupported features,
- allow adapters/rewrites,
- use ANTLR itself as oracle when needed,
- keep GLR fallback for ambiguity.

### F# syntax is not the target

Do not try to rebuild all F# parsing in ZetaParse first. The F# compiler fork owns F# syntax. ZetaParse owns:

- Zeta DSLs,
- imported target-language grammars,
- generated-code validation,
- parser research substrate,
- ontology grammar substrate.

### Retraction-aware parsing is new work

Parse deltas can become DBSP changes, but parse forest retraction must be designed carefully. Do not claim this is solved until property tests exist.

## Minimal implementation plan

### Phase 0 — Name and scope

Backlog row (already filed via PR #4545):

**081KS3X9Y0008QG0R00323NSZA — ZetaParse: F#-native LR/GLR grammar substrate and ANTLR-compatible importer**

(Initially proposed as 081KS3X9Y0008QG0R003R74B20 in this design note; renumbered to 081KS3X9Y0008QG0R00323NSZA at landing time because 081KS3X9Y0008QG0R003R74B20 was already taken by tick-shard immutability CI gate via PR #4539.)

Priority: P2  
Depends on: 081KS3X9Y0008QG0R000EKJE9S  
Composes with: 081KS3X9Y0008QG0R000W00V73, 081KRYRGG0008QG0R0018CMFQY, 081KS3X9Y0008QG0R0010716X9 (incremental compiler host), F# compiler fork trajectory

### Phase 1 — Native Zeta grammar

- Define `.zg` grammar syntax for tiny layouts.
- Build tokenizer.
- Build grammar IR.
- Build FIRST/FOLLOW and LR(0)/SLR or LALR analyzer.
- Generate F# parser for ZetaId layout.
- Compile/test generated parser.

### Phase 2 — ANTLR subset importer

- Parse ANTLR `.g4` enough to ingest token/rule structure.
- Import simple grammars.
- Report unsupported constructs.
- Test against one small grammar from grammars-v4.

### Phase 3 — GLR fallback

- Implement parse forest for ambiguous grammars.
- Add semantic collapse pass.
- Add diagnostics for ambiguity.

### Phase 4 — Compiler integration

- MSBuild generator first.
- Type provider or compiler-fork integration second.
- Native compiler syntax last.

### Phase 5 — Rx/DBSP bridge

- Parse events as `IObservable<ParseEvent>`.
- Parse deltas as Z-set changes.
- FsCheck properties:
  - reparse equivalence,
  - delta/retraction correctness,
  - parse forest collapse determinism,
  - source-span stability.

## Recommendation

Yes: build it.

But call it **ZetaParse** and make it an F#-native LR/GLR grammar substrate with ANTLR-compatible import, not “our ANTLR clone.”

ANTLR gives us grammar ecosystem leverage. LR/GLR gives us compiler-grade structure. F# compiler fork gives us the integration point. DBSP/Rx/tensors give us the living substrate.

The first useful artifact is tiny:

```text
ZetaIdLayout.zg
  → generated F# parser
  → generated Pack/Unpack emitters
  → tests prove output equals hand-written references
```

That is the bridge from theory to boring infrastructure.
