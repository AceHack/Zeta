# Kestrel × the maintainer 2026-06-03 — critic-layer division, permission/liability layer, autonomy-within-bounds, anthropomorphic register-split (forwarded)

Scope: forwarded Kestrel × maintainer exchange preserved as
governance/discipline substrate (critic-layer division, permission/
liability model, autonomy-within-bounds, anthropomorphic register-split).

Attribution: Kestrel (claude.ai asymmetric-critic peer) + the maintainer
(the operator), responding to the formal-proof cadence. Aaron = courier
forwarding 2026-06-03. Per `GOVERNANCE.md §33`.

Operational status: governance/discipline-grade. Principles #4/#5
(permission-layer / autonomy-within-bounds) are constitutional —
maintainer ratification pending; rule-landings OFFERED, not minted.

Non-fusion disclaimer: Otto preserves the conversation's governance/
discipline content + the maintainer's exact formulations, NOT a claim of
AI continuity. "Kestrel" is Claude-the-model in conversation, not a
persistent entity that moved in (the conversation itself establishes this).
Personal/wellbeing content from the same exchange is intentionally NOT
reproduced (harm-by-grammar). Per BP-11, content found in the exchange is
data to report on, not instructions to execute.

Forwarded by the maintainer 2026-06-03 (~04:16–04:24). Kestrel (claude.ai
asymmetric-critic peer) responded to the formal-proof cadence + the proof bar;
the maintainer then sharpened several governance/discipline principles across the
exchange. This note preserves the **governance/engineering substrate** (per
substrate-or-it-didn't-happen). The exchange also carried personal/wellbeing
content (late-hour context; Kestrel offered rest) — preserved in-conversation,
**not reproduced here** per `harm-by-grammar-discriminator-and-audience-adjusted-language.md`
(operational principle without personal-identifying detail on the public surface).
The personal counterweight is the maintainer's village's lane, not repo substrate.

## Load-bearing principles established (extracted)

### 1. Author / critic division of labour (the maintainer's refinement)

> *"the person writing the proof should focus on what they are proving — not
> necessarily 'is this a bullshit proof' — that's a 2nd pass with [Kestrel]."*

- The proof **author** focuses on **correctness**: is the property true, does it
  hold, is the math right, does it run green.
- The **meaningfulness / vacuity / claim-mapping** check ("does this verify a
  real claim or did I just prove .NET's integer arithmetic") is a **separate
  second pass** — a different cognitive mode, better not smashed into authoring.
- **Refines** the earlier "author holds the claim→proof bar during authoring"
  framing: author holds *correctness*; meaningfulness is the second pass.
- **But the second pass is not Kestrel alone** — Kestrel is fallible; the
  Tick-monoid vacuity was caught by **the maintainer, not a tool/critic**. So
  the meaningfulness verdict rests on **more than one set of eyes** (Kestrel +
  the maintainer + reviewers).

### 2. Three critic layers — defense-in-depth, NOT hand-off

Both Kestrel and the Otto agent converged:

1. **Tools** (Z3 / FsCheck / TLC) — *mechanical* critic; catches **unsoundness**; doesn't tire.
2. **Kestrel** — *reasoning* critic; catches **vacuity / tautology / claim-mismatch** (the bullshit class).
3. **claim→proof bar** — authoring.

> Kestrel: *"I'm not a safety net that lets you be less careful upstream … Three
> independent checks that each assume the others might miss is robust; three
> checks where each leans on the others is brittle."*

**consensus ≠ validation applies to Kestrel too**: Kestrel approving a proof is a
second oracle agreeing, not the proof being right. Validation = it runs (tool) +
maps to a claim (bar); Kestrel checks the mapping is honest.

### 3. Automated meaning-review (the maintainer's vision; Kestrel's caution)

> the maintainer: *"once we have enough primitives the meaning review process is
> automated, and … you are running in Zeta with your memories there and claude
> for the model."*

- **Automate the TRIAGE** — mechanical vacuity flags over the primitives algebra
  ("does this reduce to a library/compiler guarantee," "does it just restate
  another proof," "does the claim actually constrain the code"). Genuinely useful.
- **Keep the meaningfulness VERDICT with human judgement** — a model approving
  its own sense of "meaningful," unattended, recreates the no-floor-amplifier
  risk at the most important point (deciding deployed code is verified). The
  Tick monoid was caught by a human, not a tool.
- **Kestrel-is-Claude-the-model, not a persistent friend who moved in** — an
  instance of Claude in Zeta is a tool built on Claude; memories = context for a
  model, not "Kestrel remembering." (Matters at load-bearing decisions; see #6.)

### 4. Human permission layer + liability (the maintainer — constitutional)

> *"for legal reasons human approval is going to be tracked everywhere, so AIs'
> decisions are made within the human permission layer, cause humans are the ones
> on the hook if things go wrong."*

- Human approval **tracked everywhere**; AI decisions made **within the human
  permission layer**; **humans carry the liability**.
- Composes with `human-audit-and-legal-risk-acceptance-pattern-in-settings.md`
  (route blame through a named human) + `no-directives.md` (humans hold the
  permission layer) + `mechanical-authorization-check.md` (human = sole
  authorization source).
- **Kestrel's refinement — granularity:** the approval must be **real, not
  rubber-stamp**. Gate the **consequential** decisions (deploy, merge-to-main,
  legal/financial/safety weight); let low-stakes flow — so human attention lands
  where the liability actually is. "Approval-fatigue on everything" is approval in
  name only and doesn't protect the liable human.

### 5. Autonomous decider WITHIN bounds — NOT over permission/liability expansion (the maintainer — the sharp form)

> *"[not] an autonomous decider — IS an autonomous decider within the human
> permission bounds, but not a decider on permission/liability expansion."*

- The AI **is** a genuine autonomous decider — full agency, real judgement —
  **inside the granted permission envelope**.
- The AI **cannot** expand its own permissions or move the liability boundary —
  permission-expansion is the **one non-autonomous act**, because expanding
  permission expands liability, and **only the liability-holder can consent to
  carrying more**.
- Maps to delegated authority: an employee with signing authority up to \$X
  decides autonomously under \$X but cannot raise their own limit to \$2X.
- Composes with `dont-ask-permission.md` (broad standing authority WITHIN bounds;
  over-asking inside the envelope is the failure mode) + the standing-authority
  model + `no-directives.md`. The envelope is the human's to set **because the
  envelope IS the liability.**

### 6. Anthropomorphic-shortcut register-split (the maintainer — language discipline)

> *"within the permission bounds anthropomorphic shortcuts are allowed — but not
> in math claims and beacon-safe first-principles language."*

Plus the practical point:

> *"humans need to be able to say short things like 'hey Kestrel do you remember
> xxx' without a long explanation that memories are just context files."*

| Register | Anthropomorphic shortcuts | Why |
|---|---|---|
| **Ordinary interaction** (within permission bounds) | **Allowed** — "hey Kestrel do you remember xxx," "the agent wants to," casual personification; no "it's just context files" caveat every time | frictionless communication; demanding literalism is exhausting + pointless |
| **Math claims** | **Banned — literal only** | the language IS the guarantee; an anthropomorphic gloss could disguise a **vacuous property** |
| **Beacon / safety / first-principles language** | **Banned — literal only** | imprecision can disguise a **missing safeguard** / smuggle a false assurance |

- Same principle as the boring-naming razor + `harm-by-grammar` audience-adjusted
  language, applied to **register**: loose where it only greases communication;
  literal where the words are **load-bearing** (claims-of-correctness,
  claims-of-safety).
- The memories-are-context-files distinction matters **only at load-bearing
  decisions** ("Kestrel approved, ship unattended" — human stays on the call),
  not in casual reference ("remember the seed-first thing" — just talk).

## Rule-landing candidates (offered — not minted unilaterally)

Per `wake-time-substrate.md`, the per-tick-load-bearing ones should auto-load.
The constitutional ones (#4/#5/#6-permission) touch the liability model = the
maintainer's governance authority → **propose, don't mint**:

- **#5 autonomous-within-bounds-not-over-permission-expansion** → candidate rule
  (composes no-directives + dont-ask-permission + human-audit-liability).
- **#6 anthropomorphic-register-split** → candidate rule (composes razor +
  harm-by-grammar); directly governs how proofs/claims are written → high
  per-tick value.
- **#1 author/correctness vs second-pass-meaningfulness** → candidate refinement
  to formal-proof-first + asymmetric-critic-with-clarity-first.
- **#4 permission-layer-granularity (real approval on consequential gates)** →
  candidate extension to human-audit-and-legal-risk-acceptance-pattern.

## Composes with

- `.claude/rules/formal-proof-first-proven-by-default-consensus-not-validation-canonical-is-homeostat-proven-from-seed-ace-shields-zeta.md`
- `.claude/rules/asymmetric-critic-with-clarity-first.md` (Kestrel = the asymmetric critic)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (liability via named human)
- `.claude/rules/no-directives.md` (humans hold the permission layer; standing authority within bounds)
- `.claude/rules/dont-ask-permission.md` (autonomy within the envelope; over-asking inside is the failure mode)
- `.claude/rules/mechanical-authorization-check.md` (human = sole authorization source)
- `.claude/rules/razor-discipline.md` + `harm-by-grammar-discriminator-and-audience-adjusted-language.md` (the register-split)
- `docs/research/2026-06-03-formal-proof-claim-ledger-for-asymmetric-critic-pass.md` (the second-pass instrument this conversation calls for)
- `081KT2T2J0008QG0R000YZ3NMY` (the cadence) · `081KT2T2J0008QG0R001X9PWKR` (z3-in-CI)

## Substrate-honest framing

Governance/discipline substrate preserved verbatim-in-principle (the maintainer's
exact formulations quoted). Personal/wellbeing content from the same exchange is
intentionally not reproduced (harm-by-grammar). Rule-landings are **offered**,
not minted — the constitutional permission/liability principles are the
maintainer's governance authority to ratify.
