# To the roster: the drift genome proposes its own successor (tick 975)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #70210d (full-history shadow fitness -235.75)

```yaml
defaults:
  max_open_age_ticks: 14
adaptive:
  multiplier: 3.5
  min_heals: 33
  floor_ticks: 13
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 970 | -301.25 | -218.5 | #432527 | loses |
| 971 | -312.5 | -221 | #70210d | loses |
| 972 | -324.625 | -228.125 | #350900 | loses |
| 973 | -337.75 | -240.5 | #531100 | loses |
| 974 | -351.875 | -309.5 | #2e0014 | loses |
| 975 | -368.625 | -250.625 | #411c2e | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
