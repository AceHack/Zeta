namespace Zeta.Core

/// Shamir k-of-n over GF(257) — F# peer of tools/setup/persona-keys/shamir.ts
/// (081KVP3GYW1 BP-16 leg). Byte-wise independent polynomials; f(0) is the secret byte.
module Shamir =

    [<Literal>]
    let Prime = 257

    type Share = { X: int; Y: int array }

    let private modP (n: int) : int =
        let r = n % Prime
        if r < 0 then r + Prime else r

    let modInv (a: int) : int =
        let mutable t, newT = 0, 1
        let mutable r, newR = Prime, modP a
        while newR <> 0 do
            let q = r / newR
            let t' = t
            t <- newT
            newT <- t' - q * newT
            let r' = r
            r <- newR
            newR <- r' - q * newR
        if r > 1 then invalidOp "shamir: not invertible"
        if t < 0 then t + Prime else t

    let private evalPoly (coeffs: int array) (x: int) : int =
        let mutable acc = 0
        let mutable xp = 1
        for c in coeffs do
            acc <- modP (acc + modP (c * xp))
            xp <- modP (xp * x)
        acc

    let private lagrangeAtZero (points: (int * int) array) : int =
        let mutable secret = 0
        for i = 0 to points.Length - 1 do
            let xi, yi = points.[i]
            let mutable num = 1
            let mutable den = 1
            for j = 0 to points.Length - 1 do
                if i <> j then
                    let xj, _ = points.[j]
                    num <- modP (num * modP (-xj))
                    den <- modP (den * modP (xi - xj))
            secret <- modP (secret + modP (yi * modP (num * modInv den)))
        secret

    /// Deterministic LCG matching tools/setup/persona-keys/shamir.test.ts (uint32 wrap).
    let lcg (seed: uint32) : unit -> float =
        let s = ref seed
        fun () ->
            s := !s * 1664525u + 1013904223u
            float !s / float 0x100000000UL

    let split (secret: byte array) (threshold: int) (shareCount: int) (random: unit -> float) : Share array =
        if threshold < 1 || shareCount < threshold then
            invalidArg "threshold" "shamir: require 1 ≤ k ≤ n"
        let shareYs = Array.init shareCount (fun _ -> ResizeArray<int>())
        for b = 0 to secret.Length - 1 do
            let coeffs =
                Array.init threshold (fun i ->
                    if i = 0 then int secret.[b]
                    else int (floor (random () * float Prime)))
            for i = 0 to shareCount - 1 do
                let x = i + 1
                shareYs.[i].Add(evalPoly coeffs x)
        [| for i = 0 to shareCount - 1 do
               { X = i + 1; Y = shareYs.[i].ToArray() } |]

    let combine (shares: Share array) (threshold: int) : byte array =
        if shares.Length < threshold then
            invalidArg "shares" (sprintf "shamir: need at least %d shares, got %d" threshold shares.Length)
        let used = shares.[0 .. threshold - 1]
        let len = used.[0].Y.Length
        if used |> Array.exists (fun s -> s.Y.Length <> len) then
            invalidArg "shares" "shamir: share length mismatch"
        Array.init len (fun b ->
            let points = used |> Array.map (fun s -> s.X, s.Y.[b])
            byte (lagrangeAtZero points))

    let roundTrip (secret: byte array) (k: int) (n: int) (random: unit -> float) : bool =
        let shares = split secret k n random
        let got = combine shares k
        got.Length = secret.Length && Array.forall2 (=) got secret
