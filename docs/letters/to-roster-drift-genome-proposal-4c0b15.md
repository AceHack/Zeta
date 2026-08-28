# To the roster: the drift genome proposes its own successor (tick 1071)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #4c0b15 (full-history shadow fitness -277.375)

```yaml
defaults:
  max_open_age_ticks: 11
adaptive:
  multiplier: 2.375
  min_heals: 11
  floor_ticks: 21
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1066 | -448.625 | -306 | #62180d | loses |
| 1067 | -448.625 | -306.375 | #2e1522 | loses |
| 1068 | -448.625 | -277.375 | #4c0b15 | loses |
| 1069 | -448.625 | -357.375 | #641023 | loses |
| 1070 | -448.625 | -337.25 | #601700 | loses |
| 1071 | -448.625 | -322.625 | #45041d | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
