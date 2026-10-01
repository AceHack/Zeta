---
id: 081M3TRMTXW087G0R003E10WDE
type: bug
state: backlog
priority: P2
slug: root-permission-defects-first-session-marker-dir-root-owned
title: "Root/permission defects: first-session marker dir root-owned, restored creds written 0644 + wifi EISDIR, sudo option order in installer logins"
created: 2026-10-01T03:38:04.604Z
depends_on: []
composes_with: []
---

# Root/permission defects: first-session marker dir root-owned, restored creds written 0644 + wifi EISDIR, sudo option order in installer logins

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3TRMTXW087G0R003E10WDE-*.md` glob. -->

Audit of root/ownership/mode defects on the installed system after #17723. Found and fixed:

1. **First-session marker directory root-owned** (`zeta-first-session.nix`). tmpfiles made
   `/var/lib/zeta-first-session` `root root 0755` under a comment claiming the hook writes the
   marker with sudo; it does not. The conductor writes the marker and its journal as the logged-in
   user, so both were EACCES and the credential adventure re-ran on every interactive login.
2. **Restored credentials written 0644** (`zeta-creds-restore.ts` `applyPlan`, root under umask 022):
   tokens world-readable; a persisted ssh private host key refused by sshd; a NetworkManager keyfile
   ignored. Now a named secret set is written 0600 (and an old 0644 copy is repaired, not skipped).
3. **Wifi restore threw EISDIR** — the manifest path is the `system-connections` directory. The
   throw killed the unit under `set -e`, skipping the ownership pass, so earlier writes stayed
   root-owned in ~. Now the blob is filed as a keyfile inside the directory, and the unit holds the
   restore's exit status until after an uncapped (`-maxdepth 4` removed), `chown -h` pass.
4. **`sudo HOME=... -u uid cmd`** in the installer's `claude login` / `codex login`: options after a
   VAR=value are not parsed as options. Reordered.

Not verified here: the POSIX mode assertions (the author's machine is Windows, they are skipped
there and run on the Linux CI leg); no nix evaluation or booted ISO was available.
