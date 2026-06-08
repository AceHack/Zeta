# The Ace CLI and `.ace` files are homoiconic — one representation (Aaron, 2026-06-07)

Crystallizes the Ace surface (#6957/#6960/#6961). Aaron:

> *"yes, ace CLI and .ace files (or whatever we call them) would look homoiconic."*

## The kernel: command = file = data

The Ace **CLI invocation** and the **`.ace` file** are the **same representation** — homoiconic:

- A CLI command `ace ensure npm[www.privaterepo.com].bar` **is a one-line `.ace` file.**
- A `.ace` file **is a sequence of those same `seam verb noun` statements** (#6957).
- **Both are the same data** — `seam/verb/noun` statements as **DynamicValue** (the Zeta IDL, #6955; the
  YinYang/code-as-data form, #6953). There is no separate "CLI syntax" vs "file syntax": the command line and
  the file are two surfaces of one underlying data structure.

So you can: type a line at the CLI, or save it in a `.ace` file, or generate it as DynamicValue, or store/ship
it as a content-addressed noun — interchangeably. **The program text is the data the system manipulates** —
homoiconicity (Lisp's "code is data"), applied to the install/setup surface.

## Why it's not just neat — it's load-bearing

- **It makes seams-as-Ace-files (#6961) coherent.** Seams are Ace files; Ace files are CLI statements; CLI
  statements are DynamicValue. One representation at every scope (command → file → seam → env) — manifesto §9/§10
  recursive/self-similar, *because* it's homoiconic.
- **Capture/replay/compose for free.** A CLI session **is** a `.ace` file (record what you typed = a runnable
  file); a `.ace` file **is** a script you can paste line-by-line. Reproducibility (#6960) and the `test` seam
  (#6958) operate on the *same* data whether it came from the CLI or a file.
- **Generation is trivial.** Because the surface is data (DynamicValue), the type provider / generators
  (#6925/#6945) emit `.ace` content as data, and tools read/transform it as data — no parse/serialize
  impedance between "what you type" and "what's stored."
- **The IDL closes the loop.** The Zeta IDL (#6955) is the spec-as-data; the Ace CLI/`.ace` file is that IDL's
  *imperative-looking but actually-declarative* surface — homoiconic with the spec it realizes.

## Honest scope / peel

- Design/naming crystallization, not built. `.ace` is a **tentative** extension name (naming-gated:
  `naming-expert` + collision check, like zs/zc #6957 and the NVIDIA-ACE flag #6946 — "or whatever we call
  them" is Aaron's own hedge).
- "Homoiconic" here means **one shared data representation** (CLI line ≡ file line ≡ DynamicValue statement),
  resolved/executed the same way — not a claim of a full Lisp-grade macro system (that could follow, but isn't
  claimed).
- Most CLI/file pairs are *similar* (shell scripts); the Ace claim is stronger — the shared form is the
  **DynamicValue AST itself** (the IDL), not just "lines that look alike."

## Ties

- **Homoiconic memory↔function routing (#6889) + YinYang file / code-as-data (#6953)** — this is homoiconicity
  at the Ace CLI/file surface.
- **CLI seam/verb/noun grammar (#6957)** — the shared statement form.
- **Ace file = content-addressed Dockerfile (#6960) + seams-are-Ace-files (#6961)** — one representation at
  every scope; this names *why* (homoiconic).
- **Zeta IDL / spec-as-data (#6955)** — the Ace surface is the IDL's homoiconic face.
- **Type provider / generators (#6925/#6945)** — generate `.ace` as data.

## Beacon anchors

- **Homoiconicity** (Lisp — "code is data"; the program is a data structure the language manipulates; McCarthy
  1960). · **Shell scripts as command sequences** (the familiar, weaker CLI-line ≡ script-line precedent; Ace
  strengthens it to a shared DynamicValue AST). · **Data-as-program / configuration-as-data** (Dhall, Nix
  expressions, Starlark — declarative config that's also a value). Honest novelty: none — it names the Ace
  surface **homoiconic**: the CLI command, the `.ace` file, and the DynamicValue/IDL statement are one
  representation (command = file = data), which is *why* seams/files/envs compose uniformly (#6961) and why
  capture/replay/generation are free; `.ace` name tentative + gated.
