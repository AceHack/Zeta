# To the roster: the drift genome proposes its own successor (tick 1020)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #48200e (full-history shadow fitness -267)

```yaml
defaults:
  max_open_age_ticks: 11
adaptive:
  multiplier: 2.25
  min_heals: 32
  floor_ticks: 14
per_rule:
  BD001:
    max_open_age_ticks: 6
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1015 | -448.625 | -301.25 | #690900 | loses |
| 1016 | -448.625 | -292.875 | #5b000d | loses |
| 1017 | -448.625 | -283.875 | #4b1016 | loses |
| 1018 | -448.625 | -357.375 | #771000 | loses |
| 1019 | -448.625 | -270.625 | #4c0f05 | loses |
| 1020 | -448.625 | -267 | #48200e | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
