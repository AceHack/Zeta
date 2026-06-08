namespace Zeta.Core

/// **Universal pointers — Lens (composable focus) + the Store comonad (close over the host & read).**
///
/// Aaron #7061: *"I tied in universal pointers so I can close over the host and replicate its functionality
/// within our what-remains."* The categorical shapes for that (sequence step 3):
///
/// - **`Lens<'s,'a>`** — a *composable* universal pointer into a structure: `Get` (read the focus) + `Set`
///   (replace the focus). Lenses **compose** (`∘`), so a deep pointer is built from shallow ones. The
///   "pointer into a structure that composes" (Pickering–Gibbons–Wu profunctor optics; Kmett's `lens`).
/// - **`Store<'s,'a>`** — the **costate / Store comonad**: `Peek: 's -> 'a` (a way to read) + `Pos: 's` (the
///   pointer). This is *exactly* "close over the host and replicate its functionality in the what-remains":
///   `Peek` is the host's functionality captured as a closure (the yin), `Pos` is the current pointer.
///   `extract = Peek Pos`; `extend`/`map` are the comonad operations. ZetaId is the concrete pointer; this is
///   its categorical shape (#7061).
///
/// Both obey their standard laws (tested): lens get/set, set/get, set/set; comonad extract/extend identities.
/// F# reference oracle; C#/Rust/TS ports follow.
module Optic =

    // ── Lens: a composable universal pointer ────────────────────────────────────────────────────────────

    /// A lens focusing an `'a` inside an `'s`. `Get` reads the focus; `Set` replaces it (returning a new `'s`).
    type Lens<'s, 'a> =
        { Get: 's -> 'a
          Set: 'a -> 's -> 's }

    /// Modify the focus by a function (read-modify-write through the lens).
    let over (l: Lens<'s, 'a>) (f: 'a -> 'a) (s: 's) : 's = l.Set(f (l.Get s)) s

    /// Compose two lenses: focus an `'a` in `'s`, then a `'b` in that `'a`, giving a lens `'s → 'b`.
    /// `(outer >>> inner)` — a deep pointer from two shallow ones (universal-pointer composition).
    let compose (outer: Lens<'s, 'a>) (inner: Lens<'a, 'b>) : Lens<'s, 'b> =
        { Get = outer.Get >> inner.Get
          Set = fun b s -> outer.Set (inner.Set b (outer.Get s)) s }

    /// The identity lens (focus the whole structure).
    let id_<'s> : Lens<'s, 's> =
        { Get = id; Set = fun a _ -> a }

    /// A lens into a `Map` at a given key, with a fallback for the absent case (total `Get`).
    let mapKey (key: 'k) (fallback: 'v) : Lens<Map<'k, 'v>, 'v> =
        { Get = fun m -> Map.tryFind key m |> Option.defaultValue fallback
          Set = fun v m -> Map.add key v m }

    // ── Store comonad: close over the host and read ─────────────────────────────────────────────────────

    /// The **Store (costate) comonad**: a pointer `Pos` into a host plus a reader `Peek` that replicates the
    /// host's functionality (the captured closure / what-remains, #7061).
    type Store<'s, 'a> = { Peek: 's -> 'a; Pos: 's }

    /// `extract` — read at the current position (the comonad counit). The host's value *here, now*.
    let extract (w: Store<'s, 'a>) : 'a = w.Peek w.Pos

    /// `map` — post-transform the read value (functor map).
    let mapStore (f: 'a -> 'b) (w: Store<'s, 'a>) : Store<'s, 'b> =
        { Peek = w.Peek >> f; Pos = w.Pos }

    /// `extend` — recompute the whole reader from a function of the *focused store* (the comonad cobind):
    /// `extend f w` peeks by moving the position and applying `f` to the store there. Enables context-
    /// dependent reads (e.g. neighbourhood/relative access — the universal-pointer-with-context).
    let extend (f: Store<'s, 'a> -> 'b) (w: Store<'s, 'a>) : Store<'s, 'b> =
        { Peek = (fun s -> f { Peek = w.Peek; Pos = s }); Pos = w.Pos }

    /// Move the pointer (seek) without changing the reader — re-aim the universal pointer at another position.
    let seek (pos: 's) (w: Store<'s, 'a>) : Store<'s, 'a> = { w with Pos = pos }

    /// Build a Store from a host reader and a starting pointer — "close over the host" (`peek`) "and the
    /// pointer" (`pos`). The yin (`peek`) replicates the host's functionality; the pointer is the address.
    let store (peek: 's -> 'a) (pos: 's) : Store<'s, 'a> = { Peek = peek; Pos = pos }
