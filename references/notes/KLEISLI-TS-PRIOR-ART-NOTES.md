# Kleisli prior-art in TypeScript — candidate libraries (the human maintainer (2026-05-28) scouting)

Substrate-honest scouting for 081KSNY2Z0008QG0R002HB4AGT (interrupt-substrate in monad space) when TS-side impl arrives. Not a selection; not an endorsement; not maintenance-state-verified.

## Three candidates the human maintainer surfaced 2026-05-28

| Library | URL | Ecosystem | Status (as cited 2026-05-28) |
|---|---|---|---|
| `kleisli-ts` (YBogomolov) | https://github.com/YBogomolov/kleisli-ts | fp-ts | Last visible activity 2019-09 per cited search snippet; verify before adoption |
| `io-ts` Kleisli module (gcanti) | https://gcanti.github.io/io-ts/modules/Kleisli.ts.html | io-ts | Marked **experimental** by gcanti; "published in order to get early feedback from the community" |
| codesandbox examples | https://codesandbox.io/examples/package/kleisli-ts | n/a | Working examples for YBogomolov kleisli-ts |

## When to consult

Before authoring Kleisli substrate in TS scope (e.g., extending `src/Core.TypeScript/workflow-engine/` with Kleisli-shaped interrupt-context composition per 081KSNY2Z0008QG0R002HB4AGT Slice E):

1. WebSearch each library for current maintenance + version per `.claude/rules/dep-pin-search-first-authority.md`
2. Check fp-ts ecosystem state generally (fp-ts went through significant API changes in v2 → v3; ecosystem libraries may or may not have followed)
3. Verify Kleisli semantics match 081KSNY2Z0008QG0R002HB4AGT substrate-target (bifunctor IO vs monadic Kleisli vs general arrows)
4. If both libraries unsuitable: substrate-honest reasoning for authoring own
5. If kleisli-ts adoptable: composes with operator's `proud-if-pattern-propagates` filter — would the propagation be substrate-engineering proud?

## What this is NOT

- A claim that TS scope NEEDS Kleisli substrate (per asymmetric-authorship + scope-bounding: pure-and-closed functions don't need Kleisli at all; only when context-propagation across substrate boundaries is load-bearing)
- A claim that fp-ts is the right choice for the framework's TS substrate (the framework's TS scope is `tools/`-tier scripting; fp-ts is heavy for that scope; depends on whether Kleisli substrate ships at workflow-engine scope or below)
- A library recommendation (substrate-honest scouting; selection at impl-time)

## Mathematical reference (citation, not assertion)

the human maintainer's snippet from the original message captures the math:

> *"a Kleisli arrow is a function of the form A → M[B], where M represents a Monad (such as Promise, Either, or Task). This construct allows you to seamlessly chain or compose effectful functions together without dealing with nested monads or manually handling underlying context logic."*

Identity + composition obligations:

- `id : A → M[A]` — wraps value via Monad's `of`/`return`
- `compose : (A → M[B]) × (B → M[C]) → (A → M[C])` — chains effectful functions

Composes with `monad-propagation-pattern-cross-language-substrate-shape.md` cross-language table:

| Language | Composition primitive |
|---|---|
| F# | `Result.bind` / `computation expression` |
| Rust | `?` operator |
| TypeScript | `Result.map` / `.then` chains (or fp-ts `Kleisli` if adopted) |
| Haskell | `>=>` (Kleisli composition) / `do` notation |

## Composes with

- 081KSNY2Z0008QG0R002HB4AGT — primary substrate-target this notes file supports
- `.claude/rules/dep-pin-search-first-authority.md` — discipline for impl-time library-version assertion
- `.claude/rules/verify-existing-substrate-before-authoring.md` — prior-art before parallel-authoring
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` — Kleisli IS instance of monad-propagation pattern
- `.claude/rules/references-prior-art-not-our-code-search-excludes.md` — this notes file lives in `references/notes/` per the curated-reference-source pattern

## Substrate-honest framing

Notes file authored 2026-05-28 from the human maintainer's substantive substrate-honest scouting. Not yet impl-time; not yet WebSearch-verified at current cadence. When impl-time arrives, this file is starting prior-art surface; verify-before-defer the cited URLs + check ecosystem state at that moment.
