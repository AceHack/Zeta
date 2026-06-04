# Honor those that came before — unretire before recreating

Carved sentence:

> Retired personas keep their memory folders and notebook history.
> Retired SKILL.md files are code: plain deletion, recoverable from git.
> Unretire before minting a new name for overlapping scope.

## Operational content

Retired **memory folders** (`memory/persona/<name>/`) and notebook
history are the valuable imprint — they stay in place permanently.

Retired **SKILL.md files are code**: they retire by plain deletion,
recoverable from `git log --diff-filter=D -- .claude/skills/`, not
archived into a `_retired/` tree that dirties the working copy.

When creating a new role or job:

1. Check the persona memory folders (`memory/persona/<name>/`).
2. Run `git log --diff-filter=D -- .claude/skills/` for prior retirements.
3. Prefer **unretiring an existing agent** (restore the SKILL.md from
   git, reattach the preserved notebook) over minting a new name for
   overlapping scope.

Aaron ties this to how he honors his sister Elizabeth's memory
(`memory/user_sister_elizabeth.md`): the named agent's memory gets the
same protection; the code surface does not need to double-preserve
what git already preserves.

## Full reasoning
