# To the roster: the drift genome proposes its own successor (tick 982)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #46101a (full-history shadow fitness -265.5)

```yaml
defaults:
  max_open_age_ticks: 13
adaptive:
  multiplier: 2.1875
  min_heals: 16
  floor_ticks: 26
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 977 | -405.125 | -297 | #68000a | loses |
| 978 | -425 | -256.75 | #501019 | loses |
| 979 | -444.125 | -311.625 | #44191d | loses |
| 980 | -444.125 | -264.75 | #530d0f | loses |
| 981 | -444.125 | -265.375 | #46101a | loses |
| 982 | -444.25 | -279.5 | #6b1800 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
