# Repository checks during v16 re-entry

Date: 2026-09-16
Operational status: research-grade

These are environment/repository observations, separate from Blender quality.
The writer clone was clean and based on refreshed `origin/main` at
`5dc50373e`; shared main was not used as a write workspace.

The initial `local-checks.ts` run reported 77 passed, five failed, 15 not
applicable, one slow check not attempted and 13 unable to run. Findings:

- Chart snapshot dated September 5 exceeded its freshness threshold.
- History-growth enumeration saw only 337 commits in this shallow writer clone
  and refused to treat that as a complete audit.
- The derived Twitch application check attempted a `build` script in a context
  where that script was absent.
- The light-time proof test could not execute `z3` from the configured PATH;
  a direct reproduction confirmed `Executable not found`.
- Cross-language verification hit the unaccepted Xcode license while invoking
  `xcrun`/the native linker. No license acceptance or system setting was changed.

The initial quick preflight passed 14 checks, failed `auto-vivify --check`
with 50 existing dangling references, and skipped Go lint because its tool was
unavailable. The dangling links were in existing workitems/research, mostly
`db/`-prefixed paths. The claim introduced none of them. The pre-push hook refused
that push. The claim was subsequently pushed with the repository-documented
`ZETA_SKIP_PREFLIGHT=1` exception, with the failure retained rather than
rewriting unrelated files or creating placeholder targets.

Blender 5.2.1 LTS itself runs successfully. The saved-scene validation is
independent of these repository checks. Local dependency and baseline failures
must not be described as an all-green preflight, or as failures caused by the
character-weight change. GitHub-required gates remain the merge criterion;
no remote required check is bypassed by the local exception.
