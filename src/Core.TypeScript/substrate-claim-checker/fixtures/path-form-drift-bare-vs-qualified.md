<!--
Eval-set fixture for substrate-claim-checker (081KQNJ500008QG0R003SCWBDV.4).

Reproduces the path-form drift pattern — the same physical file
referenced both as a fully-qualified repo-relative path and as
its bare basename within a single document, which lets a reader
miss that the two strings point to the same file and a grep for
the full path misses the bare form.

This is the third eval-set fixture (after count-drift-9-vs-15.md
and existence-drift-missing-doc.md), extending 081KQNJ500008QG0R003SCWBDV.4 regression
coverage to the path-form sub-class of the 7-class verify-then-
claim taxonomy.

The fixture references this directory's sibling check-counts.ts
because that file is guaranteed to exist on disk (the checker
itself ships it) and resolves under check-path-forms.ts's 3-root
strategy (fileDir / parentDir / repoRoot) from both forms below.

NOTE: per PR #3611 review-thread discipline, this HTML comment
intentionally avoids repeating the exact backtick-quoted path
forms from the body so a regression in body-claim detection
cannot be masked by a comment-side match.
-->

# Path-form drift catalogue (eval-set fixture)

See the bare form `check-counts.ts` for the count-drift checker.

The fully-qualified path `src/Core.TypeScript/substrate-claim-checker/check-counts.ts` points to the same file.
