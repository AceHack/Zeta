# `nixos/tests/fixtures/server-join/`

Fixtures that let the shipped join modules be **driven** by tests instead of
only read. `injected-server-join.nix` takes its two input paths as *options*
precisely so a test can point them somewhere that exists at evaluation time;
a module with hardcoded absolute paths could only ever be inspected.

| file | read by | what it is |
|---|---|---|
| `cluster-join-server-url` | `k3s-server-join-eval-test.nix` | the join endpoint, `https://control-plane:6443` — a **name**, because `--tls-san=control-plane` in `k3s-server.nix` is what the API certificate is valid for |
| `token-present-marker` | `k3s-server-join-eval-test.nix` | an empty placeholder. The module reads only `builtins.pathExists` on its token path, never the contents, so the eval test needs no credential at all |

## Why the VM test does not use a fixture here

`k3s-server-join.nix` boots two guests, so its inputs must exist at
**evaluation** time (the module decides join-vs-found with
`builtins.pathExists`) *and* inside the **guest** at runtime (k3s opens the
token file). A committed fixture satisfies neither cleanly:
`"${./fixture}"` copies to a store path that pure `nix flake check` evaluation
will not materialise, and `toString ./fixture` — correct for the eval test,
which boots nothing — yields a path with no string context, so the file never
enters the VM closure.

That test therefore builds both inputs with `builtins.toFile`, which writes
during evaluation *and* carries context. A consequence worth having: no
pseudo-credential is committed anywhere in this directory.
