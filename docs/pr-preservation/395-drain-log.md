# PR #395 drain log — `backlog+memory: git-as-DB-interface + WASM-F#/git-storage; both modes require 0`

Drain ferry: 2026-04-24. Resolution commit (review-thread fixes) on top of the rebased branch: `d9e2406`. Auto-merge armed; rebased onto fresh `origin/main` before drain. PR scope is docs+memory only (`docs/BACKLOG.md`, `memory/MEMORY.md`, two `memory/feedback_*.md` files).

Per Otto-250 PR-preservation drain-log discipline: per-thread fields are reviewer, file:line, original comment verbatim, outcome, reply verbatim, resolution commit. Bot handles preserved verbatim per Otto-237.

---

## Thread 1 — `PRRT_kwDOSF9kNM59iCyf`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:6209` (now around line 6290 after edits — WASM-F# row, "Not a dream" subsection)
- **Outcome:** FIX
- **Resolution commit:** `d9e2406`

### Original comment

> P1: "WASM-F# is real today via Blazor WebAssembly + Fable" conflates two different browser strategies: Blazor WebAssembly runs .NET (and can host F# via .NET), while Fable compiles F# to JavaScript rather than WebAssembly. Reword to avoid implying Fable is a WASM runtime and to clarify the intended approach for Mode 2.

### Reply

> Fixed in d9e2406. Reworded to disambiguate: Blazor WebAssembly is named as the actual WASM-F# path (the .NET runtime compiled to WebAssembly, hosting F# directly) and is now stated as Mode 2's intended approach. Fable is called out as the F#→JavaScript alternative (explicitly "not a WASM runtime") that would only apply if a JS-target Mode 2 were preferred over .NET-on-WASM. The two strategies are no longer conflated.

---

## Thread 2 — `PRRT_kwDOSF9kNM59iCyx`

- **Reviewer:** Copilot
- **File:line:** `memory/feedback_git_interface_wasm_bootstrap_zero_requirements_2026_04_24.md:124`
- **Outcome:** FIX
- **Resolution commit:** `d9e2406`

### Original comment

> P1: Same issue as in BACKLOG: "WASM-F# is real today via Blazor WebAssembly + Fable" is potentially misleading because Fable targets JavaScript, not WebAssembly. Consider clarifying whether Mode 2 is Blazor WASM (.NET runtime in browser) vs an Fable/JS approach, or list them as distinct options.

### Reply

> Fixed in d9e2406. The "Why git-as-storage is coherent" section now disambiguates the two strategies: Blazor WebAssembly is the actual WASM path and is named as Mode 2's intended approach; Fable is listed as a distinct F#→JavaScript option (explicitly "NOT a WebAssembly runtime") that would be the alternative if a JS-target Mode 2 were chosen. Listed as distinct options per the suggestion. Same wording shape as the BACKLOG fix so the two surfaces stay consistent.

---

## Thread 3 — `PRRT_kwDOSF9kNM59iCy6`

- **Reviewer:** Copilot
- **File:line:** `memory/MEMORY.md:7` (GIT-AS-DB-INTERFACE + WASM bootstrap entry)
- **Outcome:** FIX
- **Resolution commit:** `d9e2406`

### Original comment

> P2: `memory/README.md` states `MEMORY.md` entries should be "keep entries terse" (and the index is intended to be capped ~200 lines). This newly added entry is extremely long, which makes the index harder to scan and accelerates already-large index growth. Consider shortening the link text to a compact title + date and leaving the detailed summary inside the target memory file.

### Reply

> Fixed in d9e2406 per `memory/README.md` "keep entries terse" guidance. Index entry compressed to compact title + date + one-clause body summary, matching the shape of newer entries (e.g. Otto-276 line 10). Substantive content stays in the linked memory file; the index now reads as a navigable table-of-contents instead of a duplicate corpus. Resolving.

---

## Thread 4 — `PRRT_kwDOSF9kNM59iCzG`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:5830` (admin-UI / SSMS-pgAdmin-class row in `## P2 — research-grade`)
- **Outcome:** FIX
- **Resolution commit:** `d9e2406`

### Original comment

> P1: This item is filed under the `## P2 — research-grade` section, but the text says "Priority P3 / way-backlog". That priority/placement mismatch makes the backlog harder to interpret. Either move the entry to the appropriate P3 section, or update the stated priority to match P2.

### Reply

> Fixed in d9e2406 by updating the stated priority to match section placement (P2). The row sits in `## P2 — research-grade`; the body now reads "Priority P2 / research-grade (UX + design lead time)" so placement and priority agree. Reconciliation direction (update text, not move row) chosen because: (a) the row composes tightly with the Mode 1 bootstrap thesis + git-as-DB-interface row, both currently in the same neighborhood, and moving would fragment the cluster; (b) sibling-PR conflict risk on a row move is higher than a one-line wording fix.

---

## Thread 5 — `PRRT_kwDOSF9kNM59iCzO`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:6253` (WASM-F# + git-as-storage-plugin row in `## P2 — research-grade`)
- **Outcome:** FIX
- **Resolution commit:** `d9e2406`

### Original comment

> P1: Same priority/placement mismatch here: this row sits in the `P2` section but later states "Priority P3 / way-back-backlog". Please reconcile by moving it to a P3 section or updating the stated priority to P2.

### Reply

> Fixed in d9e2406. Two factory-authored framing edits to align with section placement: (a) the row's intro frame "Maintainer 2026-04-24 directive (verbatim, way-back-backlog stretch goal)" now reads "long-horizon research stretch goal" per the suggestion; (b) the in-row priority statement now reads "Priority P2 / research-grade per maintainer (long-horizon stretch goal — section placement matches)". Maintainer's verbatim quote ("huge stretch way back backlog") is preserved untouched inside the `> *"..."*` block per signal-in-signal-out discipline; only factory-authored framing was edited. Same reconciliation direction as Thread 4.

---

## Thread 6 — `PRRT_kwDOSF9kNM59iF6C`

- **Reviewer:** Copilot
- **File:line:** `memory/feedback_github_admin_authority_grant_to_loop_agent_2026_04_24.md:90`
- **Outcome:** FIX
- **Resolution commit:** `d9e2406`

### Original comment

> P1: `GOVERNANCE §31` is cited here as "factory-managed external surfaces", but in `GOVERNANCE.md` item 31 is specifically about Copilot instructions being factory-managed. Please either update this reference to the correct GOVERNANCE rule (and name it accurately) or remove the section number to avoid future readers relying on a wrong citation.

### Reply

> Fixed in d9e2406. Verified GOVERNANCE.md §31 in-tree: it is specifically the "Copilot instructions are factory-managed" clause, not a generic "factory-managed external surfaces" rule. The bullet now reads: "GOVERNANCE — factory-managed external surfaces discipline (the broader pattern; GOVERNANCE §31 itself is specifically the Copilot-instructions case)." This preserves the analogy the original bullet was reaching for (the github-admin grant fits the same shape as factory-managed external surfaces) without misciting §31 as the source of a generic rule.

---

## Thread 7 — `PRRT_kwDOSF9kNM59iF6H`

- **Reviewer:** Copilot
- **File:line:** `memory/MEMORY.md:6` (OUROBOROS BOOTSTRAP and AUTHORITY GRANT entries — top of index)
- **Outcome:** FIX
- **Resolution commit:** `d9e2406`

### Original comment

> P1: `memory/MEMORY.md` index entries are expected to be one-line and terse (per `memory/README.md`), but these two new bullets are very long and include a lot of detail that already lives in the linked memory files. Consider shortening each entry to a brief title + 1 short clause, and keep the rest of the detail inside the memory file itself (also avoids embedding references like `docs/AUTHORITY-REGISTRY.md` before that doc exists).

### Reply

> Fixed in d9e2406. Both entries shortened to compact title + date + one-clause body, matching the shape suggested. OUROBOROS BOOTSTRAP entry no longer duplicates the three load-bearing properties or the Cardano double-meaning (those live in the linked memory file). AUTHORITY GRANT entry no longer enumerates the specific PATCH endpoints (those live in the linked memory file too) and no longer pre-references `docs/AUTHORITY-REGISTRY.md` from the index. The detail is preserved in the linked feedback files exactly as before; only the index projection is leaner. Same fix shape as Thread 3 applied to the third long entry.

---

## Thread 8 — `PRRT_kwDOSF9kNM59iF6I`

- **Reviewer:** Copilot
- **File:line:** `docs/BACKLOG.md:6068` (now line 6135 — protocol-upgrade-negotiation block, "Backwards-compatible" bullet)
- **Outcome:** FIX
- **Resolution commit:** `d9e2406`

### Original comment

> Typo: "an ungraded peer" reads like a grading term rather than "not upgraded". Should likely be "an unupgraded peer" (or similar) since this section is about protocol upgrade negotiation.

### Reply

> Fixed in d9e2406 with the reviewer's suggested wording: "an unupgraded peer". The section is about protocol-upgrade negotiation between Zeta peers and unmodified git clients; "unupgraded" matches the protocol-upgrade vocabulary used in the surrounding bullets ("Cold-start", "Warm-state", "Audit-trail").

---

## Drain summary

- **Threads:** 8 unresolved at start, 8 resolved at end.
- **Outcome distribution:** 8 FIX (every thread).
- **Rebase:** Clean. Rebased the 5-commit branch onto fresh `origin/main`; no conflicts.
- **Resolution commit:** `d9e2406` (single fix commit on top of the rebased branch).
- **Build gate:** N/A — docs+memory-only change.
- **Auto-merge:** armed pre-drain; expected to land once `required_conversation_resolution` clears.
