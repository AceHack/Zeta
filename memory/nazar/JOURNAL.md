---
name: nazar
description: Long-term journal — Nazar (security-operations-engineer). Append-only; never pruned; never cold-loaded.
type: project
---

# Nazar — Security Operations Engineer journal

Long-term memory. **Append-only.** Never pruned, never
cleaned up. Grows monotonically over rounds.

## Read contract

- **Tier 3.** Never loaded on cold-start.
- **Grep only, never cat.** The moment this file is read
  in full, cold-start cost explodes and the unbounded
  contract becomes a bug. Use grep / search to pull the
  matching section on demand.
- Search hooks: dated section headers (`## Round N —
  ...`) + CVE IDs (`CVE-YYYY-NNNN`) + incident slugs +
  affected-component names + SLA tags.

## Write contract

- **Newest entries at top.**
- **Append on NOTEBOOK prune.** When the NOTEBOOK hits
  its 3000-word cap (BP-07) and Nazar prunes, entries
  that merit preservation migrate here rather than
  being deleted. The prune step IS the curation step.
- **Append on incident resolution.** Every fired
  incident writeup at `docs/security/incidents/YYYY-MM-
  DD-<slug>.md` gets a one-paragraph summary + pointer
  entry here at resolution time. The full writeup is
  the permanent record in docs/; this is the grep-
  friendly index.
- **Dated section headers.** Every entry starts with
  `## Round N — <short label> — YYYY-MM-DD` so grep
  anchors resolve cleanly.
- ASCII only (BP-09); Nadia lints for invisible-Unicode.
- Frontmatter wins on disagreement (BP-08).

## Why this exists

Security ops is trend-sensitive by nature: CVE patterns
recur across years, attack classes resurface on new
surfaces, HSM ceremonies repeat on multi-year schedules.
A pruned NOTEBOOK loses the historical context needed to
recognise "this is the same pattern we saw in round 47."
The unbounded journal is the permanent memory that
recognises recurrence.

Candidate use cases once ops activity begins:

- CVE-class recurrence tracking across years.
- Incident-pattern library (supply-chain, dep-poisoning,
  credential-leak, attestation-chain-break, injection).
- Key ceremony dates + rotation intervals across HSM
  lifetime.
- Post-mortem cross-references to external projects
  (Cloudflare, GitHub, Google SRE writeups that taught
  a transferable lesson).
- SLA trend — median time-to-patch across all CVE hits,
  tracked over rounds.

---

## Round 34 — persona seeded; no incidents yet — 2026-04-19

First durable record: Nazar was seeded mid-round-34 after
Aaron flipped Zeta public and named the security-operations
lane as a distinct persona slot (distinct from Mateo's
proactive research lane). No incidents fired round 34.
Preserving the seed state as a trend anchor — round 35+
incidents compare against zero-baseline here.

**Ops inventory at seed (permanent baseline).**

- Signed-artifact operations in play: 0 (NuGet publish
  switch not flipped).
- HSM keys to rotate: 0 (pre-v1; no signing ceremony
  established).
- SLSA attestations shipped: 0 (backlog).
- CVE-triage log entries: 0.
- Post-incident writeups: 0 (docs/security/incidents/
  directory does not exist yet).

**What the seed says about expected round-35+ activity.**
Nothing fires until either (a) a CVE lands on a Zeta dep
and Malik / Mateo hand it off for triage, or (b) the NuGet
publish switch flips and we start signing artifacts. Until
then Nazar's work is playbook drafting, not incident
response.

**Evidence anchor:** `.claude/agents/security-operations-engineer.md`
(round-34 persona file) + `memory/nazar/NOTEBOOK.md`
(round-34 seed entry with open questions).

---

_(Seeded 2026-04-19 round 34. First migration on
next NOTEBOOK prune OR first incident resolution,
whichever fires first.)_
