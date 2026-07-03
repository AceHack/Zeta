---
pr_number: 3235
title: "feat(b-0488): KSK (Kinetic Safeguard Kernel) persona map"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T20:45:20Z"
merged_at: "2026-05-14T20:48:18Z"
closed_at: "2026-05-14T20:48:18Z"
head_ref: "otto/b0488-ksk-personas-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T20:55:47Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3235: feat(b-0488): KSK (Kinetic Safeguard Kernel) persona map

## PR description

## Summary

Per-product persona doc for KSK (Kinetic Safeguard Kernel) using the 081KRHWGX0008QG0R00019453T template. Closes [081KRHWGX0008QG0R001HDK688](../backlog/P1/081KRHWGX0008QG0R001HDK688-ksk-persona-map-2026-05-14.md) which unblocks 081KRHWGX0008QG0R000WGP5AQ/081KRHWGX0008QG0R002XVHSG5 skill-mapping work.

## Personas defined

**Primary (3)**:

- `ksk-agent-developer` — engineers integrating "am I allowed to do this?" checks into AI agents
- `ksk-robotics-designer` — consent-first robotics / actuator system designers (NVIDIA Thor Homeland-Security clearance lineage)
- `ksk-security-engineer` — engineers building KSK itself in `Lucent-Financial-Group/lucent-ksk`

**Secondary (1)**: `ksk-clearance-deployer` — Homeland-Security / clearance-aware deployers

**Adjacent (1)**: `ksk-compliance-auditor` — SOC 2 / HIPAA / ISO 27001 auditors consuming KSK signed receipts

**Refused (2 — HARD LIMITS)**:

- `ksk-refused-weapons-control` — autonomous-weapons / kill-chain designers using KSK as a "consent UI" wrapper. Per `methodology-hard-limits.md` HARD LIMITS #1 + #3: laundered consent + violates consent-first design intent (PR #2892).
- `ksk-refused-apt-operator` — nation-state APT operators using KSK as a privilege oracle (receipt-replay, authorization enumeration, "stealth mode" feature requests). Per `mechanical-authorization-check.md`: not in the authorization-source list.

## Why the refused-persona list is load-bearing

KSK's terminal purpose is **human-in-the-loop refusal of impactful AI actions**. A weapons-system integration would launder the appearance of consent (the receipts say "authorized" but the operator never had meaningful refusal). An APT integration would use KSK's transparency against its own purpose (mapping authority topology). Both are structural adversaries, not off-target customers.

## Acceptance criteria

- [x] Template from [081KRHWGX0008QG0R00019453T](../research/2026-05-14-persona-mapping-framework-b0485.md) applied
- [x] Primary personas fully documented (3, exceeds the "grey-hat / ethical researcher" minimum — folded that framing into `ksk-security-engineer`)
- [x] At least 2 refused personas with explicit HARD LIMITS rationale (R1 + R2)
- [x] Output doc at `docs/personas/ksk-personas.md`
- [x] 081KRHWGX0008QG0R001HDK688 status: `open` → `in-progress` (closes on merge)
- [ ] 081KRHWGX0008QG0R000WGP5AQ `composes_with:` pointer backfilled (deferred to a follow-up; 081KRHWGX0008QG0R000WGP5AQ row may not exist yet — needs scoping)

## Test plan

- [x] `markdownlint-cli2` clean on both files
- [x] Composite-guard used for the commit: `test "$(git branch --show-current)" = "<expected>" && git commit`
- [x] `gh pr create --head` explicit ref used
- [ ] CI clears
- [ ] Auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T20:48:48Z)

## Pull request overview

Adds the KSK (Kinetic Safeguard Kernel) per-product persona map using the 081KRHWGX0008QG0R00019453T template, and updates the associated backlog row to reflect active work on 081KRHWGX0008QG0R001HDK688.

**Changes:**

- Add `docs/personas/ksk-personas.md` defining primary/secondary/adjacent/refused KSK personas (with HARD LIMITS rationale).
- Update `docs/backlog/P1/081KRHWGX0008QG0R001HDK688-ksk-persona-map-2026-05-14.md` status from `open` to `in-progress`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/personas/ksk-personas.md | New KSK persona-map document (template-structured), including refused personas + detection/response notes. |
| docs/backlog/P1/081KRHWGX0008QG0R001HDK688-ksk-persona-map-2026-05-14.md | Backlog row status update for 081KRHWGX0008QG0R001HDK688. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/personas/ksk-personas.md:375**

* P1 (name-attribution policy): This section repeats direct named attribution (e.g., “Aaron + Amara’s …”) inside a current-state `docs/personas/**` doc. Per `docs/AGENT-BEST-PRACTICES.md` “No name attribution in code, docs, or skills” (around lines 671–760), prefer role-refs here and keep named provenance on the allowlisted history surfaces (e.g., link to the relevant `memory/**`/`docs/research/**` artifact that preserves the attribution).
```
2. Compromise the protective lineage (KSK's reputation is its value;
   weapons-system integration destroys it)
3. Violate the consent-first design intent (PR #2892 — Aaron + Amara's
   consent-first design origin)
```
</details>

## Review threads

### Thread 1: docs/backlog/P1/081KRHWGX0008QG0R001HDK688-ksk-persona-map-2026-05-14.md:4 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:48:48Z):

P0 (schema/tooling): `status: in-progress` is not a valid backlog-row status per `tools/backlog/README.md` (allowed: `open` / `closed` / `superseded-by-B-NNNN` / `deferred` / `decomposed`). Please change this back to a supported value (typically keep `open` until the work is actually complete, then set `closed` with `closed`/`closed_by`).

### Thread 2: docs/personas/ksk-personas.md:8 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:48:48Z):

P1 (name-attribution policy): This is a current-state doc under `docs/personas/`, but it introduces direct contributor/persona names (e.g., `**Author:** Otto`, and `Aaron+Amara` in the substrate line). Per `docs/AGENT-BEST-PRACTICES.md` “No name attribution in code, docs, or skills” (around lines 671–760), please rewrite these to role-refs (e.g., “the agent”, “the human maintainer”, “external collaborator”) and/or move the named provenance into an allowlisted history surface (`memory/**` or `docs/research/**`) and link to it from here.

This issue also appears on line 372 of the same file.

## General comments

### @chatgpt-codex-connector (2026-05-14T20:45:24Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
