# To the roster: the drift genome proposes its own successor (tick 1102)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #531321 (full-history shadow fitness -271.375)

```yaml
defaults:
  max_open_age_ticks: 15
adaptive:
  multiplier: 2.59375
  min_heals: 19
  floor_ticks: 33
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1097 | -448.625 | -272.125 | #452310 | loses |
| 1098 | -448.625 | -271.375 | #531321 | loses |
| 1099 | -448.625 | -365 | #660000 | loses |
| 1100 | -448.625 | -380.875 | #420000 | loses |
| 1101 | -448.625 | -313.625 | #420014 | loses |
| 1102 | -448.625 | -335.625 | #700113 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
