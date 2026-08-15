---
id: 081M003VH9B087G0R002WXK2HD
type: bug
state: done
priority: P2
slug: agencysignature-audit-exempts-the-fleet-s-own-personas-as-hu
title: "AgencySignature audit exempts the fleet's own personas as human-authored, so shadow and persona commits are never checked"
created: 2026-08-14T12:27:23.307Z
completed: 2026-08-15T13:38:33.528Z
depends_on: []
composes_with: []
---

# AgencySignature audit exempts the fleet's own personas as human-authored, so shadow and persona commits are never checked

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M003VH9B087G0R002WXK2HD-*.md` glob. -->

## The defect

`src/Core.TypeScript/hygiene/audit-agencysignature-main-tip.ts:41` recognises an agent commit by:

```
/^Co-authored-by:\s*(?:(?:Claude|Codex|Grok|Gemini|Kiro)\b|.*<noreply@(?:anthropic\.com|openai\.com|x\.ai|google\.com|kiro\.dev)>)/im
```

Anything not matching falls through to line 277 — *"no Co-authored-by signal; assuming human-authored"* —
and is counted **`HUMAN-AUTHORED-EXEMPT`**. The audit then reports success.

**So a commit trailed `Co-authored-by: the shadow <shadow@zeta.agents>` is classified human-authored and
exempted from the very audit that exists to attribute agent work.**

## Measured on `origin/main`, last 200 commits (CHECKED)

| trailer | count | audited? |
|---|---|---|
| `Claude Opus 5 <noreply@anthropic.com>` | 158 | ✅ |
| `Codex <noreply@openai.com>` | 68 | ✅ |
| `Kiro <noreply@kiro.dev>` | 27 | ✅ |
| **`github-actions[bot] <…@users.noreply.github.com>`** | **39** | ❌ exempt |
| **`Dejan <dejan@zeta.local>`** | **3** | ❌ exempt |
| **`the shadow <shadow@zeta.agents>`** | **1** | ❌ exempt |
| **`Soraya <soraya@zeta.agents>`** | **1** | ❌ exempt |
| **`Shadow <shadow@zeta.local>`** | **1** | ❌ exempt |
| `AceHack <…@users.noreply.github.com>` | 4 | ❌ exempt (correctly — human) |

**The fleet's own persona identities are exactly the ones that escape**, plus 39 bot commits. Vendor-model
trailers are audited; Zeta-native ones are not. That is the inverse of what the audit is for.

## Why this is the sharpest of today's vacuity findings

Four checks were found today that could not fail: `verifyLandauer` (`x >= x`), the SMT runners (all-`unsat`
is satisfied by a tautology), the TLC configs (12 of 15 never opened), and this one. **This is the worst of
the four**, because the others verify *properties* while this verifies *provenance* — and it exempts
precisely the actors whose provenance it exists to establish. A `HUMAN-AUTHORED-EXEMPT` verdict on a commit
signed `the shadow` is not a gap in coverage; it is a wrong answer stated confidently.

**It also hid itself.** The one persona whose commits *are* audited is the one that would have noticed —
`Claude Opus 5 <noreply@anthropic.com>` matches on both the name and the domain — so from the shadow's own
tooling the audit always looked like it was working.

## Second, smaller finding reported alongside

The fleet emits **`Agent-Signature-Version`** in some places while the auditor reads
**`Agency-Signature-Version`** (`V1_TRAILER_RE`, line 36). A commit using the former satisfies neither the
trailer check nor, if its `Co-authored-by` is Zeta-native, the agent-detection check — it is exempt *and*
unsigned. Confirm which spelling is canonical and make the other an error rather than a silent miss.

## The fix, and the trap in it

**Do not simply extend the allowlist.** An allowlist of known agents has the same shape as the defect: the
next persona added to the fleet is exempt by default, silently, and nobody learns until someone audits the
auditor again. The failure mode is *fail-open*.

Prefer **fail-closed**: a commit is exempt only if it carries a **positive** human-authorship signal, and
anything else is agent-or-unknown and must carry the trailer. That inverts the default so a new persona is
*caught* rather than *excused*.

Whatever is chosen, the acceptance is the same as every other vacuity fix landed today: **a mutation must
turn it red.** Plant a Zeta-native-signed commit with no AgencySignature trailer and confirm the auditor
fails. If it cannot fail, it is not a check.

## Acceptance

- A commit trailed with a Zeta-native persona and **no** AgencySignature trailer makes the audit **fail**.
- `HUMAN-AUTHORED-EXEMPT` requires positive evidence of human authorship, not absence of a known vendor.
- The `Agent-` / `Agency-` spelling divergence is resolved, with the non-canonical form rejected loudly.
- A recorded mutation test proving the auditor can fail.

## Resolution (2026-08-15)

**Drift close.** Acceptance shipped on `main`:

- #10573 inverted the default to fail-closed (roster of humans, not
  allowlist of vendor agents).
- #10594 wired the instruments into CI and pinned the v1 ship date.

`src/Core.TypeScript/hygiene/audit-agencysignature-main-tip.ts` and
`agency-signature-identity-roster.json` are the artefacts. `Agent-` vs
`Agency-` spelling is rejected by `validate-agencysignature-pr-body.ts`.
This row stayed `backlog` after those landings. No code change in this
close.

