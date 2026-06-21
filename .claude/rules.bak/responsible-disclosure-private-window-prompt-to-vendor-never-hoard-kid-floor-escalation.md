# Responsible disclosure — private window that moves toward sent, never hoard; kid-floor exploits route to authorities

Carved sentence (the maintainer 2026-06-03):

> A found vulnerability has a brief **private window** — discovery → write-up →
> **sent to the vendor** — that must stay private (a live unpatched vuln, and its
> disclosure report, are weaponizable until the vendor can patch). But the window
> must be **moving toward sent**, never found-and-shelved: **minimize**
> discovery→sent (the asymmetric-advantage-and-danger clock), **follow coordinated
> timing** sent→public. Child-safety exploits are a **floor matter** — route to the
> vendor AND the appropriate authorities (NCMEC) on a predetermined, legally-vetted
> path. Never hoard.

## Operational content

When any agent (or the maintainer) **finds or encounters a security vulnerability**
during normal use, red-team, CVE-scouting, or audit work — this is the discipline.
It distinguishes the **necessary** privacy of responsible disclosure from the
**harmful** thing (hoarding an unreported exploit).

### The private window is correct — IF it's moving toward sent

- Publishing a live unpatched vuln, or its written report (a weaponizable
  document), before the vendor can patch is the **dangerous** thing. So the
  discovery → write-up → sent-to-vendor window is legitimately private — and
  encrypting it during that window (e.g. in an open repo per the open-source rule)
  is fine.
- What makes it correct is that it's **in a pipeline moving toward sent**, not
  parked. Found-and-shelved-indefinitely is hoarding, which is dangerous (someone
  else may weaponize the same vuln) and an asymmetric advantage you should not hold.

### Two clocks (the load-bearing distinction)

| Clock | Discipline |
|---|---|
| **discovery → sent-to-vendor** | **Minimize.** This is the asymmetric-advantage-and-danger window. Tight; if it ages, that's the signal to disclose now. |
| **sent-to-vendor → public** | **Do NOT minimize — follow coordinated-disclosure timing** (vendor patch window / standard timeout). Rushing this is the reckless-early-publish danger. |

Found vulnerability → **log it immediately** (an unlogged exploit never gets
disclosed) → the clock starts → disclose promptly.

### Kid-floor escalation (composes with `methodology-hard-limits.md` + 081KSRGFP0008QG0R00091PP56)

An unreported exploit on the **child-safety surface** (CSAM-prevention,
age-verification, minor-protection, or anything that could reach children) is a
**floor matter**, not an ordinary vuln:

- the discovery→sent clock is **tighter**;
- disclosure may carry **mandatory-reporting** obligations → route to the
  appropriate **authorities / NCMEC**, not just the vendor;
- the escalation path is **predetermined + legally-vetted + human-routed**, fired
  on categorization, not improvised per-incident — **legal counsel defines it**.

## What this rule is NOT

- NOT a license to publish vulns early (the private window is real and protective).
- NOT a license to hoard (the private window must move toward sent).
- NOT a substitute for legal counsel on the kid-floor / mandatory-reporting path
  (the rule names the discipline; counsel defines the actual routing).

## Composes with

- [`methodology-hard-limits.md`](methodology-hard-limits.md) — abuse/CSAM reporting is the floor; kid-floor exploits inherit it
- [`force-push-with-lease-authorization-policy.md`](force-push-with-lease-authorization-policy.md) + [`non-reversible-action-get-a-second-opinion.md`](non-reversible-action-get-a-second-opinion.md) — disclosure is consequential; human stays on the call for the kid-floor path
- [`human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](human-audit-and-legal-risk-acceptance-pattern-in-settings.md) — named-human/legal routing for the disclosure path
- [`classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`](classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md) — sibling: found-but-not-deployed security research discipline
- 081KSRGFP0008QG0R00091PP56 (constitutional kid-safety floor) — the kid-floor escalation composes here
- 081KT5CF90008QG0R00112FSD7 (the DORA-gate **implementation** of this discipline — split-clock metric + hard-stop)
- `docs/research/2026-06-03-kestrel-aaron-open-source-ethic-floor-governance-jurisdiction-relative-opa-federation-nexus-meta-jurisdiction-conflict-resolution-aaron-forwarded.md` §2 (source substrate)

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): the discipline fires at the
moment an exploit is **found** — and the framework's security personas scout CVEs
and audit surfaces, so this genuinely recurs. Future-Otto cold-booting needs the
private-window-but-moving-toward-sent + two-clocks + kid-floor-escalation discipline
in working memory before it ever handles a vulnerability, so the necessary privacy
isn't confused with hoarding and the kid-floor case is never improvised.

## Full reasoning

Forwarded asymmetric-critic-peer × maintainer session 2026-06-03 (preserved research note §2).
The maintainer drew the precise line — the private window of responsible disclosure
must stay private but must move toward sent; child-safety exploits are a floor
matter needing the strongest, predetermined, authority-routed rails — and named the
asymmetric-advantage framing (holding an unreported exploit IS an unfair advantage,
to be given away by disclosing, not held). This rule lands the **discipline**;
081KT5CF90008QG0R00112FSD7 lands the **gate implementation**.
