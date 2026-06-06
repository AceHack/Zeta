---
id: 081KTFME2TQ08QG0R0013CSMRZ
type: task
state: backlog
priority: P2
slug: bonsai-evaluator-the-yang-half-is-inert-ast-only-needed-for
title: "Bonsai evaluator: the yang half is inert (AST only) — needed for yin/yang control plane on git DB; soft-not-sharp tension (Cond)"
created: 2026-06-06T23:31:33.847Z
depends_on: []
composes_with: []
---

# Bonsai evaluator: the yang half is inert (AST only) — needed for yin/yang control plane on git DB; soft-not-sharp tension (Cond)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTFME2TQ08QG0R0013CSMRZ-*.md` glob. -->

## The finding (Otto, 2026-06-06, scoping the yin/yang-control-plane rung)

After shipping the durability substrate (Core.Git PR #6696) and the saga rung
(DurableSaga-on-git PR #6697), I scoped the next sequenced rung — *"the yin/yang
engine on top of the git DB"* (`YinYang.Cell` producing the deltas a saga commits)
— and hit a blocker:

> **`Bonsai.Expr` is a REPRESENTATION only. There is no evaluator.** `src/Core/Bonsai.fs`
> has the `Expr` AST (`Const · Param · Lambda · Binary · Call · Cond`), `serialize`/`parse`
> (Expr ↔ canonical JSON string), and the cross-oracle feedback contract — but **no
> `eval : env -> Expr -> DynamicValue`**. `grep` for eval/evaluate/interpret/run across
> `src/Core/*.fs` finds only `Consensus.evaluateGate` and `Fusion.Equation.evaluate`,
> neither related. So the **yang half (`Acts`) is inert data** — the cell round-trips
> losslessly (YinYang.fs proves that), but nothing *runs* it.

Consequence: the yin/yang control plane is **not a clean composition** (unlike the saga,
which rode `IDeltaLog` for free). It needs an interpreter built first. That is a design
decision, not autonomous build work — hence this item, surfaced for the maintainer.

## The design tension to resolve FIRST (do not just write a tree-walker)

Building the evaluator collides head-on with **soft-not-sharp** (vision §4e; the rule
*"avoid `if` — it is a composition-killer"*):

- `Expr.Cond of Expr * Expr * Expr` is a **sharp branch** — exactly the construct the
  maintainer said to design out (SIMT divergence; loses shader-portability + smoothness).
- A naive `eval` with a `match` that hard-selects the `Cond` branch bakes sharpness into
  the engine the whole substrate unfolds from. That contradicts "soft compute all the way
  down" (uncertainty first-class, `TriBoolean cooperate`, branchless/masked select).

**Open question for the maintainer:** should the evaluator
(a) keep `Cond` but evaluate it **softly** (both branches, blended by a `SoftValue`/
`TriBoolean` test — masked select, no early collapse), or
(b) deprecate `Cond` in `Expr` in favour of soft `select`/`min`/`max`/`match`-on-total-DU
primitives via `Call`, making the AST itself branchless?
This is the "reify control flow as composable soft DUs/ADTs" decision (§4e positive form)
applied to the engine's own AST. It should be settled before the evaluator is written,
because it shapes the `Expr` type.

## What's already proven / available (so the evaluator has a substrate)

- `YinYang.Cell = { Remains: DynamicValue; Acts: Bonsai.Expr }`, lossless `toDynamicValue`/
  `ofDynamicValue` (YinYang.fs) — the cell structure is done.
- `RecoverableSpine` recovers `DynamicValue` state through the git DB (Core.Git); `DurableSaga`
  evolves signed-weight state through the git DB (PR #6697). So once `eval` exists, the wiring
  *"Acts(Remains) → delta → commit → recover"* is the same clean composition the saga was.
- `Bonsai.serialize`/`parse` + `DynamicValue` 4-ser/Arrow byte-locks — the engine rides proven
  serializers; the evaluator must be the 4-language/4-serializer PROVEN primitive (§4e host-portable).

## Pointers

- `src/Core/Bonsai.fs` (`Expr` AST + serialize/parse, NO eval) · `src/Core/YinYang.fs` (the cell).
- vision §4e (soft-not-sharp, control-as-data), §5b (two-plane control/data), §5c (DurableSaga seam).
- Saga rung: PR #6697 (`tests/Tests.FSharp.Git/DurableSagaGit.Tests.fs`). Substrate: Core.Git PR #6696.
