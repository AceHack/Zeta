# To the roster: the drift genome proposes its own successor (tick 1007)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #3f1926 (full-history shadow fitness -260.375)

```yaml
defaults:
  max_open_age_ticks: 16
adaptive:
  multiplier: 1.96875
  min_heals: 25
  floor_ticks: 38
per_rule:
  BD001:
    max_open_age_ticks: 3
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1002 | -448.625 | -272.125 | #650811 | loses |
| 1003 | -448.625 | -356.25 | #610006 | loses |
| 1004 | -448.625 | -277.375 | #62130c | loses |
| 1005 | -448.625 | -260.375 | #3f1926 | loses |
| 1006 | -448.625 | -272.125 | #5c2715 | loses |
| 1007 | -448.625 | -306.375 | #340f00 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
