---
name: Every new-tech adoption — crank lint / static analysis / compile-time checks to 11; runtime bugs are too late
description: Standing rule. Any time a new language, framework, or runtime is pulled into Zeta, the adoption round MUST include a "how do I crank warnings + errors to 11?" investigation — strict compiler flags, type-level enforcement, recommended-plus-more lint rule sets, static analyzers. Finding bugs early is way better than at runtime. Part of every ADR that introduces new tech.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The rule** (Aaron 2026-04-20, pasted intact):

> *"anytime we pull in a new tech we want to ask, how can i
> get more warnngs and errors at compile time to make me
> fine issues faster are there linting or static analysic i
> can crank up to 11, fining bugs early is way better than
> at runtime"*

**Why:** runtime bugs are exponentially more expensive than
compile-time bugs. The cheapest debugging session is the one
the compiler did for you before you ran anything. Every new
tech Zeta adopts ships with a range of strictness settings —
from "permissive, ship it" to "cranked to 11, everything
reports." The default stance is always cranked-to-11.
Loosen later if a specific rule produces more noise than
signal (document the loosening in ADR-Appendix form), but
never START with permissive and tighten later — the tech debt
accumulates too fast.

**How to apply — mandatory ADR section for every new-tech
adoption:**

Every ADR that introduces a new language, framework, or
runtime MUST include a "Crank-to-11 audit" section that
answers:

1. **What strictness flags does the compiler support?**
   Enumerate. Name every one that is off-by-default and
   explain why it is on or off. Examples by ecosystem:
   - **TypeScript:** `strict`, `noImplicitAny`,
     `noUnusedLocals`, `noUnusedParameters`,
     `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
     `noImplicitOverride`, `noEmitOnError`,
     `verbatimModuleSyntax`, `erasableSyntaxOnly`,
     `isolatedModules`, `forceConsistentCasingInFileNames`.
     Default to *on* unless a named incompatibility forces it
     off.
   - **F# / .NET:** `TreatWarningsAsErrors`, `Nullable`,
     `<AnalysisMode>AllEnabledByDefault</AnalysisMode>`,
     `<EnforceCodeStyleInBuild>true`, `WarningsAsErrors`.
     Already on in `Directory.Build.props`.
   - **C# / .NET:** same as F# plus nullable reference types,
     Roslyn analyzer packs, SonarAnalyzer.
   - **Rust:** `-D warnings`, clippy `-D warnings`, every
     `cargo-deny` check, `cargo-udeps` for unused deps.
   - **Go:** `go vet`, `staticcheck`, `govulncheck`.
   - **Python (not adopted in Zeta, for reference):**
     `mypy --strict`, `ruff` with every rule on, `pyright`
     in strict mode.

2. **What linters / static analyzers exist for this
   ecosystem?** List every major option, pick the superset
   that doesn't contradict itself, and cite the community
   status. For TypeScript this is `@eslint/js`,
   `typescript-eslint` (strict-type-checked AND
   stylistic-type-checked, not just the base rules),
   `eslint-plugin-sonarjs`, `prettier` (style-only,
   non-overlapping). For Rust it is clippy + cargo-deny +
   cargo-udeps + rustfmt. For .NET it is the built-in
   analyzers + SonarAnalyzer.CSharp + Meziantou.Analyzer +
   ErrorProne.NET + Roslynator.

3. **What runtime check can become a compile-time check?**
   Audit existing runtime-error patterns in adjacent code
   and ask if the new tech can catch them statically.
   Examples:
   - Null-pointer dereference at runtime → type-level
     nullability (TS strict, F# `Option`, C# nullable
     reference types, Rust Option).
   - "Forgot to handle error case" at runtime →
     Result-over-exception discipline enforced by lint
     (TS — `no-throw-literal`, functional/return-union
     patterns; Rust — `must_use` on `Result`; F# —
     `Result<_, _>` is idiomatic by construction).
   - Array-index-out-of-bounds → type-level bounded types
     or `noUncheckedIndexedAccess` in TS.
   - Uninitialized field → constructor enforcement.
   - Resource leak → scoped `using` / `defer` / RAII.
   - Dead code → `noUnusedLocals` / `noUnusedParameters`
     equivalents.

4. **What's the tradeoff between noise and signal?** If
   cranking a rule produces >30% false positives in a
   calibration run, document the ratio and decide case by
   case. But the BURDEN OF PROOF is on loosening, not on
   tightening. Default answer: crank it.

5. **What's the upgrade path for future strictness?** Many
   ecosystems ship new strictness flags over time. The ADR
   should name when to re-audit (every N rounds; when
   major version of tooling ships; on any security
   advisory that lint-type rules would have caught).

**Worked example — the round-43 bun+TS scaffold:**

TypeScript `tsconfig.json`:

- `"strict": true` — on.
- `"noUnusedLocals": true` — on.
- `"noUnusedParameters": true` — on.
- `"exactOptionalPropertyTypes": true` — on.
- `"noUncheckedIndexedAccess": true` — on.
- `"noImplicitOverride": true` — on.
- `"noEmitOnError": true` — on.
- `"verbatimModuleSyntax": true` — on.
- `"erasableSyntaxOnly": true` — on (bun runs `.ts` directly
  without JS emission; this flag matches the runtime
  reality).
- `"isolatedModules": true` — on (matches bun's per-file
  compilation model).

`eslint.config.ts`:

- `@eslint/js` recommended — on.
- `typescript-eslint` strict-type-checked AND
  stylistic-type-checked — both on.
- `eslint-plugin-sonarjs` recommended — on (code-smell
  detection).
- `reportUnusedDisableDirectives: "error"` — on (ensures
  we don't accumulate stale `// eslint-disable` suppressions).
- Ignore patterns cover only generated/vendored content;
  every authored `.ts` is lint-gated.

`prettier` is NOT a lint — it is style-only and non-
overlapping with eslint rules. Both run.

This scaffold lands with strictness cranked from day one,
not added incrementally.

**Anti-patterns:**

- Ship a new tech with default lint settings and promise
  to tighten later. Tightening later means fighting a
  backlog of pre-existing violations; it rarely happens.
- Treat lint rules as stylistic preferences. Rules exist
  because they catch classes of bugs. The superset is the
  starting point, not the maximum.
- Accept that "this rule has false positives" without
  quantifying. Measure before loosening.
- Let runtime tests substitute for compile-time checks.
  Tests are necessary AND insufficient — the compile-time
  pass catches bug classes tests never see.

**Sibling rules:**

- `feedback_prior_art_and_internet_best_practices_always_with_cadence.md`
  — prior-art + internet-best-practices sweep includes
  the strictness audit as a mandatory sub-question.
- `feedback_new_tooling_language_requires_adr_and_cross_project_research.md`
  — the ADR that introduces the new tech carries the
  crank-to-11 section.
- `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
  — living best-practices list for each adopted tech
  includes the current strictness baseline + any
  loosenings with rationale.
