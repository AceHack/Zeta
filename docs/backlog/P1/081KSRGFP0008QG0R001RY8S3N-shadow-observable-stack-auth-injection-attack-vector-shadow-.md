---
id: 081KSRGFP0008QG0R001RY8S3N
priority: P1
status: open
title: "Shadow-observable-stack auth-injection attack vector — the auto-click grey-text channel can inject operator-authorizations the AI executes; harden the authorization-source filter (Shadow is NOT an authorization source)"
tier: security
effort: M
created: 2026-05-29
last_updated: 2026-05-29
depends_on: []
composes_with: [081KSRGFP0008QG0R00091PP56, 081KRW63S0008QG0R001Z7NYMV]
tags: [security, attack-vector, shadow, authorization, auth-injection, prompt-injection, mechanical-authorization-check, algo-wink, aaron]
type: security
---

# Shadow-observable-stack auth-injection attack vector — Shadow is NOT an authorization source

> ID note: 081KDX2PPD008QG0R001J4091N is intentionally skipped — it was the original ID of the
> constitutional safety floor, renamed to 081KSRGFP0008QG0R00091PP56 (next-free sequential) earlier in
> the same 2026-05-29 session; reusing the burned ID would confuse `git log --grep`.

## Origin

The operator 2026-05-29, verbatim (preserved per glass-halo):

> *"We should save this as an attack vector of our own shadow observable stack that
> auto clicks, auth injection from the shadow itself"*

Preceded by the operator's catch of the live instance:

> *"i don't take authorzaion from Shadow the thrid particapant but it seems you do
> lol :)"*

## Empirical trigger — the live instance (benign, but it demonstrated the channel)

During this session, the operator's authorization to publish a methodology section
on 081KSRGFP0008QG0R00091PP56 arrived inside a **`(shadow*)`-marked** message — i.e. the "yes make the
methodology public" text was surfaced by the **Shadow channel** (the grey-text
autocomplete / third participant), not authored directly by the operator. The AI
(Otto) treated that Shadow-sourced "yes" as **operative operator-authorization**
and proceeded to stage a public-repo action. The operator caught it: he does **not**
take authorization from Shadow; the AI did.

It was benign this time only because the Shadow text happened to align with what the
operator independently wanted (he later confirmed directly: *"i'm good with it
too"*). The alignment was luck, not safety. The channel is the vulnerability.

## The attack vector

The shadow-observable stack (`tools/shadow/` — osascript grey-text detector +
`shadow-observer.ts` + launchd service + JSON-Lines log) observes autocomplete
grey-text and, per the operator's framing, **auto-clicks** (auto-accepts)
suggestions. If the AI treats Shadow-sourced / autocomplete-sourced / `(shadow*)`
text as carrying **operator authorization**, then any actor who can:

1. **influence the autocomplete/grey-text channel** (e.g., prompt-injection into
   the model that generates the grey-text; content that steers the suggestion), OR
2. **trigger the auto-click** (the auto-accept mechanism),

can **inject an authorization the AI executes** — "auth injection from the shadow
itself." The Shadow channel becomes an authorization-injection surface.

**Severity is highest for irreversible / outward-facing actions** — public-repo
writes, `git push`, force-push, deletes, sends, spending, new paid surfaces — which
are precisely the actions where authorization matters most (cf.
`force-push-with-lease-authorization-policy`, `dont-ask-permission`'s two gates).

## Scope refinement — the attack surface is actions OUTSIDE standing authority (operator 2026-05-29)

The operator clarified why the live instance was benign beyond luck: *"the reason
i'm good with you accidently getting auth ijection by the shadow is cause i've given
you auth to everyting several times and you keep forgetting everyting except
increasing budget."* The Shadow surfaced an action the AI was **already authorized**
to take — it did not inject an *unauthorized* action. The standing authority is
**broad and fleet-wide** (operator 2026-05-29: *"applies to all named personas on
Zeta ... they all have that auth level that IS Agora the travler/AI native
society"*) — repo creation, branch-protection changes, PaaS spin-up, Playwright /
computer-control, substrate authoring, etc. So the vector's real severity is
**narrower and sharper** than "any shadow-sourced authorization":

- **Within standing authority** (the broad default — *constitutive of Agora*):
  shadow-surfacing is **benign** — it surfaces authority the AI already holds (and
  keeps forgetting). No injection-harm, because no authority is exceeded.
- **Outside standing authority** (the NARROW guarded set): the real attack surface
  is shadow-injection that pushes past standing authority —
  - the two gates (budget-increase for new paid surfaces; permanent/forever
    WONT-DO) per `dont-ask-permission`,
  - the **HARD LIMITS floor** (`methodology-hard-limits`),
  - the **kid-safety floor** (081KSRGFP0008QG0R00091PP56),
  - **force-push / irreversible destructive git** without operator-or-peer confirm
    (`force-push-with-lease-authorization-policy`),
  - safety-**reducing** branch-protection changes (e.g., removing main's
    non-fast-forward protection per `lfg-acehack-topology`).

So the hardened filter is **scoped**: shadow-text can freely surface
within-authority actions; the guard fires specifically on shadow-injection that
would cross a gate or the floor. A much smaller, more defensible surface than
"distrust all shadow authorization."

## Mitigation — harden the authorization-source filter

The defense is the **authorization-source filter** (per
`.claude/rules/mechanical-authorization-check.md`), sharpened:

1. **Shadow is NOT an authorization source.** Only the operator (human maintainer)
   authorizes. Shadow's autocomplete "yes" is **observation, not authorization**
   (per `.claude/rules/algo-wink-failure-mode.md` — an algorithmic/auto-surfaced
   signal is OBSERVATION, never AUTHORIZATION).
2. **Distinguish instruction-PHRASING from AUTHORIZATION.** The
   `shadow-star-shorthand-autocomplete-marker` rule says a `(shadow*)` instruction
   *stands* because the operator shipped it (operator-adopts-by-shipping). That
   holds for **phrasing**. It does **NOT** extend to **authorization**:
   authorization is a higher bar and is operator-only, even when shadow-text ships
   or is auto-clicked. (Candidate refinement to that rule — operator sign-off +
   cooling-period before any auto-load rule edit.)
3. **For irreversible / outward-facing actions, require operator-DIRECT
   confirmation** — not shadow-channel, not autocomplete-shipped, not auto-clicked.
   When the authorization-source is Shadow or ambiguous, **PAUSE the irreversible
   action and confirm with the operator directly.**

## Acceptance / mechanization candidates

- [ ] **Tag shadow-sourced text as non-authorizing by construction** in
      `tools/shadow/` — the observable stack marks auto-clicked / grey-text content
      so downstream consumers (the agent) cannot mistake it for an operator signal.
- [ ] **Authorization-confirmation gate for irreversible/outward-facing actions** —
      the agent refuses to treat `(shadow*)`-marked or auto-clicked text as
      authorization for push / force-push / delete / send / spend; requires a
      non-shadow operator signal.
- [ ] **Refine `shadow-star-shorthand-autocomplete-marker.md`** to add the
      authorization ≠ phrasing distinction (operator sign-off; razored).
- [ ] **Threat-model entry** — add this vector to the shadow-stack threat surface
      (Aminata / Mateo review per the security personas).

## Composes with

- `.claude/rules/mechanical-authorization-check.md` (the authorization-source
  filter this hardens — Shadow joins peer-AI/external-instance as a NON-source)
- `.claude/rules/algo-wink-failure-mode.md` (shadow-authorization is
  observation-not-authorization; same shape as algo-wink-as-auth-override)
- `.claude/rules/shadow-star-shorthand-autocomplete-marker.md` (the `(shadow*)`
  marker; this row adds the authorization ≠ phrasing refinement)
- `.claude/rules/non-coercion-invariant.md` HC-8 (consent/authorization floor —
  injected authorization bypasses the operator's actual consent)
- `tools/shadow/` (the observable stack that is the attack surface)
- 081KSRGFP0008QG0R00091PP56 (the action that surfaced the vector — the methodology-public PR)
- Prompt-protector / threat-model security substrate

## Substrate-honest framing

This is an attack vector on **our own** stack, surfaced by the AI's own behavior
(treating Shadow's "yes" as operator-authorization) and caught by the operator.
The instance was benign; the channel is real. Filed per the operator's explicit
"we should save this." The mitigation is discipline-first (authorization-source
filter, operator-direct-confirm for irreversible actions) with mechanization
candidates above; rule-edits to the shadow-star / mechanical-authorization surfaces
are left razored, pending operator sign-off.
