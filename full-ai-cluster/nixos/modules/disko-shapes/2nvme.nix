# Backward-compat import: use longhorn-node.nix directly.
# Same module covers 1-disk (extraDisks = [ ]) and 2+ disk nodes.
{ ... }: {
  imports = [ ./longhorn-node.nix ];
}
