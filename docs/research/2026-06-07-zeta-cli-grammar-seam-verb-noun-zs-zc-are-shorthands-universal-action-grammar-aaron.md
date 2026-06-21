# The Zeta CLI is a uniform `zeta <seam> <verb> <noun>` grammar — zs/zc are shorthands (Aaron, 2026-06-07)

Refines the zs/zc surfaces (#6956). Aaron:

> *"or it could be zeta-cell / zeta-shell, or: `zeta` seam(implicit) verb(run) noun(cell); `zeta` seam(implicit)
> verb(run) noun(shell); `zeta` seam(git) verb(clone) zetaid/unique-noun-within-current-scope/namespace;
> `zeta` seam(bus) verb(message) zetaid/unique-noun (otto-cli1); etc."*

## The grammar

The CLI is one uniform sentence:

```
zeta  <seam>  <verb>  <noun>
```

- **seam** — the **integration boundary / plane** the command acts *through*. **Implicit** (omitted) = the local
  cell; or named: `git`, `bus`, … Each seam is where Zeta meets another system. (Term: a *seam* is exactly the
  place where two systems are stitched — the integration point you can act at without editing in place.)
- **verb** — the action: `run`, `clone`, `message`, …
- **noun** — a **ZetaId, or a unique name within the current scope/namespace** (`cell`, `shell`, `otto-cli1`, a
  zetaid). Resolved within the active `zeta` namespace (the #6916 pointer/resolver discipline: a noun is a
  reference resolved in scope).

## Examples (and zs/zc as shorthands)

| Full grammar | Meaning | Shorthand |
|---|---|---|
| `zeta` (implicit) `run` `cell` | run the cell (durable CLI/daemon) | **`zc`** (ZetaCell) |
| `zeta` (implicit) `run` `shell` | run the interpreter/REPL | **`zs`** (ZetaShell) |
| `zeta git clone <zetaid>` | clone a noun via the **git** seam | — |
| `zeta bus message otto-cli1` | message `otto-cli1` via the **bus** seam | — |

So **`zs` / `zc` are sugar** for `zeta run shell` / `zeta run cell` (implicit seam). The general form scales to
every subsystem: pick a seam, a verb, a noun-in-scope.

## Why this is the right shape (it's the universal action grammar, as a CLI)

- **It IS the universal action grammar** (observe-16 / the Xbox-controller universal-action-grammar capture):
  a small, uniform `(context/seam) × (verb/action) × (noun/target)` that covers all surfaces. The CLI is that
  grammar typed for the terminal. One grammar, every subsystem — recursive/self-similar (manifesto §9/§10).
- **noun = ZetaId / unique-in-scope** ties the resolver (#6916): the CLI noun is resolved the same way every
  pointer is (ZetaId exact, or unique name within the namespace). The CLI is a thin verb-layer over the
  pointer/closure substrate (#6932) — `clone`/`message`/`run` act on resolved nouns.
- **seam = the plane/adapter** ties the per-host adapters (git/gitlab/… , 081KSNY2Z0008QG0R002A785QR) and the Ace
  layer-pointers (#6941): a seam is a pluggable integration point. `git`, `bus`, and the implicit-local cell are
  the first seams; more plug in (the resolver-scheme set, #6925).
- **Familiar + learnable:** `git <verb> <noun>` and `kubectl <verb> <resource>` already trained everyone on
  verb-noun CLIs; `zeta <seam> <verb> <noun>` adds the explicit seam (which most CLIs leave implicit/hardcoded).

## Honest scope / peel

- **Design / grammar + naming, not built.** Refines #6956 (zs/zc are now *shorthands*, not the primary surface).
  The grammar (`zeta <seam> <verb> <noun>`), the seam set, and the scope/namespace resolution are to be
  specified + implemented (the zc/zs CLIs become front-ends over this grammar).
- **Naming flag stands:** `zeta`, `zs`, `zc` binary names + the seam/verb vocabulary → `naming-expert` + PATH-
  collision check before public binaries (internal fine; #6956).
- Open: the canonical seam list, the verb set per seam, scope/namespace rules for noun resolution, and how the
  grammar maps to the IDL (verbs as IDL-declared capabilities on a seam?). Likely the CLI grammar is itself
  IDL-described (#6955) — seams/verbs/nouns are capabilities the IDL declares.

## Ties

- **zs/zc surfaces (#6956)** — now shorthands for `zeta run shell` / `zeta run cell`.
- **Universal action grammar** (observe-16; the Xbox-controller capture) — the CLI is that grammar.
- **ZetaId uniform pointer/resolver (#6916/#6925)** — noun = ZetaId / unique-in-scope, resolved in the namespace.
- **Per-host adapters (081KSNY2Z0008QG0R002A785QR) / Ace layer-pointers (#6941)** — seams = pluggable integration planes.
- **Zeta IDL (#6955, 081KTJAEMZW)** — the grammar (seams/verbs/nouns) is likely IDL-declared capability surface.
- **Closures over state (#6932)** — verbs act on resolved nouns (closures) through a seam.

## Beacon anchors

- **Seam** (Michael Feathers, *Working Effectively with Legacy Code* 2004 — a *seam* is a place to alter
  behavior without editing in place; the integration point). · **verb-noun CLI grammar** (git `git <verb>
  <noun>`; kubectl `kubectl <verb> <resource>`; docker) — the learnable precedent; Zeta adds the explicit
  **seam**. · **Universal/subject-verb-object action grammar** (observe-16; the controller capture). ·
  Namespace/scope resolution of identifiers. Honest novelty: none — it records the uniform CLI grammar
  `zeta <seam> <verb> <noun>` (seam = integration plane, verb = action, noun = ZetaId/unique-in-scope), with
  zs/zc as shorthands, unifying the CLI with the universal action grammar and the pointer/resolver substrate;
  design + naming, gated.
