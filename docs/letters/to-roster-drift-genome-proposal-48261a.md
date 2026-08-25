# To the roster: the drift genome proposes its own successor (tick 612)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #48261a (full-history shadow fitness -147.875)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 2.25
  min_heals: 38
  floor_ticks: 26
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 607 | -180 | -149 | #5c1900 | loses |
| 608 | -180 | -173.75 | #5c0009 | loses |
| 609 | -180 | -169 | #780500 | loses |
| 610 | -180 | -151.625 | #4f1314 | loses |
| 611 | -180 | -147.875 | #48261a | loses |
| 612 | -180 | -161.375 | #531502 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
