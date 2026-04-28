---
name: bun + TypeScript as post-setup scripting default — medium confidence after UI-TS amortization input; watchlist posture for revisit
description: Aaron chose bun+TS for Zeta's post-setup `tools/` surface after multi-step deliberation. Initial framing was "hardest decision I've made" (low confidence). A later input materially raised the floor — TypeScript is coming for UI anyway, so bun is not a net-new runtime. Final confidence: medium. Architect watches for sibling drift, better candidates, pain on path, or UI-TS amortization evaporating; revisit trigger-driven not calendar-driven.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The decision** (2026-04-20, round 43): post-setup
scripting work in Zeta's `tools/` surface is **bun +
TypeScript**. Recorded in
`docs/DECISIONS/2026-04-20-tools-scripting-language.md`.

**The unusual thing about this decision:** Aaron
described it verbatim as

> *"this was one of the hardest decisoins i've made
> and i'm still not sure i made the right one, we
> should probbalby keep and eye out and see if we have
> any reason to change or can find any other way of
> doing this that looks better, no rush wahatever you
> want to do here at this point"*

That is a decision held with **explicit low
confidence** and an explicit delegation of the
watching task. Unusual enough to deserve its own
memory record rather than burying it in the ADR.

**The four pillars supporting the choice** (per
Aaron's cross-cutting reasoning, in decision-weight
order):

1. **UI-TS amortization — the load-bearing pillar.**
   Aaron: *"also i know we will end up using
   typescrpt for our ui here too eventually so bun
   is a tool that's comming no matter what"*.
   TypeScript is an inevitable Zeta surface. Bun is
   then a runtime the project needs regardless of
   tooling. The second-runtime objection — the
   biggest structural cost — evaporates because the
   UI surface pays the rent; tooling rides along.
2. **Windows performance.** Git Bash on native
   Windows is slow (fork-heavy, filesystem
   case-normalization overhead). Bun ships a native
   Windows binary and starts fast.
3. **Faction problem with shell languages.** Per
   Aaron: *"pwsh is also clunky cause some people
   hate powershell and some hate bash which is
   another reason i tried to go outside those."*
   Bash and PowerShell both have cultural factions
   that object to them. Picking either alienates one
   camp. bun+TS sidesteps the faction war.
4. **Static types + sibling-project consistency.**
   TypeScript gives static types on automation code;
   SQLSharp already runs bun+TS, so cross-project
   consistency is a bonus — *explicitly two-way*,
   per Aaron: *"SQLSharp can be updated to use
   whatever we choose though"*. Either project can
   lead a future change.

**Why the confidence is medium, not high** (after the
UI-TS amortization input moved it up from low):

- Bun is young (v1.3 as of 2026-04-20). Ecosystem
  maturity is a risk compared to node, which itself
  is slower-starting and less pleasant but older.
- TypeScript adds a compile/check step that bash
  does not; simple shell glue is arguably over-
  engineered when expressed as `.ts`.
- Aaron has personal positive experience with
  bun+TS, but Zeta's maintenance horizon is long and
  personal experience may not generalize to all
  future maintainers.
- The UI-TS amortization is load-bearing *if* the UI
  actually lands on TypeScript. If Zeta's UI surface
  ends up on a different runtime (Blazor WebAssembly,
  a Rust-based frontend, native .NET MAUI), the
  amortization prop is removed and the ADR needs
  re-evaluation without it.

**Watchlist — triggers that would revisit this:**

Revisit is NOT on a calendar. Trigger-driven:

1. **Bun regresses** — security issue, maintenance
   slowdown, Windows binary drift, or major
   breaking change in the runtime.
2. **A better candidate emerges** — .NET gets
   first-class scripting ergonomics (F# Interactive
   improvements), Go gets a scripting story, a new
   language credibly targets this niche. Dated
   internet-best-practices sweep every 5-10 rounds
   per the standing rule catches this.
3. **Pain accumulates on the chosen path** — we
   repeatedly fight the type system, the compile
   step, the ecosystem sprawl, or the package-manager
   surface. If writing `.ts` feels *worse* than
   writing bash did, that's the signal.
4. **SQLSharp changes course** — if the sibling
   project finds bun+TS unsatisfying and pivots, that
   is first-class evidence Zeta should re-evaluate.
5. **Bun becomes the Kubernetes of scripting** —
   wins the market, obvious default, no further
   question. Opposite trigger: same metric, no
   action needed.
6. **F#-scripts graduate from evaluation** — if
   LiquidF# or the broader F#-scripts story lands
   strong enough that engine-adjacent tools start
   migrating, the post-setup default may follow.

**How to apply:**

- Execute on the decision. The ADR is the ground
  truth today — scaffold bun+TS, rewrite tally as
  `.ts`, update `TECH-RADAR.md` with an Adopt row.
- Keep new post-setup tooling in TypeScript by
  default. Do NOT force-migrate existing bash
  scripts — the huge-refactor gate from
  `feedback_prior_art_weighs_existing_technology_interop.md`
  applies.
- On any of the six triggers above, dispatch a
  formal ADR supersession round. Don't wait for
  Aaron to raise it; that's the whole point of the
  delegation — he said *"whatever you want to do
  here at this point"*.
- Log watchlist observations into
  `docs/TECH-RADAR.md` under the bun+TS row when
  they accumulate. Multiple small signals add up to
  a revisit trigger even if no single one does.
- If a revisit concludes "keep bun+TS, no change",
  that counts. An ADR that reaffirms a prior
  decision with fresh evidence is a valuable
  artifact — it promotes the decision from
  "hypothesis: this is the right call" to
  "observed: we have tried it for N rounds and it
  holds."

**Meta-lesson (worth carrying forward):**

Aaron's "one of the hardest decisions I've made"
framing is a signal worth recognizing across the
factory. Decisions can be:

- **High-confidence** — obvious, fast, no watchlist.
- **Low-confidence** — deliberate, slow, warrants
  watchlist + revisit-trigger list + explicit
  decision-holding-confidence note.

A decision's confidence is a first-class metadata
field. The ADR format should carry it. Candidate
addition to the ADR template: a
`decision-confidence: high | medium | low` field and
a `watchlist:` block when confidence is not high.
