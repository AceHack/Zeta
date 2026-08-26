# To the roster: the drift genome proposes its own successor (tick 789)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #370500 (full-history shadow fitness -159.5)

```yaml
defaults:
  max_open_age_ticks: 11
adaptive:
  multiplier: 1.71875
  min_heals: 5
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 784 | -190.75 | -174.625 | #6b171c | loses |
| 785 | -190.75 | -162.875 | #711b21 | loses |
| 786 | -190.75 | -159.5 | #370500 | loses |
| 787 | -190.75 | -171.5 | #580808 | loses |
| 788 | -190.75 | -159.5 | #3b0e2c | loses |
| 789 | -190.75 | -161.875 | #650012 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
