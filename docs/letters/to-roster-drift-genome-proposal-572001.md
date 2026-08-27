# To the roster: the drift genome proposes its own successor (tick 1017)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #572000 (full-history shadow fitness -272.125)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 2.71875
  min_heals: 32
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1012 | -448.625 | -272.125 | #572000 | loses |
| 1013 | -448.625 | -332.375 | #43000c | loses |
| 1014 | -448.625 | -343.625 | #4d0910 | loses |
| 1015 | -448.625 | -301.25 | #690900 | loses |
| 1016 | -448.625 | -292.875 | #5b000d | loses |
| 1017 | -448.625 | -283.875 | #4b1016 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
