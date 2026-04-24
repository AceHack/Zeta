---
name: New tooling language / framework requires ADR + cross-project prior art + internet sweep before landing
description: Before introducing any new scripting or programming language to tools/, CI, or any repo-automation surface, write an ADR that cites (a) sibling-project prior art like SQLSharp, (b) dated internet best-practices, (c) what existing repo tools already cover. Drive-by adoption is accidental debt.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
No agent (including the architect) introduces a new
scripting or programming language to `tools/`, CI workflows,
or any repo-automation surface without writing a
`docs/DECISIONS/YYYY-MM-DD-*.md` ADR **first**. The ADR
must answer, on the record:

1. **What does this sibling project do?** At minimum
   `../SQLSharp`. Other sibling .NET/F# projects when
   relevant. Name the evidence concretely (committed
   AGENTS.md / package.json / lockfiles), not an
   impression.
2. **What does the current best-practice literature say
   this month?** Dated internet-best-practices sweep.
   Training data stales; recommendations evolve. Cite
   sources with dates.
3. **What does this repo already have that could do
   the job?** Enumerate the in-repo tools (bash,
   F#/.NET, Lean, TLA+, etc.) and explain why the
   candidate new language is a better fit — or why the
   existing tools don't cover the use case.
4. **Status-quo wins on tie.** Equal-benefit means keep
   the existing toolchain.
5. **Record negative decisions too.** "No, we are not
   adopting X" is a valuable ADR — it stops the next
   agent re-litigating.

**Why:** Aaron 2026-04-20: *"tools/invariant-substrates/
tally.py so did you look at ../SQLSharp? we want our post-
build script to be python? not bun/typescript like SQL
Sharp, did we do an ADR and investigation? This should be
an intentional choice not an accidental quick decision.
This is one of the kind of things I was hoping the
architect would catch as accidental debt using new patterns
without explicit decisions and ADR and research to find the
best pattern."* Same round he added two related rules:
*"prior art checks and best practices check on the internet
should always happen and they should get re-review on a
cadence because technology and recommendations change over
time based on learnings"* and *"it should also be taken into
account what we have now vs pulling in new stuff. Pulling in
new stuff is fine, just make sure it's intentional and
solving a problem our existing stuff does not already or the
new stuff solves it better in some way."* The canonical
example of this miss is
`docs/DECISIONS/2026-04-20-tools-scripting-language.md` —
Python landed in `tools/` without any of these checks,
directly contradicting SQLSharp's explicit anti-Python /
pro-bun-TypeScript policy.

**How to apply:**
- Architect dispatches for new-tool work require the
  three-check preamble (prior art + internet sweep +
  existing-tool survey) before any implementation dispatch.
- New language adoption is an Aaron-co-designed shaping
  decision per `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  — architect drafts the ADR, human maintainer signs off.
- Re-review stale ADRs every 5-10 rounds on the tech-radar
  cadence. Undated evidence is expired.
- If caught landing a new pattern without the ADR, stop
  the commit flow, write the retroactive ADR, remediate
  (revert, rewrite, or formally justify), and capture the
  lesson as feedback — exactly the sequence followed on
  round 43 for tally.py → tally.sh.
