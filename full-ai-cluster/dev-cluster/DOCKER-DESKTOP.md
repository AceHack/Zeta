# Docker Desktop settings for the dev cluster

The dev cluster (`./up.sh`) runs a 3-node K3S cluster inside
Docker — k3d uses Docker containers AS the K8s nodes. Plus
Cilium, ArgoCD, NFD, hat-system, and ~25 other Applications.
Docker Desktop's default resource allocation isn't enough; the
cluster will OOM or thrash if you don't bump it.

## Resource sizing (GUI — Docker Desktop → Settings → Resources)

| Setting | Default | Recommended for this cluster |
|---------|---------|------------------------------|
| CPUs | 2 | **6** (4 minimum if your Mac is constrained) |
| Memory | 8 GB | **16 GB** (12 GB minimum) |
| Swap | 1 GB | leave at default |
| Virtual disk limit | 64 GB | **128 GB** (containers + images + volumes) |

If you have an M1/M2/M3/M4 Pro or Max, push CPU + memory higher.
The Cilium agent alone wants ~512 MB per node × 3 nodes; add
ArgoCD, its controllers, and the rest of the workloads on top.

## Kubernetes toggle: OFF

Docker Desktop ships its own Kubernetes (`Settings → Kubernetes →
Enable Kubernetes`). **Turn this OFF**. We use k3d, which creates
its own clusters as Docker containers. Having Docker Desktop's K8s
on as well creates a competing context and confuses kubectl.

If it's already enabled, disable it + click "Reset Kubernetes
Cluster" to clean up.

## File sharing: defaults are fine

K3d doesn't need any host paths mounted into the cluster. The
default file-sharing settings (typically `/Users`, `/Volumes`,
`/private`, `/tmp`, `/var/folders`) are fine.

## Network: defaults are fine

K3d creates a named Docker network (`zeta-dev` per
`k3d-config.yaml`) and manages its own bridge. Docker Desktop's
default network settings work without changes.

## CLI-able things

A few Docker config items CAN be set via CLI / file edit without
the GUI:

### Registry mirrors (for faster pulls)

If your network has slow access to `ghcr.io` / `docker.io`, add
a mirror via `~/.docker/daemon.json`:

```json
{
  "registry-mirrors": [
    "https://your-mirror.example.com"
  ]
}
```

Restart Docker Desktop after editing.

### Docker contexts (multiple Docker engines)

If you run Docker on a remote machine sometimes (e.g., the
bare-metal cluster's node) and want to talk to it from your Mac:

```bash
docker context create remote --docker host=ssh://zeta@worker-gpu-01
docker context use remote     # switch to remote
docker context use default    # switch back to local Desktop
```

This is how the dev cluster pattern extends to the bare-metal
cluster — same `docker` CLI, different context.

### buildx for multi-arch builds

The dev cluster runs on the Mac (ARM64 on Apple Silicon); the
bare-metal cluster is x86_64. Multi-arch image builds via buildx:

```bash
docker buildx create --name multiarch --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t k3d-zeta-dev-registry:5000/my-app:dev --push .
```

## Verify after configuration

```bash
docker info | grep -E 'CPUs|Memory|Storage Driver'
# Expect: CPUs >= 4, Memory >= 12GiB

docker network ls            # before ./up.sh: just defaults
# After ./up.sh:             zeta-dev          bridge    local
```

## When things go sideways

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `./up.sh` hangs at Cilium install | Resource starvation | Bump CPU/memory in Docker Desktop |
| ArgoCD apps stuck in Progressing | Same as above | Same as above |
| `kubectl get pods -A` shows lots of Pending | Resource starvation | Same as above |
| `docker ps` shows containers exiting | OOM | Bump memory, drop a node from k3d-config (`agents: 1`) |
| Slow image pulls | Network or no registry mirror | Configure registry mirror above |
| "context k3d-zeta-dev not found" | k3d cluster gone | Run `./up.sh` again |
| Docker Desktop won't start | Various | `~/Library/Containers/com.docker.docker → Logs/` |

## Treating Docker as shared substrate

This config doc represents the maintainer-collaborative stance —
Docker Desktop on the workstation is a shared resource between
"agent doing dev cluster work" and "human running other Docker
workloads." Settings here cover the dev-cluster need; if other
workloads have conflicting needs (e.g., a tight memory limit for
testing), the dev cluster's `k3d-config.yaml` can scale agents
down to fit:

```yaml
# k3d-config.yaml
agents: 1   # instead of 2, halves the memory pressure
```

Single-node dev still reconciles the App-of-Apps correctly; just
less multi-node behavior to observe (Longhorn replica placement,
NFD-per-node labels, ArgoCD nodeAffinity scheduling).
