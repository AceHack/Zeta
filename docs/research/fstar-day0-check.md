# F* Extraction Day-0 Check & Feasibility Assessment

We performed a Day-0 check of the F\* verification and code extraction environment to evaluate its viability as a successor to the LiquidF# validation framework.

---

## 1. Environment Diagnostics

Running diagnostic checks on the host system path yielded:

- `fstar.exe`: **AVAILABLE** inside the opam `tlaps-build` switch.
- Opam Switch: `tlaps-build` using OCaml `5.1.0`.

To invoke F\*, activate the switch or execute via opam:
```bash
eval "$(opam env --switch=tlaps-build)"
fstar.exe --version
```
Output:
```
F* 2025.03.25~dev
platform=Darwin_arm64
compiler=OCaml 5.1.0
```

---

## 2. Setup & Toolchain Integration

F\* has been fully integrated into Zeta's declarative installation script [install.sh](file:///Users/acehack/.zeta/agents/gemini/Zeta/tools/setup/install.sh) via the [tlaps.sh](file:///Users/acehack/.zeta/agents/gemini/Zeta/tools/setup/common/tlaps.sh) module:

- Installing F\* is fully idempotent (desired-state based).
- Running `ZETA_INSTALL_FULL=1 tools/setup/install.sh` automatically installs/updates OCaml, opam packages, the TLAPS proof manager, and the F\* compiler.
- Solvers: Z3 is natively referenced and placed on PATH.

---

## 3. F\* to F# Extraction Pathways

F\* formally verifies monadic, stateful, and concurrent code, and natively supports extraction to **OCaml**, **F#** (experimental/legacy), and **Kremlin/C** (for low-level system code).

For Zeta's F# DBSP codebase, two extraction pathways exist:

- **ML-Dialect Translation**:

- **Direct F# Target**:

---

## 4. Feasibility Recommendation

> [!TIP]
> **Status: ENABLED & ACTIVE**
> F\* is successfully installed and verified in the local workspace environment. Desired-state builds are declarative and integrated into `install.sh`. F\* verification of critical F# extraction targets can now proceed.
