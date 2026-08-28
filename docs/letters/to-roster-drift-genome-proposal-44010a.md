# To the roster: the drift genome proposes its own successor (tick 1104)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #44000a (full-history shadow fitness -302.375)

```yaml
defaults:
  max_open_age_ticks: 20
adaptive:
  multiplier: 2.125
  min_heals: 1
  floor_ticks: 10
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1099 | -448.625 | -365 | #660000 | loses |
| 1100 | -448.625 | -380.875 | #420000 | loses |
| 1101 | -448.625 | -313.625 | #420014 | loses |
| 1102 | -448.625 | -335.625 | #700113 | loses |
| 1103 | -448.625 | -302.375 | #44000a | loses |
| 1104 | -448.625 | -321.5 | #45031a | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
