# To the roster: the drift genome proposes its own successor (tick 1096)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #5e2100 (full-history shadow fitness -269.875)

```yaml
defaults:
  max_open_age_ticks: 13
adaptive:
  multiplier: 2.9375
  min_heals: 33
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1091 | -448.625 | -353.375 | #37001a | loses |
| 1092 | -448.625 | -307.625 | #430010 | loses |
| 1093 | -448.625 | -269.875 | #64082e | loses |
| 1094 | -448.625 | -275.625 | #311d00 | loses |
| 1095 | -448.625 | -354.25 | #4c0109 | loses |
| 1096 | -448.625 | -269.875 | #5e2100 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
