---
id: 081M0370B3H087G0R002SZ2APY
type: task
state: backlog
priority: P2
slug: thin-slice-one-markdown-file-that-starts-as-a-spec-naming-a
title: "Thin slice: ONE markdown file that starts as a spec naming a target that does not exist yet, resolves the name on execution, emits an execution event, and renders its own mini-DORA in a query block — the smallest artifact that demonstrates spec-becomes-running-file end to end"
created: 2026-08-15T17:20:23.428Z
depends_on:
  - 081M036ZVSP087G0R001RQD2TH
  - 081M0370143087G0R003H36RDE
  - 081M0370573087G0R001EB507J
composes_with:
  - 081KSE6WT0008QG0R003AJYMD3
  - 081KSV2WD0008QG0R0020P6ZH2
---

# Thin slice — the smallest end-to-end demonstration

## What it is

One file. It opens as a specification containing a **promise** — a name marked
as not-yet-resolved. Running it resolves the promise, executes the resolved
target through the port, appends an execution event, and a query block in the
same file renders the file's own execution history. Read it before running and
it is a spec; read it after and it is a running thing that reports on itself.

That is Aaron's sentence — *"starts as the spec and ends as a running markdown
file that implements the spec"* — reduced to the smallest artifact that can
actually be wrong.

## Why this is the right first thing

Every larger framing of this feature has been proposed and none has been
built. Six rows carry the design (081KSE6WT0008QG0R003AJYMD3,
081KSE6WT0008QG0R0004HV6RR, 081KSE6WT0008QG0R002YBWBB1,
081KSE6WT0008QG0R00102H071, 081KSGS9H0008QG0R00123050G,
081KSGS9H0008QG0R001K8VPV4, plus 081KSV2WD0008QG0R0020P6ZH2), all still
`status: open` nearly three months later, none with a line of code. The
decomposition was never the blocker; the absence of a running instance was.
A single file that works is worth more than a seventh layer of design.

## Deliberately NOT in the slice

Named so that leaving them out is a decision rather than an omission:

- JIT compilation of a missing script — the promise resolves to something that
  already exists. JIT is 081KSE6WT0008QG0R003AJYMD3 Stage 4 and carries the
  provenance gap named in 081KSE6WT0008QG0R002YBWBB1 failure mode 2.
- The MCP wrap and any-AI plug-in (081KSE6WT0008QG0R00102H071). That row's own
  deployment order puts safety layers 1–3 first, and the slice has none of
  them.
- Hat gating, cross-cluster propagation, verbosity rendering, the three-register
  cell taxonomy.
- Anything destructive. The slice's executed target is read-only. That keeps it
  entirely below the leverage class 081KSE6WT0008QG0R002YBWBB1 exists to guard,
  which is why the slice can ship before those guards do — and it stops being
  true the moment the first destructive block is written, so the guard rows
  gate the *second* slice, not this one.

## Acceptance

- [ ] The file is a normal markdown file. It renders correctly on GitHub with
      no plugin. If a reader needs tooling to read it, the "any markdown file"
      property is already lost.
- [ ] Unrun, the promise is visibly unresolved and the check reports it as a
      promise, not as a broken pointer.
- [ ] Run, the promise resolves, the target executes through the port, and an
      execution event lands in the log.
- [ ] The query block renders three metrics for this file.
- [ ] Replay from the recorded event log reproduces the same output at DoP=1.
- [ ] `bun src/Core.TypeScript/backlog/auto-vivify.ts --check` stays green with
      the file present — the promise must not read as a dangling reference.

That last one is the sharpest acceptance criterion in the set: it is the point
where the resolution register (081M036ZVSP087G0R001RQD2TH) and the
future/action grammar have to agree, and it fails loudly if they do not.

## Falsifier

Delete the resolution step and the file must fail to reach a running state.
If the demo still "works" with resolution removed, the promise was decorative.
