# Loki + Hubble queries — joining hats to network behavior

The operator emits one structured log line per tick (event
`hat.tick`) carrying:

```json
{
  "msg": "hat.tick",
  "hat": "executor",
  "wearer.spiffeID": "spiffe://zeta.cluster/ns/orleans/sa/grain-worker",
  "event": "SwapOn",
  "reason": "BindingActive",
  "throttle": "",
  "occurredAt": "2026-05-25T13:42:17Z"
}
```

Cilium / Hubble flow logs are tagged with the SPIFFE ID of the
source pod (the Cilium SPIFFE integration ships this out of the
box when the workload mounts a SVID). That gives us the join key:
both sides agree on `spiffeID`.

## Active wearers right now

```logql
{app="hat-system-operator"} |= "hat.tick"
  | json
  | event = "SwapOn" or event = "WarmupEnd"
  | line_format "{{.hat}}\t{{.wearer_spiffeID}}\t{{.occurredAt}}"
```

## Recent throttle denials by throttle name

```logql
sum by (throttle) (
  count_over_time(
    {app="hat-system-operator"} |= "hat.tick"
      | json
      | event = "Throttled" [1h]
  )
)
```

## Network flows from a probationary wearer (Hubble Relay)

```bash
hubble observe \
  --from-identity spiffe://zeta.cluster/ns/orleans/sa/grain-worker \
  --since 5m -o json | jq 'select(.flow.verdict == "FORWARDED")'
```

## Joining swap stream to flow stream

The operator's HatSwap CRs are the durable swap stream; Hubble
flows are the durable network stream. Both carry SPIFFE IDs.

For a wearer in Warmup, every flow logged between BoundAt and
WarmupEndsAt should belong to the wearer's reduced-authority
namespace set. The skeleton query:

```bash
# 1. Find current Warmup bindings.
kubectl get hatbindings -A -o json \
  | jq -r '.items[]
      | select(.status.phase == "Warmup")
      | [.spec.wearer.spiffeID,
         .status.boundAt,
         .status.warmupEndsAt] | @tsv'

# 2. For each, ask Hubble whether any flow left the
#    permitted namespaces during the window.
while IFS=$'\t' read spiffe begin end; do
  hubble observe \
    --from-identity "$spiffe" \
    --since "$begin" --until "$end" \
    -o json \
    | jq --arg s "$spiffe" \
        'select(.flow.destination.namespace as $dst
                | (["orleans","hindsight"] | index($dst)) == null)
         | {wearer: $s, dst: .flow.destination.namespace,
            verb: .flow.l4, time: .time}'
done < <(...above command...)
```

## Sticky attribution lookup

A flow tagged with SPIFFE ID `X` is attributed to the hat
held by `X` at flow time — including the
`stickyAttributionEndsAt` window after revocation.

```bash
# Given a flow at time T from SPIFFE ID X, find the hat:
flow_time="2026-05-25T14:00:00Z"
spiffe="spiffe://zeta.cluster/ns/orleans/sa/grain-worker"

kubectl get hatswaps -A -o json | jq --arg t "$flow_time" --arg s "$spiffe" '
  .items
  | map(select(.spec.wearer.spiffeID == $s))
  | map(select(.spec.occurredAt <= $t))
  | sort_by(.spec.occurredAt) | last
'
```

The last-swap-before-flow-time tells you which hat was on when
the flow happened. Within the sticky window after a SwapOff
event, attribute to the previous hat even if a new one has
since bound — that's what the window exists to do.

## Why use Loki + Hubble vs querying the operator directly

The operator's HatSwap CRs are the authoritative truth, but
joining them to network flows at scale is what Loki + Hubble
do well. Pattern: query CRs for "what should be true," query
Loki/Hubble for "what actually happened," and surface the diffs.
