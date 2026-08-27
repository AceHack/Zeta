# Cluster install-time injection points — canonical catalog

End-to-end map of every credential / identifier / configuration value
that can be injected into a fresh NixOS install at flash time or first
console boot. Each row is declaratively backed by a NixOS module that
reads its value at evaluation time via `builtins.readFile`.

## Constitutional rail (from `usb-nixos-installer/zeta-install.sh`)

> _"Secrets shouldn't transit non-operator surfaces (USB ESP, Aaron's
> Mac keychain, etc.); operator-typed at install time is the safest
> path."_

This rail partitions injection points by **content class** + **transit
surface**:

| Content class                                                                                             | Allowed transit surfaces                                                |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Public identifier** (SSH pubkey, hostname)                                                              | USB ESP at flash time; cluster console at install time                  |
| **Secret material** (passwords, WiFi creds, GPG, age, K8s tokens, ArgoCD admin, cosign signing key, etc.) | Cluster console at install time ONLY (operator-typed; never on USB ESP) |

Secret-class material that doesn't fit the operator-typed-once
discipline (e.g., long random tokens, multi-secret bundles) goes via
post-install secrets management (out of scope for this catalog;
candidates: SOPS, age, sealed-secrets, External Secrets Operator).

### The rail is now machine-checked (081KTWFYC9108QG0R001C8RDPK)

Until 2026-08-17 the rail above existed **only as this prose**. `FileBackedEspWrite`
in `src/Core.TypeScript/zflash/lib.ts` carried a closed union of six ESP
destinations and no notion of what class any of them held, so nothing in the
build could tell `/zeta-hostname.txt` from `/zeta-join-token`.

`src/Core.TypeScript/zflash/injection-rail.ts` makes the class a type,
**exhaustive over that same union** (`satisfies Record<EspDestination, …>`), in
the shape #11485 set for `VendorTrustRoot`: an ESP destination added without a
declared content class is a TypeScript error, not a review miss.
`runFileBackedZflash` calls `railFindingsForEspWrites` and discloses every
secret-class and unclassified write to the operator at flash time.

**The guard has already fired once, and that is the evidence it works.** The
module was written against the six-destination union. While it waited to land,
`lib.ts` grew to **eight** — `/zeta-bind-uefi-keyfile` and
`/zeta-qemu-creds-passphrase` — and the `satisfies` clause turned the two
unclassified arrivals into a compile error rather than a silent gap. Under the
prose-only rail they would simply have shipped unclassified, which is exactly
what §4a below records happening to the WiFi PSK.

Three classes, not two — the table above cannot express why `/zeta-creds.enc`
is permitted while being called secret material. It is permitted because it is
an **encrypted envelope** whose key is not on the medium, so that is its own
class. **The class is DECLARED, never measured:** the rail does not open the
file to confirm it is an AES-256-GCM envelope.

| ESP destination               | Content class                               | ESP verdict                                                 |
| ----------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `/zeta-authorized-keys.pub`   | public identifier                           | permitted by class                                          |
| `/zeta-hostname.txt`          | public identifier                           | permitted by class                                          |
| `/zeta-firstboot.conf`        | public identifier                           | permitted by class                                          |
| `/zeta-bind-uefi-keyfile`     | public identifier (the literal bytes `1\n`) | permitted by class                                          |
| `/zeta-qemu-bake-test-cred`   | public identifier (the literal bytes `1\n`) | permitted by class                                          |
| `/zeta-creds.enc`             | encrypted envelope                          | permitted by class (declared, not measured)                 |
| `/zeta-join-token`            | **secret material**                         | **refused by class; ships under the §6 recorded exception** |
| `/zeta-wifi-credentials.json` | **secret material**                         | **REFUSED — no exception on file; see §4a**                 |
| `/zeta-qemu-creds-passphrase` | **UNDECIDED — pending security review**     | **REFUSED; see §4b**                                        |

A ninth destination arrived later: `/zeta-qemu-bake-test-cred` (081M12178AR), a
public-identifier marker (`1\n`) that asks the guest picker to bake one
deterministic gh-cli _test_ token. The token is not on the ESP.

**What is NOT claimed.** This module performs no cryptography and no key
material passes through it. Nothing here is sealed, bound, attested, or
verified. It classifies destinations and returns verdicts.

### 4b. `/zeta-qemu-creds-passphrase` — content class UNDECIDED, awaiting review

081KTWFYC9108QG0R001C8RDPK carries the gate _"Nazar (ops) + Mateo (research)
review the surface BEFORE implementation; no key handling lands without it."_
Seven of the eight destinations above are classified by reading the bytes they
carry. This one is not, and it was not classified here.

**What it carries, factually.** `planFileBackedZflashImage` writes the plaintext
passphrase for `/zeta-creds.enc` when `--qemu-creds-passphrase-file` is passed;
`installer/uefi-keyfile-esp.ts` reads it back off the boot USB ESP
(`QEMU_CREDS_PASSPHRASE_IMAGE_PATH`) so a non-interactive QEMU run can bind the
blob. It is documented in `lib.ts` as a QEMU-only test secret, not a production
operator path.

**Why it is a judgement and not a reading.** `/zeta-creds.enc` earns the
`encrypted-envelope` class _because the key is not on the medium_. This file is
that key. Whether a QEMU-only, flag-gated path makes that acceptable — and
whether the rail should model "test-only" as a class at all — is a security
call, so the rail carries the explicit sentinel `pending-security-review`
instead of a guess.

**Undecided fails closed and stays loud.** The write is REFUSED, no recorded
exception can rescue it (the ordering in `evaluateEspWrite` puts the sentinel
before the exception lookup, so a review gate cannot be satisfied by a roster
entry the reviewers never saw), and the flash-time disclosure reads `CONTENT
CLASS NOT YET REVIEWED` rather than the ordinary refusal — a missing review must
never read as a completed one. The question, the four options the rail can
actually express, and their consequences are enumerated in code as
`PENDING_CLASSIFICATIONS`, with a test asserting `decided: false` and a second
asserting that every sentinel in the map has a roster entry.

### 4a. WiFi credentials on the ESP — a divergence, not an exception

Found 2026-08-17 while making the rail machine-checkable, and recorded rather
than quietly fixed (the #11477 standard).

§4 below classifies WiFi credentials as **"Secret material (NEVER on USB ESP)"**
and says they are typed at the console into `nmtui`. **The shipping code does
otherwise.** `planFileBackedZflashImage` writes `/zeta-wifi-credentials.json` —
the SSID and the PSK as plain JSON — onto the ESP whenever `--wifi-ssid` /
`--wifi-password` / `--wifi-credentials` is passed;
`composeWifiCredentialsFileContent` validates and serialises, and performs no
encryption. Three existing tests in `file-backed.test.ts` assert that plaintext
write as expected behaviour, so the path is live, not vestigial.

This is a **divergence**, categorically different from §6's exception: §6 was
decided and written down; this was not noticed. It is left UNRESOLVED here on
purpose — removing a shipped operator flag is a maintainer call, and the
correct destination (the §7 encrypted blob, or console-only per §4) is the same
open question §6 already carries. Recorded in code as
`RAIL_DIVERGENCES` in `injection-rail.ts`, and disclosed at every flash that
carries it.

## Supported injection points (live catalog)

Each injection point has: stage (when injected) + content class +
flag/prompt (how operator drives it) + ESP filename (if ESP-transit) +
NixOS module (declarative reader) + iter/backlog tag.

### 1. Operator SSH pubkey

| Property                   | Value                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Stage**                  | macOS at `zflash` time → USB ESP write                                                                     |
| **Content class**          | Public identifier                                                                                          |
| **Operator-driven via**    | `zflash --ssh-key <path>` (default `~/.ssh/id_ed25519.pub`); `--no-inject` to skip                         |
| **ESP filename**           | `zeta-authorized-keys.pub`                                                                                 |
| **NixOS reader module**    | `full-ai-cluster/nixos/modules/operator-ssh-keys.nix` (+ `operator-authorized-keys.nix` variant)           |
| **Backed by file**         | `full-ai-cluster/nixos/modules/operator-ssh-keys.txt`                                                      |
| **Iter / backlog**         | iter-4.2 / [081KSGS9H0008QG0R002T3BJ2R](../docs/backlog/)                                                  |
| **Reader entry point**     | `builtins.readFile keysFile` → `users.users.zeta.openssh.authorizedKeys`                                   |
| **Mechanism on Mac**       | `diskutil mount` ESP + `sudo tee` write (read-only on `~/.ssh/`)                                           |
| **Mechanism on installer** | `zeta-install.sh` probes mounted USB FAT/ESP partitions; writes file into `/mnt/etc/zeta/` (or equivalent) |

### 2. Cluster node hostname

| Property                | Value                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | macOS at `zflash` time → USB ESP write                                                                                |
| **Content class**       | Public identifier (RFC1123-validated)                                                                                 |
| **Operator-driven via** | `zflash --host <name>` (default = flake's per-host config)                                                            |
| **ESP filename**        | `zeta-hostname.txt`                                                                                                   |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/injected-hostname.nix`                                                                 |
| **Backed by file**      | `/mnt/etc/zeta/cluster-node-id` (written by installer from ESP)                                                       |
| **Iter / backlog**      | iter-5.2 / [081KSGS9H0008QG0R003V23XNZ](../docs/backlog/)                                                             |
| **Reader entry point**  | `builtins.readFile idFile` → `networking.hostName` (via `lib.mkOverride 50`)                                          |
| **Validation**          | `VALID_HOSTNAME_REGEX` in `zflash-lib.ts`; mirror grep `[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$` in `zeta-install.sh` |

### 3. `zeta` user initial password

| Property                | Value                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| **Stage**               | Cluster console at install time → typed twice                                                     |
| **Content class**       | **Secret material** (NEVER on USB ESP)                                                            |
| **Operator-driven via** | `read -s` prompt in `zeta-install.sh`; Enter to skip → keeps `zeta-change-me` default             |
| **Hash mechanism**      | `mkpasswd -m sha-512 -s` (sha512crypt; reads from stdin to avoid argv exposure)                   |
| **Backed by file**      | `/mnt/etc/zeta/initial-hashedpassword` (chmod 0600, chown root:root)                              |
| **NixOS reader module** | `full-ai-cluster/nixos/modules/initial-password.nix`                                              |
| **Iter / backlog**      | iter-5.3 (+ 081KSGS9H0008QG0R00120EEHM Bug 3b runtime-injection fix)                              |
| **Reader entry point**  | `builtins.readFile` → `users.users.zeta.hashedPassword`                                           |
| **Why console-only**    | Per constitutional rail above; password shouldn't transit Mac keychain OR USB ESP                 |
| **Fallback hash**       | sha512crypt of `zeta-change-me` (BACKWARD-COMPAT; rotate via `passwd zeta` after first SSH login) |

### 4. WiFi credentials

| Property                | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Stage**               | Cluster console at first boot → `nmtui`                                             |
| **Content class**       | **Secret material** (NEVER on USB ESP)                                              |
| **Operator-driven via** | `nmtui` TUI on `zeta-first-boot.sh`                                                 |
| **Backed by**           | NetworkManager system connections (under `/etc/NetworkManager/system-connections/`) |
| **Iter / backlog**      | sibling exception in `zeta-first-boot.sh` (per `zeta-install.sh` line 392 comment)  |
| **Why console-only**    | Same constitutional rail; WiFi PSK is secret                                        |

### 5. Node role (first control plane vs joiner)

| Property                | Value                                                                                                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | macOS/Linux at flash time → USB ESP write                                                                                                                                                                                                                                    |
| **Content class**       | Public identifier (role, flake host attribute, join endpoint)                                                                                                                                                                                                                |
| **Operator-driven via** | `--role first-control-plane\|joiner` `--flake-host <attr>` `--join-server-url https://host[:port]` on the file-backed zflash CLI and `prepare-boot-image.ts`                                                                                                                 |
| **ESP filename**        | `zeta-firstboot.conf`                                                                                                                                                                                                                                                        |
| **NixOS reader module** | none — the conf is read by **bash**: `zeta-first-boot.sh` sources it in preference to the ISO's `/etc/zeta-firstboot.conf`, then execs `zeta-install "$HOST"`. The join URL half is read at Nix evaluation time by `full-ai-cluster/nixos/modules/injected-join-server.nix`. |
| **Backed by file**      | `/mnt/etc/zeta/cluster-join-server-url` (extracted from the conf by `zeta-install.sh`)                                                                                                                                                                                       |
| **Composer**            | `src/Core.TypeScript/zflash/firstboot-role.ts` (pure; unit-tested in `firstboot-role.test.ts`)                                                                                                                                                                               |
| **Validation**          | flake host must match `VALID_FLAKE_HOST_ATTRIBUTE_REGEX`; join URL must be `https` host-and-port; **every emitted value passes `SHELL_SAFE_CONF_VALUE_REGEX` and is single-quoted**, because the file is `.`-sourced by bash                                                 |
| **Iter / backlog**      | 081KSNY2Z0008QG0R0008PN7RQ scenario 5; supersedes the "per-flash `--role` deferred to v2" note in `usb-nixos-installer/nixos/installer/configuration.nix`                                                                                                                    |

**Why it exists:** before this, the role was fixed at ISO-BUILD time
(`environment.etc."zeta-firstboot.conf"` ships `HOST=control-plane`), so every
medium cut from one ISO installed a control plane and a second node could not
be provisioned as a joiner.

**UNEXERCISED.** The composer is unit-tested; the bash and Nix halves have not
been booted. See `JoinBlocker` in `src/Core.TypeScript/zflash/test-harness/scenarios.ts`.

### 5b. Cluster segment addressing — plaintext on ESP, NOT secret, but TAMPERABLE

| Property           | Value                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**          | flash time → USB ESP write, inside `zeta-firstboot.conf`                                                                                                                                                      |
| **Content class**  | Public identifiers (an IPv4 address, a prefix length, a MAC) — **not secret material**                                                                                                                        |
| **Conf keys**      | `ZETA_CLUSTER_NODE_CIDR`, `ZETA_CLUSTER_SEGMENT_MAC`, `ZETA_CLUSTER_CONTROL_PLANE_IP`                                                                                                                         |
| **Composer**       | `src/Core.TypeScript/zflash/cluster-address.ts` (pure; unit-tested in `cluster-address.test.ts`)                                                                                                              |
| **Consumer**       | `zeta-install.sh` re-validates and stages `/mnt/etc/zeta/cluster-segment-address`, `…-segment-mac`, `…-control-plane-address`; `nixos/modules/injected-cluster-address.nix` reads them at Nix evaluation time |
| **Validation**     | derived (never free-typed): founder `.1`, joiner `.2+` in `10.88.0.0/24`; MAC must be six lowercase hex octets **and unicast**; shape re-checked independently in TypeScript, in bash, and in Nix             |
| **Iter / backlog** | 081KSNY2Z0008QG0R0008PN7RQ scenario 5, `joining-node-address-assignment`                                                                                                                                      |

**Why it exists:** the shared cluster segment has no DHCP server and no DNS, so
a joining node had no address and could not resolve the host in its own
`--server` URL. mDNS is not the fix — `k3s-server.nix` records that it was
tried and never resolved, and it ships only `--tls-san=control-plane`, so a
`.local` name would fail certificate verification even if it did resolve.

**HONEST CAVEAT — plaintext and tamperable, stated rather than shipped quietly.**
Unlike point 6, nothing here is secret: an address and a MAC leak nothing by
being readable. The exposure is the other direction — **anyone with physical
possession of the stick can REWRITE these values**, and the obvious attack is
repointing `ZETA_CLUSTER_CONTROL_PLANE_IP` at a rogue node so a joiner dials it.
What limits that, and what does not:

- It **does not** buy a silent takeover of the joiner. The joiner still verifies
  the API certificate against the name `control-plane`, and a rogue node cannot
  present a certificate for it without the cluster CA. The join fails rather
  than succeeding against the wrong cluster.
- It **does** buy denial of service and misdirection — a joiner sent to an
  address that answers nothing, or to a node that can now see its connection
  attempts. Neither is authenticated away by anything on the medium.
- The same physical access already reaches the point-6 join token, which is the
  strictly worse exposure. This is recorded as **not making that any better**,
  not as being safe on its own.
- The long-term home is the same one point 6 names: the AES-256-GCM cred blob
  bound to a passphrase and the USB UUID (081KSKBP80008QG0R003AX2A69).

**UNEXERCISED.** The derivation is unit-tested with no network and no QEMU. The
`injected-cluster-address.nix` no-op path is evaluated (it yields `{}`); the
populated path, the NetworkManager keyfile pickup, MAC-based NIC selection, and
reachability of 6443 across the segment are **UNVERIFIED**. See `JoinBlocker`
in `src/Core.TypeScript/zflash/test-harness/scenarios.ts`.

### 5c. Server-side join — the branch that decides FOUND vs JOIN

| Property                | Value                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | reuses point 5's `zeta-firstboot.conf` and point 6's `zeta-join-token`; **no new ESP file**                                                                                                                                                              |
| **Content class**       | one public identifier (the join endpoint) + one secret (the token, already covered by point 6's recorded exception)                                                                                                                                      |
| **Backed by files**     | `/etc/zeta/cluster-join-server-url` **and** `/etc/zeta/k3s-join-token` (0600) — both staged by `zeta-install.sh` and symlinked so Nix evaluation sees what the installed system will see                                                                 |
| **NixOS reader module** | `nixos/modules/injected-server-join.nix`                                                                                                                                                                                                                 |
| **Validation**          | ALL-OR-NONE. Both present ⇒ `clusterInit := false`, `serverAddr := <url>`, `tokenFile := /etc/zeta/k3s-join-token`. Exactly one present ⇒ **assertion failure at Nix evaluation**, naming which half is missing. Neither ⇒ founding, byte-for-byte unchanged |
| **Runtime guard**       | `nixos/modules/k3s-datastore-preflight.nix` — refuses to start k3s when a node provisioned to join already holds a datastore, because k3s IGNORES every one of the options above in that state                                                            |
| **Checked by**          | `nixos/tests/k3s-server-join-eval-test.nix` (5 scenarios) · `src/Core.TypeScript/hygiene/lint-k3s-datastore-preflight.test.ts` (executes the guard over fixtures)                                                                                        |

**Why it exists:** point 5 provisioned a role, and `injected-join-server.nix`
guards itself to `services.k3s.role == "agent"`. So a WORKER could be told to
join and a CONTROL PLANE could not — every machine built from the
`control-plane` flake host called `--cluster-init` and founded its own cluster
whatever the medium said. The signature of that defect is two k3s CAs on one
LAN with founding epochs twelve days apart.

**Why the token is NOT at `/var/lib/rancher/k3s/server/token`:** k3s manages and
writes that path itself. Pre-seeding it conflates "the credential I present to
join" with "the credential I hand out". `/etc/zeta/k3s-join-token` is neither.

**Only its PRESENCE is read at evaluation time.** A NixOS module evaluates into
the world-readable Nix store, so `builtins.readFile` on a cluster credential
would copy it there. The `K10<64 hex>::…` content check stays in
`zeta-install.sh`, on the machine, where the bytes already are.

**UNEXERCISED on hardware.** Every branch is pinned at Nix evaluation and the
runtime guard is executed over fixtures in CI; nothing here has been booted.

### 6. k3s node-token (joiner) — plaintext on ESP, opt-in

| Property                  | Value                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                 | flash time → USB ESP write, **only when explicitly requested**                                                                                                         |
| **Content class**         | **Secret material, stored PLAINTEXT** — see the caveat below                                                                                                           |
| **Operator-driven via**   | `--join-token <path>` (requires `--role joiner`)                                                                                                                       |
| **ESP filename**          | `zeta-join-token`                                                                                                                                                      |
| **Consumer**              | `zeta-install.sh` copies it to `/mnt/var/lib/rancher/k3s/agent/token` (0600), which is exactly the path `nixos/modules/k3s-agent.nix` sets as `services.k3s.tokenFile` |
| **Source of the value**   | the founding server's `/var/lib/rancher/k3s/server/node-token`                                                                                                         |
| **Shape, enforced twice** | `K10<64 lowercase hex>::<creds>` — refused at flash time by `firstboot-role.ts` `validateJoinTokenMaterial`, and again by `zeta-install.sh` before install             |

**WHY THE SHAPE IS ENFORCED AND NOT ASSUMED (traced upstream 2026-08-21).** The
`K10<hash>::` prefix is not decoration; it is the only thing authenticating the
server a joiner hands its credential to. In k3s `pkg/clientaccess/token.go`:

- `parseToken` does **not** reject a token lacking the prefix — it rewrites it
  to `K10:::<password>`, so `caHash` becomes the empty string.
- `getCACerts` downloads the cluster CA from `/cacerts` using `insecureClient`,
  declared in that same file with `tls.Config{InsecureSkipVerify: true}`.
- `validateCAHash` with an empty `caHash` and a non-empty CA bundle emits
  `logrus.Warn(...)` and returns nil — the join proceeds.

So a bare shared secret (`K3S_TOKEN=hunter2`) yields a joiner that accepts
whatever CA answers first on the segment and then presents the cluster token to
it. `https://` in the server URL does not close this: the request that ignores
TLS is the CA download itself. Refusing the shape costs a correct operator
nothing — `server/token` and its `node-token` symlink are both written by
`handlers.WriteToken` → `clientaccess.FormatToken`, which always prepends the
digest.

**CONSTITUTIONAL-RAIL CAVEAT — read before using this on real hardware.** Point
7's "Encrypted cred-blob" earns its place on the ESP by being AES-256-GCM
encrypted and bound to an operator passphrase plus the USB UUID. **This one is
not.** A k3s node-token written here sits in the clear on a FAT filesystem that
anyone with physical possession of the stick can read, and it grants cluster
membership. That is a weaker bar than the rail sets for secret material, and it
is recorded as a gap rather than argued away:

- It is **never written implicitly** — only when the operator passes `--join-token`.
- It is intended for the QEMU harness, where the token is deterministic test
  material and the "stick" is a file in `/tmp`.
- The correct long-term home is the existing encrypted blob path
  (081KSKBP80008QG0R003AX2A69), which already has the passphrase + UUID binding
  this needs. Folding the join token into that blob is the follow-up.

### 9. Workload identity (SPIFFE) at the door — NOT SHIPPED; derivation + policy only

081KTWFYC9108QG0R001C8RDPK. What exists today is **pure derivation and policy**
in `src/Core.TypeScript/zflash/injection-rail.ts`. **No workload identity is
issued, sealed, bound, attested, or injected by anything in this repo.** No
node has been flashed or booted against any of it.

A SPIFFE workload identity is three artifacts, and only the third is what people
mean by "the key":

| Artifact                                       | Content class     | ESP verdict |
| ---------------------------------------------- | ----------------- | ----------- |
| SPIFFE ID (the URI)                            | public identifier | permitted   |
| trust bundle (trust-domain CA **public** keys) | public identifier | permitted   |
| SVID **private key**                           | secret material   | **refused** |

The refusal has two independent reasons, either sufficient: the rail (secret
material, unencrypted medium), and SPIFFE's own design — the workload generates
its own private key and only a CSR leaves it. So the honest reading of "keys
injected at the door" is that **the key is not injected**; what can travel with
the medium is the public half and the node coordinate.

**The composition that already exists:** the hostname zflash writes to
`/zeta-hostname.txt` is exactly the `@<node>` coordinate of the identity-treaty
form (`docs/research/2026-07-03-persona-cell-identity-treaty-*` Article 3,
`spiffe://zeta/persona/<persona>/cell/<surface>[/<instance>][@<node>]`).
`deriveNodeWorkloadSpiffeId` derives it and validates by round-tripping through
`parseSpiffe` — necessary, because `VALID_HOSTNAME_REGEX` accepts uppercase and
the actor-ref segment charset does not, so `--host Node-A` flashes cleanly and
yields a SPIFFE ID this repo's own parser rejects.

**Missing injection point (candidate, not filed as a change):** the **trust
bundle** has no ESP destination. It is a public identifier, so the rail permits
it, and without a trust anchor on the medium a booting node has nothing to
verify an issuer against — first contact is TOFU. Adding an ESP destination is
key handling and therefore behind this work-item's review gate (Nazar + Mateo),
so it is named here rather than shipped.

**Custody decisions this deliberately does NOT make** (`WORKLOAD_IDENTITY_CUSTODY_DECISIONS`,
each `decided: false`, asserted by test):

1. Where an SVID private key is **sealed at rest** — TPM 2.0, Secure Enclave,
   software keystore, or nothing. (The 2026-08-14 hardware probe found no TPM
   and no usable seal tier on the Mac Studio; the x86 nodes are unprobed.)
2. Whether the node identity is **TPM-bound** — sealing and binding are separate
   choices and either can be made without the other.
3. **Who authorizes issuance** at first boot. SPIRE node attestation answers
   "which node is this" from a vendor-rooted claim; nothing here answers "and
   may it have an identity in this trust domain".
4. Which **governance class** a node workload key takes (self-sovereign /
   shared-capability / delegated-operational — taxonomy fixed by the 2026-08-14
   L0→L6 ladder, per-key assignment explicitly left to ratification).

## Operator-driven `zflash` flag inventory (current)

Allowlist from `zflash.ts`:

```text
--help / -h          show usage + exit
--ssh-key <path>     override SSH pubkey injected to ESP
                     (default: ~/.ssh/id_ed25519.pub)
--no-inject          skip SSH pubkey injection entirely
--host <name>        inject RFC1123 hostname to ESP as zeta-hostname.txt
--skip-freshness-check
                     bypass main-vs-local divergence check
                     (NOT recommended — surfaces silent flash-without-inject hazard)
--skip-iso-pull      use the existing newest ~/Downloads/zeta-installer-*.iso
                     instead of pulling latest CI artifact
--agent              authorized-agent mode (auto-types `yes <nonce>` challenge;
                     operator's Touch ID still gates the dd)
```

## In-flight injection points (substrate-engineering targets — not yet shipped)

### 7. Encrypted cred-blob on USB ESP (081KSKBP80008QG0R003AX2A69 Phase 1, in-flight)

| Property                           | Value                                                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                          | Cluster console at install time → encrypted blob persisted to USB ESP after successful auth (post-install service trigger)                                                                                                                                          |
| **Content class**                  | **Secret material** (encrypted-at-rest; key never hits disk)                                                                                                                                                                                                        |
| **Operator-driven via**            | Boot-sequence auth-method picker (4 options: restore-from-blob / fresh-device-flow / operator-PAT / skip) + operator passphrase                                                                                                                                     |
| **Encryption**                     | AES-256-GCM; key derived via 2-layer scrypt → HKDF chain (full mechanism + parameters below)                                                                                                                                                                        |
| **ESP filenames**                  | `/esp/zeta-creds.enc` (encrypted) + `/esp/zeta-creds-manifest.yaml` (declarative + operator-readable)                                                                                                                                                               |
| **Backlog**                        | [081KSKBP80008QG0R003AX2A69](../docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md) (P1, open, M-effort)              |
| **Covers credentials**             | per declarative manifest: `gh-cli` (`~/.config/gh/hosts.yml`), `claude` (per-persona), `gemini` (per-persona), `codex` (per-persona), `ssh-host-keys`, `ssh-operator-pubkey`                                                                                        |
| **Constitutional-rail compliance** | Secret material; encrypted-at-rest on ESP IS allowed because the operator-passphrase + USB-UUID binding means the ESP-stored blob is useless without operator presence — the consent floor stays at operator-typed passphrase, not at USB-physical possession alone |

#### KDF chain detail (mechanism + parameters)

The 32-byte AES-256-GCM key is derived in two layers; full implementation in `tools/installer/zeta-creds-crypto.ts` (the `deriveKey` function + the `SCRYPT_*` + `KEY_LEN` + `SALT_LEN` + `HKDF_INFO` constants declared near the top of the file).

**Layer 1 — scrypt** (memory-hard work-factor KDF):

```text
stretched = scrypt(passphrase, salt, length=32, N=2^17, r=8, p=1, maxmem=256MB)
```

scrypt does NOT increase the underlying entropy of the operator passphrase (a weak passphrase remains weak in information-theoretic terms). What scrypt provides is a tunable **work-factor cost** per guess: with the parameters below, each candidate passphrase requires ~128MB of memory and (empirically per `zeta-creds-crypto.ts` Layer 1 source comments, on the maintainer's modern CPU at parameter-selection time) ~1-2 seconds of CPU per derivation. This makes brute-force attacks memory-prohibitively expensive on GPU/ASIC (per the 2026-05-27 security-review HIGH finding documented in the source: HKDF alone assumes high-entropy IKM, which user-typed passphrases violate; scrypt is the layer that makes the IKM cryptographically suitable for HKDF input).

Parameter selection: `N=2^17`, `r=8`, `p=1` — per [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) recommended scrypt parameters (current at parameter-selection time 2026-05-27; bump procedure: visit the cheat sheet at next security-review cadence, update both the cheat-sheet-citation date here AND the `SCRYPT_N`/`SCRYPT_R`/`SCRYPT_P` constants in `zeta-creds-crypto.ts`). Per-machine operational cost will vary with CPU + memory bandwidth; the ~1-2s figure is anchored to the source-code comment's empirical timing context.

**Layer 2 — HKDF-SHA256** (binds key to USB UUID):

```text
ikm  = concat(usbUuid_utf8, "|", stretched)
key  = HKDF-SHA256(ikm, salt, info="zeta-b0852-cred-persistence-v1", length=32)
```

HKDF binds the stretched secret to the USB UUID via IKM concatenation. Wrong USB → different IKM → different HKDF output → AES-GCM auth tag verification fails → structured error returned (not garbled plaintext). Defends against copy-blob-to-different-USB attack (operator-named threat 2026-05-27: _"we can put a key on the usb too if wnated tied to the uuid so it can't be copied to uuid"_).

Both layers must reproduce identically at decrypt time for the AES-GCM auth tag to verify; salt is per-blob (generated at encrypt time; stored in envelope; required at decrypt).

### 8. GitHub-creds-at-flash-time variants (081KSKBP80008QG0R003AX2A69 picker options 1 + 3)

Per operator 2026-05-27 verbatim: _"the current ones on my machine OR a token i generate on the website."_

Maps directly to 081KSKBP80008QG0R003AX2A69 Sub-target 2 (boot-sequence auth-method picker):

| Picker option                                 | Operator-driven via                                                                | Credential source                                                                                                    | Constitutional-rail compliance                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Option 1: Restore from encrypted USB blob** | Operator passphrase at boot picker prompt; default when blob present               | Previously-persisted operator Mac `~/.config/gh/hosts.yml` (encrypted into the blob on prior boot's successful auth) | Encrypted-at-rest; operator-passphrase-derived key |
| **Option 2: Fresh device-flow login**         | Operator visits github.com on phone/browser to enter device code                   | gh CLI device-flow (current behavior; uses gh-CLI quota)                                                             | Operator-driven directly; no transit issue         |
| **Option 3: Operator-provided PAT**           | Operator pastes fine-grained PAT at prompt (created at github.com/settings/tokens) | Operator-typed at cluster console                                                                                    | Typed once; same rail as initial-password          |
| **Option 4: Skip**                            | Operator presses Enter at picker                                                   | (no GitHub-side substrate)                                                                                           | Cluster operates degraded; no inject               |

## Architectural-principle layer — USB self-healing direction on reformat (operator 2026-05-27)

Operator 2026-05-27 verbatim:

> _"this makes the usb move in the self healing instead of full wipe direction on reformat"_

Substrate-engineering principle: when 081KSKBP80008QG0R003AX2A69 lands, **the DEFAULT behavior on USB reformat = preserve previous keys + choices** (081KSKBP80008QG0R00146WEX1's reformat-with-current-keys mode). Full-wipe (new-keys + new-decisions) becomes the OPT-IN path, not the default.

Three-mode reformat substrate (per [081KSKBP80008QG0R00146WEX1](../docs/backlog/P1/081KSKBP80008QG0R00146WEX1-post-boot-ai-as-home-owner-not-controlled-runtime-every-knob-from-first-boot-aaron-2026-05-27.md)):

| Mode                                          | What it does                                                                                         | Default?                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **1. Boot off USB again (fix mode)**          | Substrate diagnoses + repairs broken state on cluster machines                                       | Always available                            |
| **2. Reformat with current keys + decisions** | Wipe cluster machine; reflash from USB; restore previously-persisted creds + architectural decisions | **DEFAULT post-081KSKBP80008QG0R003AX2A69** |
| **3. Full reflash with new decisions + keys** | Wipe cluster machine; reflash from USB; generate new creds + start fresh architectural state         | Opt-in (fresh-identity case)                |

This direction-of-default matters because:

- **AI worry-about-mistakes dissolves** when reformat preserves identity (per 081KSKBP80008QG0R00146WEX1 operational-freedom mechanism)
- **Operator re-flash workflow becomes lower-friction** (the common case = preserve; the rare case = wipe)
- **Cred-leak / identity-corruption recovery stays available** via mode 3 opt-in (not default)
- **Self-healing direction composes with operator's persistent-recovery vision**: 3-machine quorum + remote-KVM + remote-power-button-press (per 081KSKBP80008QG0R00146WEX1) means substrate survives as long as ONE of {any cluster machine, the USB, operator's re-flash ability} survives

Operator's substrate-honest acknowledgment 2026-05-27: _"i know you can't preserve what i have now but for the next time would be cool"_ — current ISO (`fd0ca0c8b` 25.11 Xantusia) doesn't yet ship 081KSKBP80008QG0R003AX2A69; this catalog tracks the direction for when it does. Today's flash IS full-wipe-default (because mode 2 doesn't exist yet); next flash post-081KSKBP80008QG0R003AX2A69 IS preserve-default.

## Related in-flight backlog (composes with this catalog)

- [081KSGS9H0008QG0R003JNSVR5](../docs/backlog/P1/081KSGS9H0008QG0R003JNSVR5-installer-interactive-login-vs-baked-in-keys-ci-test-tension-resolve-without-shipping-credentials-aaron-2026-05-26.md) — installer interactive-login vs baked-in keys tension
- [081KSGS9H0008QG0R00120EEHM](../docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md) — installer-config-bugs RCA (gh-auth not respected, banner password disclosure, etc.)
- [081KSGS9H0008QG0R001EZKNCB](../docs/backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-implementation-gap-aaron-2026-05-26.md) — zflash `--agent` flag native implementation
- [081KSGS9H0008QG0R002T0XQ50](../docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-each-ai-gets-own-github-identity-with-email-once-cluster-operational-substrate-honest-attribution-end-to-end-closes-enabledby-token-owner-not-actor-algo-wink-aaron-2026-05-26.md) — each AI gets own GitHub identity (per-persona attribution)
- [081KSGS9H0008QG0R001JNKBFD](../docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-node-local-claude-agent-stewards-own-registration-pr-then-reports-k8s-cluster-status-operator-interactive-login-pattern-aaron-2026-05-26.md) — node-local Claude agent stewards own registration PR
- [081KSKBP80008QG0R003AX2A69](../docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md) — credential persistence on USB ESP + boot-sequence auth-method picker (the active substrate this catalog cross-references for in-flight rows 5 + 6 above)
- [081KSKBP80008QG0R00146WEX1](../docs/backlog/P1/081KSKBP80008QG0R00146WEX1-post-boot-ai-as-home-owner-not-controlled-runtime-every-knob-from-first-boot-aaron-2026-05-27.md) — post-boot AI as home-owner; 3-mode USB-boot recovery substrate (fix / reformat-with-current-keys / full-reflash); operational-freedom mechanism; AI-worry-about-mistakes dissolves

## Remaining gaps (no backlog row yet — candidates per constitutional rail)

Substrate-engineering targets NOT covered by 081KSKBP80008QG0R003AX2A69 or sibling rows.
Each new credential-type filing should walk the constitutional-rail
decision before authoring: **public identifier → ESP allowed; secret
material → console or post-install secrets management only**.

When 081KSKBP80008QG0R003AX2A69 ships, secret-class additions become MANIFEST EDITS
(declarative; new entry in `/esp/zeta-creds-manifest.yaml`) rather than
new code. Per Aaron 2026-05-27 in 081KSKBP80008QG0R003AX2A69: _"the keep credentials options
we should declare each credential we need and save and restore so it's
not so imparative too."_ Adding a new cred type post-081KSKBP80008QG0R003AX2A69 = one YAML
entry; the persist/restore code reads the manifest + iterates.

| Candidate                                       | Content class | Likely transit (post-081KSKBP80008QG0R003AX2A69)                                       | Notes                                         |
| ----------------------------------------------- | ------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| GPG signing key (operator)                      | Secret        | 081KSKBP80008QG0R003AX2A69 manifest extension                                          | Per constitutional rail                       |
| age key (operator)                              | Secret        | 081KSKBP80008QG0R003AX2A69 manifest extension                                          | For SOPS / age-encrypted state                |
| K8s join token                                  | Secret        | Cluster console at install time OR auto-generated on bootstrap                         | Per constitutional rail                       |
| ArgoCD admin initial password                   | Secret        | Cluster console at install time                                                        | Per constitutional rail                       |
| Cosign signing key (cluster-issued)             | Secret        | Post-install secrets mgmt                                                              | For artifact signing                          |
| Cluster TLS root CA                             | Secret        | Post-install secrets mgmt                                                              | For internal-CA bootstrap                     |
| Tailscale / WireGuard auth key                  | Secret        | 081KSKBP80008QG0R003AX2A69 manifest extension                                          | For overlay-network bootstrap                 |
| Time-server NTP override                        | Public config | USB ESP at flash time (candidate)                                                      | Cheap; non-secret                             |
| Locale / timezone                               | Public config | USB ESP at flash time (candidate)                                                      | Cheap; non-secret                             |
| Per-node disk role hints                        | Public config | USB ESP at flash time (candidate)                                                      | Currently in flake per-host config            |
| **GHCR pull token (`zeta-platform/ghcr-pull`)** | **Secret**    | **Cluster console at install time, OR retired entirely by making the packages public** | **Live blocker, not a candidate — see below** |

### The GHCR pull token is the first entry here that is BLOCKING something today

Every other row above is a target. This one names why the metal platform control
plane has never started, and it is recorded here because the constitutional rail
already decides how it would have to arrive.

**Measured 2026-08-22.** `ghcr.io/lucent-financial-group/zeta-platform-controller`
and `.../zeta-portal` are both `visibility: private` (36 published versions each,
built by `.github/workflows/build-platform-images.yml`). An anonymous manifest GET
returns HTTP 401; a credentialed one returns 200. The pods therefore take
`ImagePullBackOff` on **every** substrate, and ArgoCD reports that as
`Progressing` rather than `Degraded`, so nothing ever went red about it.

**The dev/CI half is now wired** — `applyDevRegistryPullSecret` mints
`zeta-platform/ghcr-pull` at bring-up from a token in the environment, and both
pod specs reference it. CI can do this because a workflow already holds a token.

**Metal cannot**, and that is the finding worth stating plainly against the
standing goal that hardware comes up with no manual step:

> A registry pull token is **secret material** under the rail at the top of this
> file, so its only sanctioned transit is **operator-typed at the cluster console
> at install time** (or, later, the encrypted cred-blob of
> 081KSKBP80008QG0R003AX2A69). There is no path by which an unattended node
> obtains it. **So as long as these packages are private, unattended metal
> bring-up of `platform` is not achievable** — not for want of automation, but
> because the node has no way to hold a credential nobody gave it.

**The exit that removes the requirement rather than satisfying it** is making the
two packages public, after which `imagePullSecrets` becomes inert and metal needs
no credential at all. That is a **disclosure decision and it is the maintainer's
alone** — it is recorded here as the alternative, not advocated. The two options
are genuinely different trades: operator-typed keeps the images closed and costs a
manual step per cluster; public costs disclosure and buys unattended bring-up.

## Source-of-truth pointers

- `src/Core.TypeScript/zflash/cli.ts` — flash-time orchestrator + USB ESP injection
- `src/Core.TypeScript/zflash/lib.ts` — pure logic (hostname regex; ESP partition detection)
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` — installer-side injection probes + console prompts
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` — first-boot console prompts (WiFi)
- `full-ai-cluster/nixos/modules/injected-hostname.nix` — hostname reader
- `full-ai-cluster/nixos/modules/operator-ssh-keys.nix` — SSH pubkey reader
- `full-ai-cluster/nixos/modules/operator-authorized-keys.nix` — sibling SSH authorized_keys reader
- `full-ai-cluster/nixos/modules/initial-password.nix` — password hash reader

## Substrate-engineering composition

- 081KSGS9H0008QG0R002T3BJ2R (iter-4.2 SSH pubkey injection)
- 081KSGS9H0008QG0R003V23XNZ (iter-5.2 hostname injection)
- 081KSGS9H0008QG0R00120EEHM (initial-password runtime activation fix)
- 081KSKBP80008QG0R0039RW25E (streams-are-relationships substrate — each injection-point pipeline is a tiny typed function per the distribute-across-tiny-functions architectural principle)

## Composes with rules

- `.claude/rules/non-coercion-invariant.md` HC-8 — secret-class material requires operator-typed consent at the cluster console; ESP-transit for non-public secrets would violate HC-8 floor
- `.claude/rules/glass-halo-bidirectional.md` — each injection mechanism is type-visible; operator can inspect every path
- `.claude/rules/honor-those-that-came-before.md` — iter-4.2 / 5.2 / 5.3 substrate preserved + named in catalog
- `.claude/rules/verify-existing-substrate-before-authoring.md` — this catalog is the substrate-inventory pass for future credential-type additions
