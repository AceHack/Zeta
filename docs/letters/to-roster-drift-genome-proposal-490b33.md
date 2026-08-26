# To the roster: the drift genome proposes its own successor (tick 756)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #490b33 (full-history shadow fitness -158.375)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 2.28125
  min_heals: 11
  floor_ticks: 51
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 751 | -190.5 | -187.25 | #6d0008 | loses |
| 752 | -190.5 | -171.875 | #771200 | loses |
| 753 | -190.5 | -173.375 | #760009 | loses |
| 754 | -190.5 | -164.75 | #340700 | loses |
| 755 | -190.5 | -164.75 | #4c050f | loses |
| 756 | -190.5 | -158.375 | #490b33 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
