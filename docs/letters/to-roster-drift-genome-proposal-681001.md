# To the roster: the drift genome proposes its own successor (tick 588)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #681000 (full-history shadow fitness -147.875)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 3.25
  min_heals: 16
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 583 | -155.625 | -148.625 | #681119 | loses |
| 584 | -162.75 | -159.625 | #632130 | loses |
| 585 | -170.875 | -147.375 | #4a000c | loses |
| 586 | -180 | -162.25 | #6c1f2f | loses |
| 587 | -180 | -154.375 | #3f0413 | loses |
| 588 | -180 | -147.875 | #681000 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
