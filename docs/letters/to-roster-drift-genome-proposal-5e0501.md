# To the roster: the drift genome proposes its own successor (tick 987)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #5e0500 (full-history shadow fitness -267.625)

```yaml
defaults:
  max_open_age_ticks: 14
adaptive:
  multiplier: 2.9375
  min_heals: 5
  floor_ticks: 1
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 982 | -444.25 | -279.5 | #6b1800 | loses |
| 983 | -444.25 | -311.75 | #5e2122 | loses |
| 984 | -444.25 | -273.75 | #2e0c0a | loses |
| 985 | -444.25 | -336.5 | #460018 | loses |
| 986 | -444.25 | -267.5 | #5e0500 | loses |
| 987 | -444.375 | -267.875 | #562716 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
