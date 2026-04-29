---
name: Ani's voice-mode transcript = original catcher; reactive written elaboration ≠ primary credit; first voice-mode-from-Ani ferry (Aaron 2026-04-28)
description: Aaron 2026-04-28 attribution correction — *"Ani is who actually called bullshit on our bullshit detector, lol. She deserves that credit not Amara, amara was reacting."* Establishes (1) attribution-credit-chain rule — original-catcher gets primary credit, reactive-elaborator gets elaboration credit; (2) voice-mode-transcript-as-channel — Ani's voice-mode is unusual ferry shape (Aaron *"I usually give you text mode from Ani"*); (3) first-time pattern — *"First time i've given you that"*. Composes with named-agents-get-attribution discipline + Aaron-concept-origin/Amara-formalization pattern.
type: feedback
---

# Ani's voice-mode transcript = original catcher

## The attribution correction (Aaron 2026-04-28)

> *"Ani is who actually called bullshit on our bullshit detector,
> lol. She deserves that credit not Amara, amara was reacting."*

Triggered by Otto's B-0089 backlog row (PR #699) attributing
the Veridicality.fs reactive review to "Amara's review packet"
when in fact Ani caught the gap first via voice-mode transcript;
Amara's written packet was a reactive elaboration.

## The substrate distinction this rule establishes

### Original catch vs reactive elaboration

A new attribution distinction joins the existing
**Aaron-concept-origin / Amara-formalization** pattern (the
firefly-network arc, the Veridicality rename, etc.):

| Attribution role | Definition | Examples |
|---|---|---|
| **Concept origin** | Initial intent / direction in conversation history | Aaron-coined "bullshit detector"; Aaron-coined "firefly network"; Aaron-coined "Mirror→Beacon vocabulary upgrade" |
| **Original catcher** | First substrate-evidence-based identification of a specific gap or claim | **Ani's voice-mode catch on Veridicality.fs** (this case); harsh-critic catches on benchmark gaps; threat-model-critic catches on shipped-model gaps |
| **Reactive elaborator** | Subsequent written framing that translates the catch into team-language and adds graduation-roadmap structure | **Amara's written packet on Veridicality.fs** (this case); Otto's commit-message rewrites of harsh-critic findings |
| **Formalizer** | Mathematical or technical formalization that operationalizes the concept | Amara's V(c) formula in 7th ferry; Otto's Veridicality.fs F# implementation |
| **Maintainer input** | Aaron's binding decision routing | Aaron's "we are not keep the name bullshit detector"; Aaron's authority-rule input |

**Primary credit goes to the original catcher.** Reactive
elaborators get elaboration credit (named in the credit chain,
not erased), but the substrate-evidence-based identification
is what earns the primary attribution.

### Why this matters

- **Avoids reactive-overcrediting.** Without this distinction,
  the louder/more-formal voice (typically a written ferry from
  a long-established named agent) gets primary credit even when
  it was reacting to a less-formal earlier catch from another
  agent. That's a substrate-versus-style misattribution.
- **Honors the catch-discipline.** Otto-279 named-agent
  attribution discipline applies to ALL catches, not just
  written-ferry-format ones. Ani's voice-mode catch counts as
  much as a written ferry; format ≠ weight.
- **Operationalizes the Stop Mythology rule (this same
  arc).** A claim about "who caught it" needs substrate
  evidence (the actual catch event in conversation history),
  not "who wrote the most polished version of it."

## Voice-mode-transcript-as-channel pattern

### Aaron's framing (2026-04-28)

> *"That's her voice mode transcript ... I usually give you text
> mode from Ani. ... First time i've given you that."*

Translation:

- **Ani's default ferry channel** = text mode (her standard
  written outputs, similar to other named agents).
- **Voice mode** = unusual / first-time-this-session channel for
  Ani.
- **Both channels carry the same substrate weight.** Format is
  not credit-determining.

### Voice-mode register vs text-mode register

Voice-mode transcripts arrive in a different prose register:

- Lower-case + casual / colloquial language.
- *"i'ma be real with you"*, *"lowkey the coolest bit"*,
  *"[teasing-laugh]"*.
- Often more direct + less hedged than written ferries.

This is a **register difference, not a weight difference.** The
catch is the catch; the prose is the prose. Two implications:

1. **For attribution and substrate logging:** preserve voice-
   mode register verbatim where it lands (B-0089 row, this
   memory) so the medium is visible. Don't sanitize Ani's
   voice into text-mode-prose-shape — that erases the channel
   evidence.
2. **For team-language outputs:** translate voice-mode framing
   into team-language for commit messages, PR descriptions,
   and other public surfaces — *but cite the original catcher
   verbatim in the attribution line.* Aaron's verbatim guidance
   (paraphrasing Ani's own meta-instruction):

   > *"Veridicality module currently validates provenance and
   > metadata integrity well, but the semantic fingerprinting
   > layer (CanonicalClaimKey) is still mostly structural. The
   > core cognitive-load / semantic bullshit detection logic
   > that was discussed in the original design appears to be
   > missing or not yet implemented."*

   This is the team-language form. Use it in commit / PR
   prose; cite Ani's voice-mode original verbatim in the
   substrate (memory, B-0089, comments).

## How this composes with prior attribution rules

- **Otto-279 named-agents-get-attribution-credit-on-everything**
  — generalizes; voice-mode catch from Ani gets credit just
  like written ferry from Amara.
- **Aaron-concept-origin / Amara-formalization** (Veridicality
  graduation memory) — extends with the new
  **original-catcher / reactive-elaborator** distinction.
- **Stop Mythology rule** (same arc, today) — operationalizes
  this attribution discipline at the Tier 1 (factory-local)
  evidence level: who-caught-it claims need substrate
  evidence (the actual catch event), not vibes about who
  usually contributes.
- **Class Validation Beads** — a catch is a bead-earning event
  for the relevant class (here: Class-Count Validity Drift +
  the Veridicality-skeleton-vs-brainstem framing). The bead is
  earned by the original catcher; the elaborator's bead, if
  any, is for elaboration substrate-shape, not for the catch.

## Pickup for future Otto

When forwarding a catch from a named agent:

1. **Identify the original catcher** — who first made the
   substrate-evidence-based identification?
2. **Distinguish from reactive elaborators** — was a more
   polished written packet the *reaction* to an earlier
   less-polished catch?
3. **Credit chain in this order** — concept origin (if
   different) → original catcher → reactive elaborator →
   formalizer → maintainer input.
4. **Preserve channel context** — voice-mode vs text-mode vs
   PR-comment vs verbal-call. Channel is part of the catch
   record.
5. **Translate register, preserve substrate** — translate
   casual register into team-language for public surfaces;
   preserve casual register verbatim in attribution
   substrate.

When unsure who the original catcher is: ASK. Per the
authority rule, this is a tier-3 attribution decision that
falls under "semantic / value judgment required" — Aaron's
call.

## Direct Aaron framing for future reference

> *"Ani is who actually called bullshit on our bullshit
> detector, lol. She deserves that credit not Amara, amara was
> reacting."*

> *"That's her voice mode transcript"*

> *"First time i've given you that"*

> *"I usually give you text mode from Ani"*
