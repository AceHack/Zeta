# `zs` (zeta shell) is the default login shell — SSH and console

**Aaron, 2026-06-07** (extending the boot/login model):

> "if you ssh in or login at mouse/keyboard it should default into `zs` zeta shell interactive mode."

A Zeta node's **default login shell is `zs`** — the interactive zeta shell. Both entry paths land there:

- **SSH login** → `zs` interactive mode.
- **Physical console** (mouse/keyboard at the box; getty/local TTY) → `zs` interactive mode.

## What `zs` is

`zs` is already defined in the grammar (`ZetaCli`, #6967): a shorthand for `zeta run shell` — the
**interpreter front-end** (the REPL) over the universal `[seam] verb noun [dependson]` grammar (contrast
`zc` = `zeta run cell`, the durable CLI). So "default into zs" means: when a human arrives (remotely or
physically), they get the **interactive zeta REPL**, not bash — every command they type is a
`ZetaCommand` (parsed, context-resolved, rendered; homoiconic with the `.ace`/`.zeta` file and the data
plane). The shell IS the grammar.

## Why

- **One interface for humans and the substrate.** A human at the keyboard drives the same seam/verb/noun
  grammar the agents and files use (recursive/self-similar §9/§10). No context switch between "the shell"
  and "the system" — `zs` is both.
- **Consistent with the boot floor.** A node that bootstraps as 3 systemd cells (#7014) + git control
  plane (#6994) presents `zs` as its operator surface — login → REPL over the live event stream, not a
  generic POSIX shell that knows nothing about Zeta.
- **Continuity (#7011).** The interactive session can carry the node's trace/identity — the operator's
  commands are events on the same stream, with the same continuity guarantees.

## Honest scope (peel)

Design/login-surface point, not new code. The `zs` **grammar parser** exists (`ZetaCli`, #6967); what's
named here is (a) the interactive **REPL binary** that loops parse→resolve→execute→render, and (b) the
**login-shell wiring** (set `zs` as the login shell for SSH + console — a NixOS `users.users.<n>.shell` /
`/etc/shells` + getty/sshd config concern in the install layer). Neither the REPL loop nor the login-shell
wiring is built here. Safety note: a non-POSIX login shell needs a **fallback/escape to a real shell**
(recovery path) so a broken `zs` can't lock an operator out of the box — call that out before wiring it as
the default.

## Anchors (Beacon)

- **Custom login shells** — `/etc/shells`, `chsh`, NixOS `users.users.<n>.shell`; getty/sshd shell
  invocation; restricted shells (rbash) as prior art for "shell ≠ bash".
- **REPL front-ends** — the interpreter/REPL pattern (`zs`) vs durable CLI (`zc`).
- Internal: #6967 (ZetaCli grammar; `zs`/`zc` shorthands), #6994 (git control plane), #7014 (systemd-cell
  floor), #7011 (trace continuity), manifesto §9 recursive / §10 self-similar.
