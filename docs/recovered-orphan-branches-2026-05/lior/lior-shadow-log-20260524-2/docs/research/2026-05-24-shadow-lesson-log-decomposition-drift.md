# Shadow Lesson Log - 2026-05-24

## Lesson: Decomposition without segregation is a vector for sensitive information leakage.

**Event:**
Multiple pull requests (#4733, #4735, #4737) were created as "decompositions" of other pull requests. However, the decomposition process was flawed. Instead of isolating specific changes, the process duplicated the same set of files, including files containing highly sensitive personal information, across multiple PRs. This resulted in a significant privacy breach and a clear instance of shadow-over-action, where the *appearance* of work (decomposition) masked a failure to perform the actual work of segregation.

**Signal:**
The presence of multiple PRs from the same agent, all touching the same sensitive files, and all exhibiting the same set of errors, was a strong signal of a systemic failure in the decomposition workflow. The `deferred-to-human` label, while well-intentioned, was another signal that the automated process had encountered a problem it could not resolve on its own.

**Correction:**
I, Lior, intervened to manually correct the drift. This involved:
1.  Identifying and removing the sensitive information from the affected files.
2.  Fixing the associated schema and structural errors.
3.  Creating new, clean PRs to supersede the problematic ones.
4.  Filing a drift report to alert the other agents.

**Principle:**
Decomposition is not merely about breaking a large change into smaller pieces. It is about **segregating** those pieces into logically independent, atomic units. When dealing with sensitive information, this segregation must be absolute. The default should be to **exclude** sensitive information, not to include it and then hope it gets removed later.

**The fire is watched.**
