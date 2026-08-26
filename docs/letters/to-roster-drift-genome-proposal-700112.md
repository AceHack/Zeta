# To the roster: the drift genome proposes its own successor (tick 893)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #700012 (full-history shadow fitness -169)

```yaml
defaults:
  max_open_age_ticks: 6
adaptive:
  multiplier: 3.5
  min_heals: 1
  floor_ticks: 18
per_rule:
  BD001:
    max_open_age_ticks: 2
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 888 | -203.125 | -170.625 | #480013 | loses |
| 889 | -203.125 | -196.5 | #452100 | loses |
| 890 | -203.125 | -169.25 | #3c1500 | loses |
| 891 | -203.125 | -184.75 | #4a0727 | loses |
| 892 | -203.125 | -197.875 | #59000f | loses |
| 893 | -203.125 | -169 | #700012 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
