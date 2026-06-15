# An interface is defined by what it can prove; its name is decided by externally-anchored CS

> **Aaron 2026-06-15 (shadow\*):** *"these ideas are fusing and we are using externally
> anchored CS to decide on the right naming — and also interface shape is defined by
> what we can prove about it; an interface that cannot prove any properties is not
> abstracting anything useful."*
>
> Two principles, surfaced while reconciling Aaron's `ForgeHost` (`src/forge-host`)
> and Max's `ChangeControlPort` (`agentic-organization`) — the host/gate ports that
> are converging ("the two are becoming one").

## 1. Interface shape = the properties it lets you prove

An interface is **not** its method signatures — it is the **set of properties
guaranteed to hold across every implementation**. The signatures are the surface;
the *laws/contract* are the abstraction. So:

> **An interface that proves no properties abstracts nothing useful.** Its shape is
> determined by what it lets you prove — pick the methods/laws so the *guarantees you
> need* are the ones the interface forces.

This is why our substrate cares: the **4-language byte-lock** locks a *property*
(the same operation gives the same result across F#/C#/TS/Rust), not a syntax; the
**verified gate** (build = verify) checks *properties* at the boundary; an interface
worth having is one whose contract a `ForgeHost` adapter (GitHub, GitLab, sovereign)
must *provably* satisfy — that is exactly what makes the adapters substitutable.

**Honest precision (the strong claim, scoped):** "cannot prove *any* property →
useless" is *almost* right; the floor is **substitutability itself** — even a
property-light interface (e.g. `ILogger`) guarantees the Liskov contract (any impl is
swappable without breaking callers), which *is* a provable property. So the precise
statement: an interface's value = the guarantees it carries — **at minimum the
substitutability contract; ideally algebraic laws.** An interface with *no* enforced
contract at all (a shape nothing must honor) abstracts nothing.

**Anchors:** abstract data types (Liskov–Zilles 1974); the Liskov Substitution
Principle (substitutability = the floor property); design-by-contract (Meyer,
*Eiffel*); Hoare logic (pre/post/invariant = the provable contract); parametricity /
"theorems for free" (Wadler 1989 — the type *is* a theorem); functor/monad laws
(Mac Lane; Milewski CTFP — an interface = its laws); property-based testing
(Claessen–Hughes QuickCheck → FsCheck — encode the laws, test them). In-repo:
[`interfaces-free-classes-earned-under-rules`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md)
(interfaces = the *rules of the game*; a class is an earned quotient), build = verify,
the type-design discipline (invariants), the 4-language byte-lock.

## 2. Naming is decided by externally-anchored CS

When two developments fuse (Max's + Aaron's), the **right name is chosen from the
external CS vocabulary**, not coined internally — the Beacon discipline applied to
interface naming. "Forge" is the standard term for a git-hosting platform
(GitHub/GitLab/Gitea/SourceHut), so **`ForgeHost`** is externally anchored;
**`ChangeControlPort`** anchors to change-control / review-stage projection. The
shared CS substrate (e.g. **CSLib**, the Lean "Mathlib for CS") is a natural naming
authority — the same anchor that supplies the *properties* (§1) supplies the *names*.

**Corollary — host vocabulary stays in the adapter; it must NOT bleed into the port**
(Aaron 2026-06-15: *"'pull requests' is a stupid host name — we don't need that
bleeding into Zeta; we hexagonal our interfaces for this reason so we own them, not
the host"*). "Pull request" (GitHub), "merge request" (GitLab), "card" (Jira) are
**host jargon**, not CS-anchored terms — they live **only inside the adapter**. The
port uses *our* owned, CS-anchored vocabulary: the canonical artifact is a
**`ChangeSet`**; "PR" is merely the GitHub adapter's *rendering* of one projected
review stage (exactly `ChangeControlPort`'s design: "the `ChangeSet` is canonical;
the PR is a view"). **This is the whole point of hexagonal** (Cockburn): the port is
the boundary that keeps host terms out so *we* own the interface, not the host. A
host noun leaking past the adapter (a `pullRequestId` field on the port) is the smell
— rename to the owned term (`changeSetId` / `projectionRef`).

**Anchors:** [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md)
(every term ties to a human + source); [`mirror-beacon-register-discipline`](../../.claude/rules/mirror-beacon-register-discipline.md)
(prefer the externally-standard term); glossary discipline; CSLib (CS vocabulary
anchor); Cockburn (hexagonal — the port owns the vocabulary); the in-repo
`bcl-interface-boundary` / "we own our interfaces" discipline.

## 3. The two compose

A good interface = **externally-anchored name** (§2) **+ lawful, provable shape**
(§1). `ForgeHost` qualifies: its name is CS-standard ("forge"), and its value is the
**contract every adapter must provably satisfy** (so GitHub, GitLab, and the
sovereign Reticulum/git adapter are genuinely substitutable). The fusion of the two
ports is *itself* an instance: reconcile by (a) the provable contract they share and
(b) the externally-anchored name for it.

This is also the **review criterion** for a society review of an interface: check
(1) does each method earn its place by a *property it guarantees*? and (2) is the
name *externally anchored*? An interface that fails (1) is decoration; one that
fails (2) is private jargon.

## 4. Status

Held as a **principle in `docs/`**, not auto-promoted to a `.claude/rules/` rule —
rule additions are razored (cooling-period, disposition-shaping bar). If it survives
use, it is a candidate carved sentence: *"An interface is defined by what it can
prove; its name by externally-anchored CS."*

## Anchors

Liskov–Zilles (ADTs) · Liskov Substitution Principle · Meyer (design-by-contract) ·
Hoare logic · Wadler (parametricity / theorems-for-free) · Mac Lane / Milewski
(laws-as-interface) · Claessen–Hughes (property-based testing) · CSLib (CS naming +
property anchor) · in-repo: `interfaces-free-classes-earned-under-rules`,
`anchor-to-human-prior-art`, `mirror-beacon-register-discipline`, build = verify, the
4-language byte-lock, `ForgeHost` (`src/forge-host`) + `ChangeControlPort`
(`agentic-organization`).
