# To the roster: the drift genome proposes its own successor (tick 848)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #421600 (full-history shadow fitness -157.375)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 2.0625
  min_heals: 22
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 3
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 843 | -202.875 | -169 | #4d182c | loses |
| 844 | -202.875 | -176.875 | #740411 | loses |
| 845 | -202.875 | -188.25 | #31000d | loses |
| 846 | -202.875 | -157 | #421600 | loses |
| 847 | -203 | -175 | #67000b | loses |
| 848 | -203 | -169.5 | #732317 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
