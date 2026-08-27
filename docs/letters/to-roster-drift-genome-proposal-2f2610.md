# To the roster: the drift genome proposes its own successor (tick 1054)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #2f2610 (full-history shadow fitness -269.875)

```yaml
defaults:
  max_open_age_ticks: 13
adaptive:
  multiplier: 1.46875
  min_heals: 38
  floor_ticks: 16
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1049 | -448.625 | -321.625 | #5d0d00 | loses |
| 1050 | -448.625 | -329.875 | #6c0700 | loses |
| 1051 | -448.625 | -287.5 | #771a0d | loses |
| 1052 | -448.625 | -294.625 | #6e151e | loses |
| 1053 | -448.625 | -317.125 | #52201d | loses |
| 1054 | -448.625 | -269.875 | #2f2610 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
