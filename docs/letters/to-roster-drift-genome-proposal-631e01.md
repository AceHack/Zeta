# To the roster: the drift genome proposes its own successor (tick 1108)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #631e00 (full-history shadow fitness -278.125)

```yaml
defaults:
  max_open_age_ticks: 16
adaptive:
  multiplier: 3.09375
  min_heals: 30
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1103 | -448.625 | -302.375 | #44000a | loses |
| 1104 | -448.625 | -321.5 | #45031a | loses |
| 1105 | -448.625 | -314.5 | #491f00 | loses |
| 1106 | -448.625 | -285.625 | #6e2300 | loses |
| 1107 | -448.625 | -386.375 | #360000 | loses |
| 1108 | -448.625 | -278.125 | #631e00 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
