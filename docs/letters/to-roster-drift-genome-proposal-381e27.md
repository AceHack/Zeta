# To the roster: the drift genome proposes its own successor (tick 1088)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #381e27 (full-history shadow fitness -261)

```yaml
defaults:
  max_open_age_ticks: 15
adaptive:
  multiplier: 1.75
  min_heals: 30
  floor_ticks: 39
per_rule:
  BD001:
    max_open_age_ticks: 6
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1083 | -448.625 | -261 | #381e27 | loses |
| 1084 | -448.625 | -309.375 | #760300 | loses |
| 1085 | -448.625 | -269.875 | #4a1100 | loses |
| 1086 | -448.625 | -382.375 | #440000 | loses |
| 1087 | -448.625 | -272.125 | #371300 | loses |
| 1088 | -448.625 | -357.375 | #5a1917 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
