-- Library root for the `Privacy` lean_lib (see lakefile.toml).
-- Exists so `lake build` walks these proofs; a module no root reaches is never compiled.
import Privacy.IdentityForcesPrivacy
import Privacy.UnboundedNeedsInfinitePrivacy
