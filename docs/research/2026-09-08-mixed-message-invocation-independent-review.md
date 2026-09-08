# Fixed mixed-message invocation: independent source review

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade independent source review
Lifecycle: active
Disposition: bounded invocation repairs and withdrawal clarification accepted
Work item: 081M1Z63YMC087G0R003N5FH9X

This review binds root commit `50610f19139cdcf2b75ad20bd2458e4a0db065ca`.
Its `registered-source/invoke.py` remains exactly the repair from
`7fd2dee110b0ac055b38dc40532bd37b1c1781ad`, SHA256
`CC7FBF89E681909374591516B4227F3D93373E9B5F089C039994B0CA46055E69`.
The final commit corrects three README links; all three resolve to files at
that immutable pin. The reviewer read the complete invocation and README,
the actual `_observe` and `read_exact` helper boundaries, and the separate
withdrawal clarification. No invocation, bridge, peer, learner, native producer,
interval reference or named control was executed by this review.

## Two retained findings and repairs

The original manifest read could block while opening a FIFO, before checking
that its descriptor was regular. The owner's original isolated fixture reached
READY and then expired its 500-ms watchdog. The repaired caller retains lstat's
actual result, supplies its observed length to the existing descriptor-relative
reader, and records that reader's actual return before manifest admission.
The reader opens nonblocking/no-follow, checks the same descriptor is regular,
enforces the 64-KiB cap before expansion, reads at most the initial size plus
one, and checks the observed metadata again. The independent expected manifest
hash still governs later source admission. This is the declared stable local
namespace boundary, not a guarantee against all filesystem or process failure.

The original finalization/console path could replace an established session or
plan exception. The repaired `_observe` calls retain ordinary returned and raised
outcomes separately. `finish` retains the exact returned BridgeResult before
attempting its console summary; a later finish or console exception does not
erase the earlier caller observation. The actual invocation outcome and the
separate CallerObservations console attempt are similarly retained. The bounded
stderr fallback is one attempt. The full actual result stays in the local
holder; the console is a summary and cannot substitute for missing Store records
or guarantee delivery after an I/O failure. These claims cover the inspected
ordinary-Exception path, not catastrophic termination or arbitrary hostile
exception implementations.

The retained final FIFO fixture refuses and exits 2 without watchdog expiry.
Two synthetic retention controls separately distinguish session-plus-finish
failure and a returned synthetic BridgeResult followed by console failure.
They establish those local seams, not real bridge or numerical execution.
Earlier formatting and two mypy narrowing failures remain distinct from the
final unchanged-source Ruff, format and strict mypy passes.

## Finite route and withdrawal scope

The invoker has exactly the registered M4 and M5-plus-frozen-query modes. It
does not select numerical parameters, retry a failed route or calculate a
replacement learned result. M4's zero exit reports closure, with its numerical
success/refusal interpretation still assigned to the coordinator. M5 constructs
each dependent plan from the actual previous sealed result, stops on an unmet
prerequisite and attempts finalization once. The separate frozen query requires
the four-session work/custody observations, uses the two actual returned learned
artifacts and enters no replacement fitting. Its separate budget is the already
registered query scope, not a fifth M5 session or a refund to that route.

The unchanged withdrawal clarification from
`87bc6b28aa1d0ef780accf592b99ce70a16283e6` is 4448 bytes, SHA256
`99576A0F9113839905463FF43CB35FF224524EDF8C207F38C7089984E7914DEE`.
It accurately names the absent general training-ancestry carrier. For a supplied
cut with retractions, refusing selected learned artifacts, retained weights and
inherited child forecasts/cuts is a conservative boundary. Cold-start fitting
on active rows can still produce a newly budgeted artifact; ParentVersion is
publication history, not authorization to reuse weights. Pure-site compensation
remains distinct. This does not prove selective invalidation, complete disclosure
of external withdrawals or global revocation across independent callers. Core
and bridge enforcement must be bound separately in assembled admission.

## Independent custody and remaining admission

The [independent audit](mixed-message-epoch/2026-09-08/invocation-independent-review/manifest.json)
checks all 53 stored, decompressed, local-original and immutable-commit record
identities: 129505 original bytes and 50103 stored bytes. It also binds five
inspected source/helper/document identities. The three special FIFO entries
were not opened; the owner's mode-only records remain explicit. An initial
read-only manifest inspection assumed an `Original` key; the actual schema uses
`OriginalPath`. That scratch inspection stopped before the independent audit,
which uses the declared schema and passed on its first execution.

No remaining material source issue was established within this finite calling
and retention scope. Exact assembled source/service manifests, full integration
validation, outer process custody and independently judged named observations
remain required. This review neither opens those routes nor promotes a console
summary or matching hash into evidence of execution.
