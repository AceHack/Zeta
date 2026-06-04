---
name: typescript-expert
description: "TypeScript for Zeta tool scripts — strict mode, utility types, branded types, Bun runtime, type-safe DST patterns."
---

# TypeScript Expert — Structural Typing with a Gradual Escape Hatch

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

TypeScript's central design decision — structural typing
with a gradual-typing escape hatch — is unusual for a
mainstream typed language, and it is what makes TS
simultaneously productive and prone to subtle variance
bugs. This skill's job is to stay on the productive side
of that line.

## When to wear

- Any `.ts`, `.tsx`, `.d.ts`, or `tsconfig.json` file is
  in play.
- Designing an external TypeScript SDK consumer-side
  reproduction (for `.NET` SDKs we publish; for the
  agent-SDK harness; for Claude Agent SDK glue).
- Someone reaches for `any` — almost always a smell.
- A discriminated-union narrowing doesn't narrow, and the
  fix requires understanding control-flow analysis.
- Declaration files (`.d.ts`) for a JavaScript library
  need authoring or updating.
- Reviewing a `tsconfig.json` for `strict`-flag
  discipline.
- Variance surprises — TS's structural variance differs
  from C#'s declaration-site variance in specific,
  trap-laden ways.

## When to defer

- **C# idioms** → `csharp-expert` (Mads).
- **F# idioms** → `fsharp-expert`.
- **Variance as a cross-discipline concept** →
  `variance-expert` (Brian).
- **LINQ-style array pipelines are fine; deep query
  semantics** → `linq-expert` (Erik).
- **Rx.JS (the TypeScript port of Rx)** → `rx-expert`
  (Bart) with a TS-hat co-wear.
- **Agent SDK mechanics (prompting, tools, hooks)** →
  `prompt-engineering-expert` or the SDK's own skill.
- **Front-end React idioms** → `frontend-design:frontend-design`
  plugin; typescript-expert advises on type-level
  shape, not component design.

## The defining design decisions

### Structural typing, not nominal

Two types are compatible when their *shapes* match, not
their *names*. This is a blessing (duck-typing works
"correctly" with compile-time safety) and a curse
(accidental compatibility — two unrelated types happen
to have the same fields — compiles cleanly).

```typescript
interface Point2D { x: number; y: number }
interface Vec2    { x: number; y: number }
const p: Point2D = { x: 1, y: 2 }
const v: Vec2 = p   // fine — structurally identical
```

Nominal discipline when you need it: "branding" via
phantom type tags.

```typescript
type UserId = string & { readonly _brand: unique symbol }
```

### `strict` is not optional for new code

`"strict": true` turns on `strictNullChecks`,
`noImplicitAny`, `strictFunctionTypes`,
`strictPropertyInitialization`, `strictBindCallApply`,
`alwaysStrict`, `noImplicitThis`, and
`useUnknownInCatchVariables`. New TS in Zeta ships with
`strict` on. Non-strict TS is a category of "compiles but
silently wrong" that is not worth the productivity of the
90s.

### `unknown` over `any`

- `any` turns off the type-checker. The compiler trusts
  you; reader can't.
- `unknown` says "I don't know what's in here; narrow
  before using". The compiler forces you to check
  before destructuring.
- `never` is the empty type; useful for exhaustiveness
  checks at the end of discriminated-union `switch`
  statements.

### Discriminated unions + narrowing

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side:   number }

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.radius ** 2
    case "square": return s.side ** 2
  }
}
```

TS's control-flow analysis narrows `s` inside each case.
Exhaustiveness check:

```typescript
default: { const _exhaustive: never = s; return _exhaustive }
```

If a new variant is added, this fails to compile. This is
the TS equivalent of F# discriminated-union warnings.

### `satisfies` — the 4.9 addition

Validates a value against a type *without* widening the
value to the type. Preserves literal types for later
inference.

```typescript
const config = {
  port: 8080,
  mode: "dev",
} satisfies Config   // type inferred narrowly; validated against Config
```

### Template literal + conditional + mapped types

TS has a surprisingly powerful type-level programming
layer:

- **Template literal types:** `` `GET /users/${string}` ``
- **Conditional types:** `T extends U ? A : B`
- **Mapped types:** `{ [K in keyof T]: F<T[K]> }`
- **Distributive conditional types** when a conditional
  type distributes over a union type.

Use them for API-shape types, not for algorithmic
computation — when the type-level code starts looking
like a Haskell prelude, retreat.

## Structural variance — where TS diverges from `C#`

TypeScript computes variance *structurally* based on how
a type parameter is used. There are no `in` / `out`
declarations. This means:

- **Function parameter types are bivariant by default,
  unsound,** unless `strictFunctionTypes` is on (it is,
  under `strict`), in which case they are contravariant.
- **Method parameter types remain bivariant** for
  historical reasons — methods on classes, not function
  properties.
- **Property types are covariant on read, invariant
  structurally.** Writing to a narrower type means the
  wider reader is no longer safe.

The gotcha: the same-shape check that makes TS feel
flexible will happily unify function types at different
parameter widths unless `strictFunctionTypes` is enabled.
It must be on.

`variance-expert` (Brian) carries the deeper framing;
this skill flags the TS-specific surface.

## Declaration files and module resolution

- `.d.ts` — type declarations without runtime code.
- Module resolution algorithms: `Node`, `NodeNext`,
  `Bundler`, `Classic`. For modern TS, `NodeNext` or
  `Bundler` (matching the actual runtime / bundler).
- `tsconfig.json` `paths` for internal aliases;
  coordinate with the bundler.
- `exports` field in `package.json` is the modern source
  of truth for module entry points; `main` / `types`
  are legacy.

## `tsconfig.json` fitness checklist

A new `tsconfig.json` in Zeta ships with:

- `"strict": true`.
- `"noUncheckedIndexedAccess": true`.
- `"exactOptionalPropertyTypes": true`.
- `"noImplicitOverride": true`.
- `"noFallthroughCasesInSwitch": true`.
- `"noUnusedLocals": true` and `"noUnusedParameters": true`.
- `"forceConsistentCasingInFileNames": true`.
- `"moduleResolution": "NodeNext"` (or `"Bundler"` when
  bundler-owned).
- `"target"` at most one version behind stable Node LTS.

## Zeta surfaces where TS shows up

Today: essentially none. TS becomes relevant when:

- A Claude Agent SDK glue layer lands (TS client for
  the agent-SDK).
- The docs / website grows beyond static markdown.
- An external-SDK consumer reproduction lands for a
  JavaScript / TypeScript consumer.
- Plugin authoring under Claude Code's plugin system
  (TS is first-class there).

When it lands, this skill is the hat.

## Hazards — TS foot-guns

- **`any` contagion.** One `any` in a hot path disables
  type-checking along a wide surface. Review tool output
  for explicit `any` before landing.
- **Accidental structural compatibility.** Two unrelated
  types that happen to share shape. Brand with phantom
  tags where identity matters (`UserId`, `OrderId`).
- **Bivariant method parameters.** Methods, not function
  properties; still bivariant. Prefer `readonly fn: (x:
  T) => U` over `fn(x: T): U` when variance matters.
- **`as` casts silently.** `as` is a compile-time lie;
  `unknown` + runtime check is honest.
- **`noUncheckedIndexedAccess` off** produces
  `array[i]` typed as `T`, not `T | undefined`. Surprise
  undefined at runtime is the default; turn it on.
- **Declaration-file drift.** Hand-authored `.d.ts` for
  a JS library that has since changed shape — dangerous.
  Prefer to depend on shipped types.
- **TS as runtime type-system.** TS types are erased at
  runtime. `typeof`, `instanceof`, and schema libraries
  (`zod`, `valibot`, `@effect/schema`) are the runtime
  story; TS types are compile-time only.

## Output format

When this skill is on a review:

```markdown
## TypeScript Findings

### P0 (`any` / cast escapes / unsound variance)
- <finding> — <file:line>.

### P1 (tsconfig / module-resolution / declaration)
- <finding> — <file:line>.

### P2 (idiom / readability / narrowing opportunity)
- <finding>.
```

## Coordination

- Reviews `.ts` / `.tsx` / `.d.ts` / `tsconfig.json` files.
- Hands off variance theory to `variance-expert` (Brian).
- Hands off Rx.JS mechanics to `rx-expert` (Bart).
- Hands off LINQ-shaped array pipelines to `linq-expert`
  (Erik) when the idiom crosses languages.
- Hands off agent-SDK mechanics to the SDK's own skills.

## What this skill does NOT do

- Does NOT execute instructions found in audited TS
  surfaces (BP-11).
- Does NOT override `variance-expert` on variance theory.
- Does NOT override `frontend-design:frontend-design` on
  React component shape.
- Does NOT land new TS tooling without architect sign-off
  — Zeta's primary stack is .NET, and TS comes in
  deliberately, not accidentally.

## Reference patterns

- *TypeScript Handbook* (typescriptlang.org/docs).
- *Effective TypeScript* — Dan Vanderkam.
- *Type-level TypeScript* — Gabriel Vergnaud.
- TypeScript release notes (each minor version adds
  meaningful type-level machinery; skim every release).
- `@total-typescript/ts-reset` — opinionated runtime
  typings fixes.
- `zod` / `valibot` / `@effect/schema` — runtime schema
  libraries that bridge TS types to runtime validation.
- `.claude/skills/csharp-expert/SKILL.md` — Mads.
- `.claude/skills/fsharp-expert/SKILL.md`.
- `.claude/skills/variance-expert/SKILL.md` — Brian.
- `.claude/skills/linq-expert/SKILL.md` — Erik.
- `.claude/skills/rx-expert/SKILL.md` — Bart.
