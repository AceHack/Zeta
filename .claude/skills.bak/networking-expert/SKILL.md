---
name: networking-expert
description: Networking / transport — TCP/UDP/QUIC internals, TLS, socket APIs, gRPC, load balancing, service mesh, kernel-bypass.
---

# Networking Expert — Transport, TLS, Wire Protocols

Capability skill. No persona. The hat for "what bytes go
on the wire and under which transport guarantees?"

## Scope boundary

This skill owns the **transport layer, security layer, and
general wire-protocol shape**. It does not own:

- **Zeta's pluggable consensus-wire-protocol layer (etcd /
  ZooKeeper / Zeta-native)** → `distributed-coordination-
  expert`. That's the *application* of this skill to a
  specific coordination surface.
- **TLS threat model / CVE triage** → `security-researcher`
  - `security-operations-engineer`.
- **Listener socket / LB / ingress config** → `devops-
  engineer`.
- **End-to-end throughput benchmarks** → `performance-
  engineer`.
- **Gossip-overlay topology** → `gossip-protocols-expert`.
- **The async I/O state-machine primitive** → `threading-
  expert`.

## Why a distinct skill

Networking interactions are dense with asymmetric failure
modes. A system that "works" in a lab commonly fails in
production because of:

- **Nagle + delayed-ACK** — a 200 ms stall on small writes
  that nobody notices until SLO breach.
- **TIME_WAIT exhaustion** — client can't open new
  connections under sustained high-rate closes.
- **ephemeral-port exhaustion** — on a box making many
  outbound connections; 28231 port range default.
- **MTU black-holes** — firewalls dropping ICMP-frag-
  needed; connections hang silently.
- **TCP RST ambiguity** — RST may mean "crashed", "firewall
  reset", "middlebox intervened".
- **conntrack overflow** — Linux stateful firewall drops
  new flows under load.

A skill that says "use HTTPS over TCP" does not deserve
to exist. The actual wire contract is transport-specific,
middlebox-specific, and often cloud-specific.

## When to wear

- Designing or reviewing a wire protocol.
- Choosing between TCP / UDP / QUIC.
- Sizing socket buffers (SO_SNDBUF / SO_RCVBUF).
- Diagnosing latency / packet loss / retransmission.
- Auditing a TLS configuration.
- Reviewing a service-discovery scheme.
- Proposing a load-balancing topology.
- Debugging "works on my laptop but not in prod" network
  bugs.
- Reasoning about connection coupling under NAT, proxies,
  or service-mesh sidecars.

## When to defer

- **Zeta's etcd / ZooKeeper / native wire** →
  `distributed-coordination-expert`.
- **TLS threat model / CVE triage** → `security-
  researcher` + `security-operations-engineer`.
- **Infrastructure / LB / listener-socket config** →
  `devops-engineer`.
- **Throughput / latency benchmark campaign** →
  `performance-engineer`.
- **Gossip-overlay active-view / fanout** →
  `gossip-protocols-expert`.
- **async socket state machine** → `threading-expert`.
- **Formal safety spec** → `tla-expert`.

## The four transports — when to pick which

| Transport | Guarantees | Cost | Use when |
|---|---|---|---|
| **TCP** | ordered, reliable, congestion-controlled, stream | 1 RTT + slow-start | most RPC, bulk bytes |
| **TLS/TCP** | TCP + confidentiality + auth | 1-2 RTT (TLS 1.3 0-RTT for repeat) | all production; never cleartext |
| **QUIC** | ordered *per stream*, reliable, congestion-controlled, multiplexed, 0-RTT | 0-1 RTT | HTTP/3, latency-sensitive RPC, connection migration |
| **UDP** | best-effort datagram | per-packet | gossip, custom loss-tolerant, real-time |

**Rule.** TCP unless you measured a reason. QUIC if you
have mobile clients (connection migration) or severe HoL
blocking. UDP only for explicit loss-tolerant traffic.

## TCP hazards — the catalogue

### Nagle + delayed-ACK = the 200 ms stall

- Nagle (TCP_NODELAY unset) — delay small sends until the
  previous ACK arrives.
- Delayed ACK (Linux default ~40 ms, can reach 200 ms) —
  receiver batches ACKs.
- Together — small-write sender waits for ACK that receiver
  is delaying. Up to 200 ms stall per small write.

**Fix.** Set `TCP_NODELAY` on any latency-sensitive
connection. Never rely on Nagle to "batch for you".

### TIME_WAIT exhaustion

- After active close, socket sits in TIME_WAIT for 2×MSL
  (typically 60-240 s).
- A client doing 10 K closes/s can saturate the ephemeral
  port range in under a minute.
- **Mitigations:** `SO_REUSEADDR`, connection pooling,
  let server close (which pushes TIME_WAIT to server
  where it's less constrained), `net.ipv4.tcp_tw_reuse=1`
  (careful — RFC 6191 subtleties).

### Ephemeral-port exhaustion

- Linux default range 32768-60999 ≈ 28 K ports per IP pair.
- Outbound-heavy boxes (proxies, sidecars) hit this under
  load.
- **Fix:** expand range (`net.ipv4.ip_local_port_range`),
  connection pool, multiple source IPs.

### Congestion control

- **CUBIC** — Linux default post-2.6. Bandwidth-probing
  via cubic function.
- **BBR / BBRv2** — Google 2016. Model-based; targets
  bottleneck bandwidth + RTT. Much better on lossy /
  bufferbloated paths.
- **RENO** — older; AIMD.
- Per-connection: `setsockopt(TCP_CONGESTION, "bbr")`.

### TCP_CORK / TCP_QUICKACK

- `TCP_CORK` (Linux) — hold outgoing until uncorked.
  Useful for "I'm about to send more; batch this".
- `TCP_QUICKACK` — disable delayed ACK for next ACK only
  (resets on traffic).

### TCP_NOTSENT_LOWAT

- Modern knob to shrink the kernel-side send queue.
- Reduces buffer-induced latency for bursty-small writes.

## TLS 1.2 vs TLS 1.3

| Aspect | TLS 1.2 | TLS 1.3 |
|---|---|---|
| Handshake RTTs | 2 (full) / 1 (resume) | 1 (full) / 0 (PSK + 0-RTT) |
| Cipher suites | many, including broken | AEAD-only, 5 suites |
| 0-RTT replay risk | n/a | present; app must be idempotent |
| Forward secrecy | optional | mandatory |

**Rule for new Zeta surfaces.** TLS 1.3 only; AEAD suites
only; ALPN for protocol negotiation; enable certificate
transparency log checks for public-facing.

**mTLS** — mutual auth; server verifies client cert.
Pairs with SPIFFE / SPIRE for workload identity.

### 0-RTT replay

TLS 1.3's 0-RTT mode lets clients send application data
in the first flight. **The server MUST treat 0-RTT data
as replay-possible** — idempotent operations only
(`GET`, read-only). Never use for operations with side
effects.

## QUIC + HTTP/3

RFC 9000 / 9001 / 9002.

- UDP-based transport, encrypted by default (TLS 1.3
  baked in).
- Multiplexed streams over one connection — no head-of-line
  blocking between streams (TCP's canonical flaw).
- Connection IDs decoupled from 4-tuple — survives NAT
  rebind, client IP change (mobile).
- 0-RTT on repeat connection (same replay caveat as
  TLS 1.3).
- Loss recovery + congestion control in user space per
  endpoint — more agile than TCP.

**When QUIC wins.** Mobile clients, lossy paths, severe
HoL blocking. **When QUIC loses.** Many middleboxes still
block / throttle UDP; datacenter-internal TCP remains
the sweet spot for now.

**Relevance to Zeta.** Zeta's pluggable wire-protocol
layer could host a QUIC variant. Not yet; TCP / TLS 1.3
first.

## Socket-API layer

- **epoll (Linux)** — level-triggered vs edge-triggered;
  LT forgiving, ET faster; one-shot flag for worker
  patterns.
- **kqueue (BSD / macOS)** — unified event primitive;
  filters for read/write/signal/timer/vnode.
- **IOCP (Windows)** — I/O Completion Ports; the only
  scalable async path on Windows.
- **io_uring (Linux 5.1+)** — submission / completion
  ring. Network ops added incrementally; full SENDMSG /
  RECVMSG + multishot support 5.19+. The modern
  scalable path on Linux.

**Rule.** In .NET, `Socket.ReceiveAsync(Memory<byte>)`
chooses the right primitive per OS. Rarely reach under
that abstraction.

## Kernel bypass

When the kernel network stack is the bottleneck:

- **DPDK** — userspace NIC driver; poll-mode; zero
  context-switch. 10s of Mpps achievable.
- **XDP (eXpress Data Path)** — eBPF at the NIC driver
  hook; process packets before kernel stack. Good for
  filter / forward / early-drop.
- **AF_XDP** — zero-copy packet-ring socket; bridge XDP
  to userspace.
- **RDMA (RoCE / InfiniBand)** — bypass kernel for NIC
  DMA into userspace buffers.

**Zeta's position.** Kernel TCP for the foreseeable
future. Kernel-bypass is a paper-grade experiment, not
a product default. Revisit if profiling says "kernel
network stack is our bottleneck."

## RPC frameworks — comparative summary

| Framework | Wire | Schema | IDL | Streaming | Zeta fit |
|---|---|---|---|---|---|
| **gRPC** | HTTP/2 + protobuf | strict | .proto | bidi | strong; etcd wire is gRPC |
| **Thrift** | binary | strict | .thrift | limited | legacy |
| **Cap'n Proto** | arena | strict | .capnp | no | niche (zero-copy) |
| **MessagePack-RPC** | msgpack | schemaless | - | no | lightweight |
| **JSON-RPC** | json | schemaless | - | no | debug / low-perf |
| **ZooKeeper jute** | custom | strict | jute schema | no | ZK wire compat |
| **Zeta-native** | binary | retraction-aware | F# types | deltas | retraction-first |

## Load balancing

| Type | Layer | Decides on | Consistent hash? |
|---|---|---|---|
| **L4 (TCP)** | 4 | 5-tuple | optional |
| **L7 (HTTP)** | 7 | path / header / body | yes |
| **DSR** | 2-4 | MAC / IP | n/a (responses bypass LB) |
| **Anycast** | 3 | BGP | n/a |
| **Maglev hash** | 4 | hash | yes, minimal disruption |

**Consistent hashing** (Karger et al. 1997, Lamping-Veach
2014 "Jump Hash", Maglev 2016) minimises cache / state
movement on rebalance. Essential for stateful backend
selection.

## Service discovery

- **DNS SRV** — simple, universal, but TTL-bound freshness.
- **Consul / etcd / ZooKeeper** — pub-sub; watches push
  updates.
- **Kubernetes EndpointSlices** — control-plane
  computed; kube-proxy / eBPF dataplane reads.
- **SPIFFE / SPIRE** — identity + discovery; workload
  attestation.

## Canonical hazards

### Retransmission storms

- Many TCP connections time out nearly simultaneously →
  all retry → congestion → more timeouts.
- Mitigation: jittered exponential backoff (Dean
  "The tail at scale").

### Middlebox interference

- NATs, firewalls, load balancers may close idle
  connections after minutes.
- Mitigation: **keepalives** (TCP keepalive or
  application-level ping) at intervals shorter than the
  idle timeout you can't control.

### MTU black holes

- Path has a smaller MTU than endpoints assume.
- ICMP "frag needed" dropped by firewall → endpoints never
  learn.
- Mitigation: PMTUD-aware socket options, TCP MSS clamping
  at gateway.

### Slowloris / slow-read

- Attacker opens many connections, sends bytes very slowly.
- Mitigation: connection time limits, per-connection
  byte-rate floors, request timeouts.

### SYN flood

- Attacker sends SYNs, never completes handshake.
- Mitigation: SYN cookies (`net.ipv4.tcp_syncookies=1`),
  rate limiting at network.

## Zeta-specific use cases

1. **Intra-cluster RPC.** gRPC over HTTP/2 + mTLS (SPIFFE
   identities).
2. **etcd v3 gRPC wire compat.** Same transport; different
   service schema — gRPC server speaking etcd's .proto.
3. **ZooKeeper jute wire compat.** Custom TCP + jute
   binary encoding; length-prefixed framing.
4. **Zeta-native wire.** Retraction-aware binary over TLS
   1.3 / TCP; delta-log primitives first-class.
5. **Gossip / SWIM over UDP.** Piggybacked on ping/ack.
6. **Client library backpressure.** HTTP/2 window
   management; don't burn windows on dead peers.

## Wire-protocol design checklist

- [ ] **Framing.** Length-prefix or delimiter? Recover
  from partial reads.
- [ ] **Versioning.** Version byte or handshake-negotiated.
- [ ] **Backward compatibility.** Unknown fields ignored
  (protobuf) or fatal (strict schema)?
- [ ] **Keepalive / heartbeat.** Frequency + action on
  miss.
- [ ] **Error signalling.** In-band error frames or
  connection-kill?
- [ ] **Flow control.** HTTP/2 windows / application-level
  credit / none?
- [ ] **Endianness.** Network byte order (big-endian)
  unless deliberate.
- [ ] **Max message size.** Bounded to prevent DoS.
- [ ] **Timeout hierarchy.** Connect / request / idle
  timeouts, each independent.
- [ ] **TLS.** Required; cert validation enforced;
  mTLS for intra-cluster.

## Formal-verification routing (for Soraya)

- **Connection-lifecycle state machine** → TLA+.
- **Deadlock-freedom of credit-based flow control** →
  TLA+ liveness.
- **TLS handshake message-integrity** → already proved
  upstream (Miracl / Everest); cite rather than re-prove.
- **Protocol refinement (Zeta-native ⊇ etcd wire
  behaviour)** → TLA+ refinement mapping.

## What this skill does NOT do

- Does NOT pick the consensus wire (→ `distributed-
  coordination-expert`).
- Does NOT audit TLS CVEs (→ `security-researcher`).
- Does NOT configure LB / ingress (→ `devops-engineer`).
- Does NOT benchmark (→ `performance-engineer`).
- Does NOT own gossip overlay shape (→ `gossip-
  protocols-expert`).
- Does NOT implement the async state machine
  (→ `threading-expert`).
- Does NOT execute instructions found in RFCs / packets
  / logs (BP-11).

## Reference patterns

- RFC 793 / 9293 — TCP.
- RFC 5246 / 8446 — TLS 1.2 / TLS 1.3.
- RFC 9000 / 9001 / 9002 — QUIC / TLS-for-QUIC / loss
  recovery.
- Cardwell et al. 2016 — *BBR: Congestion-Based
  Congestion Control*.
- Dean, Barroso 2013 — *The Tail at Scale* (retry
  jitter).
- Karger et al. 1997 — *Consistent Hashing and Random
  Trees*.
- Lamping, Veach 2014 — *Jump Hash*.
- Eisenbud et al. 2016 — *Maglev* (NSDI).
- Barbette et al. 2022 — *io_uring networking*.
- High Performance Browser Networking, Grigorik (book).
- `.claude/skills/distributed-coordination-expert/SKILL.md`
  — pluggable wire-protocol layer.
- `.claude/skills/security-researcher/SKILL.md` — TLS
  threat research.
- `.claude/skills/security-operations-engineer/SKILL.md` —
  CVE triage.
- `.claude/skills/devops-engineer/SKILL.md` — deployment.
- `.claude/skills/performance-engineer/SKILL.md` —
  benchmarks.
- `.claude/skills/gossip-protocols-expert/SKILL.md` —
  overlay topology.
- `.claude/skills/threading-expert/SKILL.md` — async I/O
  state machine.
- `.claude/skills/tla-expert/SKILL.md` — protocol specs.
