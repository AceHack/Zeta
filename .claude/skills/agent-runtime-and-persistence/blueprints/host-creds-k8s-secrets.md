---
name: host-creds-k8s-secrets
description: Project USB-restored GitHub and AI-login files into Kubernetes Secrets so agent pods can mount the credentials the host already has.
---

# Host credentials as Kubernetes Secrets

Capability skill. Wear this hat when the operator asks whether GitHub /
Claude / Codex / Gemini logins on the USB machine can show up as Secrets
for future agent pods.

## What already exists (do not rebuild)

USB persist + restore is shipped:

- Encrypted blob `/boot/zeta-creds.enc` (scrypt + HKDF + AES-256-GCM)
- Restore writes host files via `zeta-creds-restore.service`
- Manifest: `src/Core.TypeScript/installer/zeta-creds-manifest.ts`

That path does **not** create Kubernetes objects. Host files are not
Secrets.

## What this slice adds

After restore, on the **control plane only**, `zeta-creds-to-k8s.service`
reads the restored files and `kubectl apply`s Opaque Secrets into
namespace `zeta-host-creds`.

Allowlisted (agent-readable):

- `gh-cli` → Secret `zeta-host-cred-gh-cli` (key `hosts.yml`)
- `claude` → Secret `zeta-host-cred-claude` (key `credentials.json`)
- `gemini` → Secret `zeta-host-cred-gemini` (key `oauth_creds.json`)
- `codex` → Secret `zeta-host-cred-codex` (key `auth.json`)

Host-only (never projected): wifi, ssh-host-keys, ssh-operator-pubkey,
install-answers. Personal 1Password vault stays personal.

This is **not** a Helm chart and does **not** wait on OpenBao. External
Secrets remains the later hop once OpenBao is unsealed.

HSM-talk companions on the USB repair stick (PKCS#11 module path,
connector config, authkey _reference_) are **not** projected as Secrets
here. A PIN in etcd is the thing an HSM exists to prevent. See
`src/Core.TypeScript/cluster/seal-emulator-rung.ts`.

## Agent pod pickup

Namespace `zeta-host-creds`, ServiceAccount `zeta-agent`. Example mount:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: agent
  namespace: zeta-host-creds
spec:
  serviceAccountName: zeta-agent
  containers:
    - name: agent
      image: example
      volumeMounts:
        - name: gh
          mountPath: /home/zeta/.config/gh
          readOnly: true
      volumes:
        - name: gh
          secret:
            secretName: zeta-host-cred-gh-cli
            items:
              - key: hosts.yml
                path: hosts.yml
```

Kubernetes does not mount Secrets across namespaces. Pods in another
namespace need a copy, or a later ExternalSecret. Do not widen the
Role to cluster-admin.

## Opt-out

```nix
zeta.credsToK8s.enable = false;
```

## Tests

- `src/Core.TypeScript/installer/zeta-creds-to-k8s.test.ts` — allowlist,
  host-only refusal, summary leak lock, apply skip
- `src/Core.TypeScript/cluster/zeta-creds-to-k8s-nix.test.ts` — After=
  restore+k3s, not requiredBy k3s, missing kubeconfig retries (T5)

## Composes with

- `zflash-creds` (bake into USB)
- `full-ai-cluster/nixos/modules/zeta-creds-restore.nix` (host files)
- workitem `081M1PWSF56087G0R000FDS3NY`
