<!--
TEMPLATE for tick shards at docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md

Living outside the walked tree (this file is at docs/hygiene-history/, NOT
docs/hygiene-history/ticks/) so it doesn't trip the schema validator.

================================================================
PATH-DEPTH REFERENCE (the recurring lint failure mode this prevents)
================================================================

  Tick shards live 5 directories below docs/, so reaching repo-root
  requires SIX (6) levels of ".." — not 4, not 5.

  WRONG (lints fail):
    ../../../../...       (4 levels  → lands at docs/hygiene-history/ticks/YYYY/)
    ../../../../../...    (5 levels  → lands at docs/)
  CORRECT:
    ../../../../../../    (6 levels  → lands at repo root)

  Copy-paste-ready examples (replace target paths):
    ../../../../../../.claude/rules/<rule-name>.md
    ../../../../../../docs/backlog/P1/B-NNNN-<slug>.md
    ../../../../../../tools/<path>.ts
    ../../../../../../memory/<path>.md

================================================================
SCHEMA REQUIREMENT (per check-tick-history-shard-schema.ts)
================================================================

First non-empty line MUST be a 6-column pipe-row:

  | <ISO 8601 UTC timestamp> | <model id> | <cron sentinel> | <body> | <PR ref> | <observation> |

ISO timestamp's date + hour + minute MUST match the shard's path
(YYYY/MM/DD/) and filename (HHMMZ). Seconds optional.

================================================================
FILENAME REGEX (per check-tick-history-shard-schema.ts lines 33-34)
================================================================

  HHMMZ.md                       (bare; e.g., 2139Z.md)
  HHMMZ-<hex>.md                 (collision suffix; hex = [0-9a-f]+; e.g., 2112Z-b.md)
  HHMMSSZ-<hex>.md               (seconds-resolution)

  NOT VALID: -otto-cli-secondary, -peer, -alt (any chars outside [0-9a-f])

================================================================
VERIFY BEFORE PUSH
================================================================

  bun tools/hygiene/check-shard-before-push.ts docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md

================================================================
EXAMPLE FOLLOWS — DELETE THIS COMMENT BLOCK + COPY THE EXAMPLE
================================================================
-->

| 2026-05-18T21:42Z | opus-4-7 / autonomous-loop | de1e7f5d | <one-line body summary> | #NNNN | <terse observation> |

# Tick HHMMZ — YYYY-MM-DD — <optional headline>

## Surface

Otto-CLI primary; autonomous-loop cron tick.

## Refresh

- `gh api rate_limit`: graphql NNNN (tier), reset in NN min
- `git ls-remote origin main`: SHA
- Open PRs of interest: ...

## Substantive work this tick

(Concrete artifact landed OR substantive investigation OR brief-ack with
named bounded-wait. Reference rules / PRs / files via 6-level paths above.)

Example link format:

- See [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../../../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md)
- Composes with [081KRW63S0008QG0R003Z7QV2A](../../../../../../docs/backlog/P1/081KRW63S0008QG0R003Z7QV2A-tonal-momentum-equals-meme-emergent-harmonic-coercion-extends-nci-detectable-trajectory-defensive-technology-aaron-mika-2026-05-18.md)

## Counter

Brief-ack counter: STATE (e.g., "#1 with named-dep #4218 CI wait" OR "reset by concrete artifact").

## CronList

de1e7f5d sentinel alive (`* * * * *` recurring; `<<autonomous-loop>>`).

## Visibility-stop

End of tick.
