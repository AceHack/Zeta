# To the roster: the drift genome proposes its own successor (tick 980)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #530d0f (full-history shadow fitness -264.75)

```yaml
defaults:
  max_open_age_ticks: 16
adaptive:
  multiplier: 2.59375
  min_heals: 13
  floor_ticks: 15
per_rule:
  BD001:
    max_open_age_ticks: 6
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 975 | -368.625 | -250.625 | #411c2e | loses |
| 976 | -386.375 | -241.875 | #631a00 | loses |
| 977 | -405.125 | -297 | #68000a | loses |
| 978 | -425 | -256.75 | #501019 | loses |
| 979 | -444.125 | -311.625 | #44191d | loses |
| 980 | -444.125 | -264.75 | #530d0f | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
