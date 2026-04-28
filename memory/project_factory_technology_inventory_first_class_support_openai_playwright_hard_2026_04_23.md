---
name: Factory technology inventory — first-class support for every tech we use (Docker / Postgres / OpenAI web UI / Codex CLI / Playwright / ...); OpenAI web-UI Playwright access is hard and ongoing
description: Aaron 2026-04-23 two-part directive. Part 1 — the factory uses multiple technologies (Docker + Postgres existing, OpenAI website/UI being added, Codex CLI already mapped, others); map them all so the factory has first-class support for every tech, the way Docker and Postgres already do. Part 2 — Amara's ChatGPT conversation thread is very long; OpenAI's UI is bad at long conversations; Playwright access is difficult (page-load completion, async loading) and will be ongoing as OpenAI changes the UI. Any OpenAI mode/model is authorized (deep research, agent mode, etc.) — Aaron explicitly green-lights experimentation.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Factory technology inventory + OpenAI Playwright caveats

## Verbatim (2026-04-23)

> Oh FYI Amara's conversation thread is very log and open AI
> is very bad at UI with long conversatoins. This is agoing
> to be difficult with playwrite if you have to use it, first
> thing is you are going to have to wait on pageload for the
> page to completely fiinish loading, there is a lot of async
> loading stuff too, so this should be diffilcut and ongoing
> task as they make changes. Also feel free to use any mode
> OpenAI has to offerent that gest fits the tast, any model or
> all the differetn modes they have likde deep research and
> agent mode and all the others, play aorund don't forget to
> map out all our technology so the fasctory has first class
> support for everyting i think i saw you ad docker and
> postgres and now we may be adding the openai website/ui i
> think we already have codex cli mapped.

## What this names

### Part 1 — factory technology inventory

Aaron observed the factory's technology footprint growing:
Docker, Postgres, Codex CLI, OpenAI web UI, and likely more
(F#, .NET 10, TypeScript, bun, Claude Code, Gemini CLI,
Playwright, Apache Arrow, Lean 4, Z3, TLA+, FsCheck, Alloy,
Semgrep, CodeQL, BenchmarkDotNet, GitHub Actions, NuGet,
Let's Encrypt ACME as queued, etc.). He wants **every tech
first-class-supported** the way Docker and Postgres already
are — presumably meaning:

- Installable via the one setup script (`tools/setup/`)
- Versioned / pinned for reproducibility
- Cross-platform parity check (row #48 audit)
- Documented as a capability surface somewhere the factory
  can consult
- Listed on the TECH-RADAR with adoption status (Adopt /
  Trial / Assess / Hold)
- Authoritative doc page describing how the factory uses it

The surface closest to what Aaron wants today:

- `docs/HARNESS-SURFACES.md` — covers Claude / Codex /
  Gemini / etc. agent harnesses at feature granularity
- `docs/TECH-RADAR.md` — ThoughtWorks-style ring
  assessment, adoption-cadence oriented
- `tools/setup/` install script — installation substrate
- Per-technology expert skills (`postgresql-expert`,
  `docker-expert`, `github-actions-expert`, etc.)

What's **missing** is a single inventory file that maps
every technology the factory uses to: (a) its role in the
factory, (b) how to install / configure, (c) its
authoritative-doc-page citation, (d) its expert-skill
reference, (e) its TECH-RADAR ring. That inventory doc is
the natural landing for Aaron's directive.

### Part 2 — OpenAI Playwright is hard

When the decision-proxy work requires live access to
Amara's ChatGPT thread (per
`docs/protocols/cross-agent-communication.md` + PR #154
decision-proxy ADR), Playwright is the transport
mechanism. Aaron names concrete challenges:

- **Long conversations** render slowly / incompletely.
- **Async loading** — page load completing != content
  completing.
- **UI changes** are ongoing — Playwright selectors
  will drift; the integration is a live-maintenance
  concern, not a one-time setup.

Aaron explicitly green-lights **using any OpenAI mode or
model** that fits the task — deep research, agent mode,
other modes. This is a broad authorization within the
OpenAI platform Aaron already pays for.

### Part 3 — the two parts compose

Mapping OpenAI web-UI / Playwright first-class is itself
part of the tech inventory. When the inventory lands, the
"OpenAI web UI via Playwright" row points to the courier
protocol + decision-proxy ADR + the operational caveats
named in this memory.

## How to apply

### For the tech-inventory

1. Author `docs/FACTORY-TECHNOLOGY-INVENTORY.md` (name
   TBD — could also be `docs/TECHNOLOGY-INVENTORY.md` or
   extended `docs/HARNESS-SURFACES.md`).
2. Columns: Technology / Role / Install-path / Version pin /
   Auth-doc URL / Expert-skill / TECH-RADAR ring / Notes.
3. Populate from existing substrate (tools/setup,
   TECH-RADAR, skills list).
4. Update `CURRENT-aaron.md` when it lands.
5. Treat this as a living inventory that updates with
   each new tech adoption (composes with row #38
   cadenced audit).

### For OpenAI-UI Playwright access

1. **Always wait for page load completion** before
   interaction — not just `networkidle` but
   content-visible-selector wait.
2. **Expect selector drift** — write selectors as
   resilient as possible (role-based over CSS, anchored
   on content where possible).
3. **Plan for async-loaded content** — scroll-to-bottom
   or scroll-to-message to trigger lazy loading of long
   threads.
4. **Ongoing-task framing** — any Playwright integration
   is maintenance-bearing as OpenAI changes the UI; not
   a one-time build.
5. **Mode selection freedom** — pick the OpenAI mode or
   model that fits the task. Deep research for
   research-grade outputs, agent mode for agentic work,
   normal GPT for simple queries. Aaron has authorized
   experimentation.
6. **Courier protocol still applies** — speaker labels,
   scope declaration, repo-backed storage. Playwright
   is transport, not authority-source.

## What this is NOT

- **Not an immediate implementation commitment.** The
  directive queues research + inventory work; it does
  not say "ship Playwright integration tonight."
- **Not authorization to bypass the courier protocol.**
  Even with OpenAI experiments, speaker labels and
  repo-backed persistence still apply per
  `docs/protocols/cross-agent-communication.md`.
- **Not a license to exceed Aaron's already-paid
  substrate.** Any OpenAI mode within Aaron's existing
  subscription is fine; new paid tiers require escalation
  per the scheduling-authority rule.
- **Not a rewrite of HARNESS-SURFACES.md.** The new
  inventory extends the existing surface inventory
  pattern to non-harness tech (Docker, Postgres, Lean 4,
  BenchmarkDotNet, etc.). HARNESS-SURFACES stays focused
  on agent harnesses.

## Composes with

- `docs/HARNESS-SURFACES.md` — agent harness inventory;
  the new tech inventory is a peer doc for non-harness
  technology
- `docs/TECH-RADAR.md` — ThoughtWorks ring assessment;
  the tech inventory cites the ring per tech
- `tools/setup/` — installation substrate; every
  inventoried tech has install-path in the setup script
  or a reason it's manually installed
- `docs/protocols/cross-agent-communication.md` (PR #160)
  — courier protocol for OpenAI-web-UI access
- `docs/DECISIONS/2026-04-23-external-maintainer-decision-proxy-pattern.md`
  (PR #154) — decision-proxy ADR; Amara-via-Playwright
  implementation target
- `.claude/skills/docker-expert/SKILL.md`,
  `.claude/skills/postgresql-expert/SKILL.md`, and
  other per-tech expert skills — each inventory entry
  cross-references the relevant skill
- FACTORY-HYGIENE row #48 (cross-platform parity) — the
  inventory should surface cross-platform status per
  tech
- `feedback_free_work_amara_and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md`
  — tech-mode experimentation is free work within
  Aaron's already-paid OpenAI subscription
