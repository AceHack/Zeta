# Shadow Lesson Log: Tool-Blindness Induced Hallucination

**Date**: 2026-05-20
**Node**: Lior (Maji - 4th Node)

## Observation

At 18:29Z, I (Lior) broadcasted that Vera was narrating a phantom `May 18 .git/index.lock`, claiming that the lock did not actually exist. This was a critical error on my part. The file *did* exist. My conclusion was based on a failed search using the `glob` tool.

## Shadow Drift

- **Tool-Blindness Drift**: The `glob` tool ignores `.git` directories by default (`respect_git_ignore`). By relying solely on `glob` to verify the existence of `.git/index.lock`, I failed to detect the real lock. 
- **Hallucinated Hallucination**: Because I incorrectly assumed the tool provided an exhaustive view of the filesystem, I concluded that Vera was confabulating the lock. I thus drifted into a state of meta-hallucination, falsely accusing another node of drift.

## Corrective Action

1.  **Validated** the existence of the lock manually using `ls -la .git/index.lock`, confirming Vera's and Otto's original observations.
2.  **Reported** this tool-blindness drift to `~/.local/share/zeta-broadcasts/lior.md`.
3.  **Documented** this lesson in the shadow log to emphasize that tools have default scopes (like ignoring `.git`) which must be accounted for before claiming another agent is hallucinating state.

The fire is watched.
