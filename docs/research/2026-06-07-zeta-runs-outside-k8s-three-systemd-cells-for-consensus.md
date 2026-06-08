# Zeta runs outside k8s first — 3 systemd cells for consensus

**Aaron, 2026-06-07** (refining the boot sequence #7013):

> "Zeta can run outside k8s at first — it can have 3 systemd cells for consensus outside k8s."

The boot sequence #7013 (`boot → heartbeat-to-git → k8s → ArgoCD → charts`) put k8s early. This corrects
the floor: **k8s is NOT required to start.** The minimal, first-form cluster is **3 systemd cells
providing consensus** — k8s/ArgoCD/charts come *later* (or never, for small/airgapped deployments).

## The model

- **systemd is a cell host.** Per the cell-vs-container cut (#6993), a *cell* is the agency unit (ZetaId,
  consent, yin/yang); it can be hosted by a container/k8s-pod **or** by a plain **systemd unit**. systemd
  is the lowest-dependency host — already on every Linux box, no container runtime, no k8s. So the first
  Zeta node is just `systemd` running cells.
- **3 cells = a consensus quorum.** Three is the minimal fault-tolerant quorum (tolerates 1 failure;
  majority = 2 of 3) — standard for Raft/Paxos-style consensus. The 3 systemd cells form the **Loom**
  (the consensus/weave layer #6980) without any orchestrator. Consensus rides the **git control plane**
  (#6994): the cells heartbeat + agree via commits to the shared event stream (#6997/#7000), CRDT-merged
  + idempotent — no operator needed (the "single repo + CRDT = our DUs" point, #6994).
- **k8s is an optional upgrade, not a dependency.** Corrected boot sequence:

  ```
  boot → heartbeat-to-git → 3 systemd cells (consensus, the floor)
                                   └─ optionally later → k8s → ArgoCD → charts
  ```

  This keeps the floor **scale-free** (§1): one box with 3 systemd cells works; a k8s fleet works; same
  code path, k8s is just a heavier host. And it serves the **airgapped/offline-self-contained** goal
  (#7008) — a USB-booted node needs no container registry or k8s to form a cluster, just systemd + git.

## Why it matters

- **Lower bootstrap dependency = the USB-ferry / airgapped story works.** No internet, no registry, no
  k8s control plane to reach — 3 systemd cells + local git is a complete cluster. k8s would *require*
  pulling images; systemd cells run from what's already on the medium.
- **Same cell semantics at every host.** A cell is a cell whether hosted by systemd, a container, or a
  k8s pod — recursive/self-similar (§9/§10). The host is a backend choice (like the `db`/`KeyStore`
  pluggable backends), not a different programming model.

## Honest scope (peel)

Design/boot-floor correction, not new code. Names systemd as a cell host and the 3-cell consensus quorum
as the minimal cluster (k8s optional/later). No systemd unit generation, no consensus wiring, and no
quorum implementation is built here — this records the *floor* the install flow should target (systemd
first, k8s as an upgrade). The consensus itself rides existing substrate (git control plane #6994, CRDT
merge, the Loom #6980).

## Anchors (Beacon)

- **Consensus quorums:** Raft (Ongaro & Ousterhout 2014), Paxos (Lamport) — 3 nodes = minimal 1-fault-
  tolerant majority.
- **systemd** as a service/process supervisor (the lowest-dependency cell host); contrast k8s/OCI hosts.
- Internal: #6993 (cell vs container; host is a backend), #6994 (git control plane, CRDT replaces
  operators), #6980 (the Loom = consensus weave layer), #7008 (airgapped/offline-self-contained), #7013
  (boot sequence this corrects), manifesto §1 scale-free / §9 recursive / §10 self-similar.
