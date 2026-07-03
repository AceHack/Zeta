# The Cowork maintenance tick — autonomous fix-forward for everyone

A reproducible recipe so **any** contributor (Aaron, Addison, the third cofounder) or **any** harness
(Cowork-Otto, CLI-Otto, Vera, …) can run the same lightweight `main`-health tick. It operationalizes the
autonomous-loop discipline (`docs/AUTONOMOUS-LOOP.md`) at Cowork's cadence, under the project's
**no-PR-gates / fix-forward** model (`GOVERNANCE.md`; red-on-main is the work queue, not a failure).

## What it does, each run

1. **Orient** — fresh session; rely on memory + this doc.
2. **Set up** — token from a persisted secret (never in chat), fresh clone to a temp dir, `bun install`.
3. **Sync + check** — `git reset --hard origin/main`; `bun run preflight:quick`.
4. **Triage** —
   - Only the environmental lanes red (F#/C#/Python/Rust/Go — need dotnet or arch-specific wheels not
     present in a sandbox; they run in CI): report **"main green, nothing to fix"** and stop. A green
     tick that reports nothing-to-do is a **success** — do not invent work.
   - A runnable lane genuinely red (markdownlint · auto-vivify `--check` · tsc · `items.json` staleness):
     **fix it fix-forward** — branch `otto/<slug>`, minimal real fix, re-run the check, commit with a
     `Co-Authored-By:` + full `AgencySignature-v1:` trailer, push, `gh pr create`, `gh pr merge --auto
     --squash`.
5. **Report** — one paragraph: what was red, what was fixed, PR number(s), or "all green."

## Set it up in your own Cowork (each person, once)

- **Auth (one time):** authorize the `gh` CLI via the GitHub **device flow** (github.com/login/device) —
  no PAT pasted anywhere. Persist the resulting token to your own local agent-memory (never commit it).
  Full walkthrough: the "Zeta Cowork GitHub auth: device flow" memory.
- **Schedule:** create a Cowork scheduled task (weekday mornings is a sane default) whose prompt is the
  five steps above, made fully self-contained. Reference implementation prompt:
  `docs/handoffs/` is not it — the canonical self-contained prompt lives in each person's
  `~/Claude/Scheduled/otto-zeta-maintenance-tick/SKILL.md` after setup; copy Aaron's as the template.
- **Pre-approve tools:** click **Run now** once so the bash/`gh` tool approvals bind to the task —
  otherwise the first unattended run pauses on a permission prompt.

## Environment gotchas (Cowork sandbox)

- Clone to a **temp dir**, not the mounted folder (the mount rejects git lock files).
- Install bun: `npm config set prefix ~/.npm-global && npm i -g bun && export PATH=$PATH:~/.npm-global/bin`.
- **No dotnet** in the sandbox — the F#/C# build + test gate is CI-side; the tick only runs the lanes it can.
- Push via token-in-remote-URL (`https://x-access-token:$GH_TOKEN@github.com/...`); the GitHub web editor's
  "create a new branch" radio is unreliable — use the git CLI path.

## Discipline (load-bearing)

- **No gates.** Never propose required checks or branch protection — red-on-main *is* the queue.
- **Don't fabricate work.** Nothing-to-fix is a clean tick. Avoid the standing-by / narration failure mode.
- **Only real, verified fixes** — re-run the check to green before you ship; this is maintenance, not a
  feature-generation loop.
- **Blocker honesty** — dead/revoked token, workspace not ready, or a mount lock → say so plainly and
  stop, don't force it.

## Anchors

`docs/AUTONOMOUS-LOOP.md` (the tick discipline) · `GOVERNANCE.md` (no-gates) ·
`src/Core.TypeScript/hygiene/preflight.ts` (the check the tick runs) · the AgencySignature v1 trailer
convention (`docs/research/2026-04-26-…agencysignature…`).
