<!--
Eval-set fixture for substrate-claim-checker (B-0170).

Reproduces the existence-drift pattern surfaced in PR #1252,
where a future-domain memo referenced a docs/ markdown file
that did not actually exist on disk. The historical eval-set
catalogues this as instance #8 of the verify-then-claim memo's
body table (Existence drift sub-class).

The fixture references a clearly synthetic path that will
never be created accidentally, so the fixture stays stable
across substrate evolution.

NOTE: this comment intentionally avoids backtick-quoting
the exact fixture path. Per PR #3611 review threads
(chatgpt-codex-connector + copilot-pull-request-reviewer),
restating a path claim inside the HTML provenance comment
produces a spurious second finding and lets regressions
in body-claim detection slip past `fixtures.test.ts`.
-->

# Existence-drift catalogue (eval-set fixture)

The drift instance below cites `docs/_fixture_existence_drift_target_b0170_2026_05_15.md` as the canonical source.
