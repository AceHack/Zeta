# To the roster: the drift genome proposes its own successor (tick 1124)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #570818 (full-history shadow fitness -290.125)

```yaml
defaults:
  max_open_age_ticks: 10
adaptive:
  multiplier: 2.71875
  min_heals: 8
  floor_ticks: 24
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 1119 | -453 | -299 | #711619 | loses |
| 1120 | -453 | -310.75 | #6f1d22 | loses |
| 1121 | -453 | -335.5 | #5a1500 | loses |
| 1122 | -453 | -305.25 | #440e18 | loses |
| 1123 | -453 | -310.75 | #5c1a00 | loses |
| 1124 | -453.125 | -290.125 | #570818 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
