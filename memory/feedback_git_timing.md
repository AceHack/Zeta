---
name: git init timing is Aaron's call, not inferred
description: Never run `git init` or stage commits on the Zeta repo without explicit user authorization, even when it looks like a safe reversible prerequisite
type: feedback
originSessionId: 2ac0e518-3eeb-45c2-a5dc-da0e168fe9c4
---
Never run `git init`, stage files, or create the first commit in
the Zeta repo without Aaron's explicit green-light. Do not infer
readiness from context like "the repo has a .gitignore" or "Aaron
said `lets start preppping`."

**Why:** round-25 wake-up 2026-04-18. Aaron said "lets start
preppping I've decided on Zeta." Kenji read that as approval to
`git init` + lay a baseline commit. Aaron corrected: "we don't
want to commit for a long time, get that off the radar for a
while. i'll let you know when to do that, you didn't even need to
run git init yet, we are not ready for that." The lesson is that
repo initialization is a deliberate, ceremonial moment for Aaron;
the fact that an action is technically reversible does not make
it authorized. "Reversible in one round" (GOVERNANCE.md §15) is
permission to *edit the code*, not to *open the repo*.

**How to apply:**
- When Aaron says "prep" for a rename, architectural change, or
  product-level decision, treat it as "design / stage files /
  write the plan doc," not as "initialize git / stage commits."
- If a multi-step plan has a git step in the sequence, present
  the plan and wait for an explicit go on the git step even when
  Aaron has already greenlit the rest of the plan.
- Rename work and similar structural changes proceed without
  git until Aaron explicitly says to commit. Use TodoWrite +
  build-gate discipline instead of per-commit safety nets.
- The .gitignore / .gitattributes / .github/ directory can all
  exist fine without `.git/`. Treat them as prose files the
  project maintains for a future git repo, not as signals of
  readiness.
- If in doubt, ask; the cost of a wait is tiny, the cost of an
  unauthorized init is an implicit assumption about when the
  project publishes state.
