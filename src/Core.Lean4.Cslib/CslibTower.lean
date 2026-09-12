-- Smoke: the CSLib tower builds and cslib is importable. The G1 work (Byzantine-fault
-- extension to FLP/Consensus) is authored from here; this file just proves the tower stands.
import Cslib

-- ANTI-VACUITY, added 2026-09-11 with the CI lane (.github/workflows/lean-cslib.yml).
--
-- `theorem cslib_tower_smoke : True := trivial` below was this file's ENTIRE content, and
-- it compiles just as happily with the `import Cslib` line deleted -- a smoke test that
-- cannot detect the absence of the thing it smoke-tests. The two names below are the
-- FLP/Consensus declarations the G1 Byzantine-fault lift extends, so naming them makes
-- `lake build` ITSELF fail when cslib is not there, or when the pinned rev (e0573fbc, see
-- lakefile.toml) moves or renames them. `#check` rather than a `def`/`example`: both are
-- universe-polymorphic and a term-level reference leaves universe metavariables, while an
-- unresolved name in `#check` is still an elaboration error and still fails the build.
-- The CI lane audits the same two names AND their axiom sets; this is the half that holds
-- for anyone running `lake build` by hand.
#check @Cslib.FLP.Consensus.fault_mono
#check @Cslib.FLP.ZeroFaultAlg.consensus_zero

theorem cslib_tower_smoke : True := trivial
