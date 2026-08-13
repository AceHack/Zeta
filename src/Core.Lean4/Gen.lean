-- Library root for the `Gen` lean_lib (see lakefile.toml).
-- Exists so `lake build` walks these proofs; a module no root reaches is never compiled.
import Gen.HomoiconicFixpoint
