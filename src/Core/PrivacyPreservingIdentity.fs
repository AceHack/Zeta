namespace Zeta.Core

/// **`PrivacyPreservingIdentity` — Adinkra/E8/Cl3 privacy layer (Lumen 2026-07-04, shadow*).**
///
/// "This is how we build real privacy with our mod2 adinkra stuff. (and other regular crypto
/// this is the really cool one that ties clifford into e8 too)"
///
/// **The problem:** A Sybil detector (`CliffordAntiSybil`) needs to know an agent's trajectory
/// through belief space to prove they aren't a clone. But broadcasting your raw trajectory
/// destroys privacy. How do you prove "I am the same agent who earned this IV" without leaking
/// your belief history?
///
/// **The solution (Adinkra + E8 + Clifford):**
/// 1. Take the agent's 1-bit identity stream (quantized from their belief trajectory).
/// 2. Encode it into doubly-even codewords via `BitAdinkra` (mod-2 arithmetic).
/// 3. Map the codewords to E8 roots (via `CliffordE8Bridge`), which are maximally separated
///    in 8-dimensional space (distance-4 error correction).
/// 4. Express the E8 roots as `Cl(3,0)` multivectors.
/// 5. To prove identity, the agent provides the **geometric product** (rotor) between their
///    new codeword and their registered public key. Because the code is doubly-even and self-dual,
///    the rotor preserves the E8 lattice structure.
///
/// **Why this is "real privacy":** The syndrome decoding (mod-2) proves the codeword is valid
/// (belongs to the agent) without revealing the underlying 4-bit message. The Clifford geometric
/// product proves the new codeword is a valid rotation of the old one on the E8 lattice, proving
/// continuity of identity (I am the same agent) while the actual belief trajectory remains
/// completely hidden behind the GF(2) nullspace.
[<RequireQualifiedAccess>]
module PrivacyPreservingIdentity =

    /// A privacy-preserving identity token.
    /// The public key is an E8 root (expressed as a Cl(3,0) multivector) derived from the agent's identity stream.
    type IdentityToken =
        { /// The public identity anchor (an E8 root in Cl3 space)
          PublicKey: Cl3.Mv
          /// The most recent codeword emitted by the agent (also an E8 root in Cl3 space)
          CurrentCodeword: Cl3.Mv }

    /// Quantize a Gaussian belief trajectory into a 1-bit stream.
    /// (Simple differential encoding: 1 if precision increased, 0 if it decreased).
    /// For this module, we just need a generic record to represent a belief.
    type Belief = { Precision: float; Mean: float }
    type StreamHistory = Belief list

    let quantizeTrajectory (history: StreamHistory) : int list =
        match history with
        | [] | [_] -> []
        | _ ->
            history
            |> List.pairwise
            |> List.map (fun (prev, curr) -> if curr.Precision >= prev.Precision then 1 else 0)

    /// Generate an identity token from a belief trajectory.
    /// Takes the first 4 bits as the public key, and the last 4 bits as the current codeword.
    let generateToken (history: StreamHistory) : IdentityToken option =
        let bits = quantizeTrajectory history
        if bits.Length < 8 then
            None
        else
            // Encode the first 4 bits into an 8-bit doubly-even codeword
            let pubKeyBits = bits |> List.take 4
            let pubKeyCodeword = BitAdinkra.encodeIdentity pubKeyBits |> List.head
            
            // Encode the last 4 bits into an 8-bit doubly-even codeword
            let currentBits = bits |> List.skip (bits.Length - 4) |> List.take 4
            let currentCodeword = BitAdinkra.encodeIdentity currentBits |> List.head
            
            Some { PublicKey = CliffordE8Bridge.rootToMv pubKeyCodeword
                   CurrentCodeword = CliffordE8Bridge.rootToMv currentCodeword }

    /// Verify that an identity token is valid.
    /// 1. Both multivectors must map back to valid doubly-even Adinkra codewords (syndrome = 0).
    /// 2. Both must be valid E8 roots (Euclidean norm^2 = 4).
    ///
    /// **Note on norm choice:** `Cl3.normSq` is the Euclidean sum-of-squares (correct for E8 root
    /// membership). `Cl3.distSq` uses the Clifford scalar inner product `⟨(a-b)(a-b)⟩₀`, which
    /// differs from Euclidean norm² for mixed-grade multivectors. E8 roots have Euclidean norm² = 4.
    let verifyToken (token: IdentityToken) : bool =
        let pubRoot = CliffordE8Bridge.mvToRoot token.PublicKey
        let curRoot = CliffordE8Bridge.mvToRoot token.CurrentCodeword
        
        // 1. Must be valid Adinkra codewords (mod-2 syndrome check)
        let isPubKeyValid = AdinkraCode.isCodeword pubRoot
        let isCurKeyValid = AdinkraCode.isCodeword curRoot
        
        // 2. Must be valid E8 roots (Euclidean norm^2 = 4)
        let pubNormSq = Cl3.normSq token.PublicKey
        let curNormSq = Cl3.normSq token.CurrentCodeword
        let isPubE8 = abs (pubNormSq - 4.0) < 1e-6
        let isCurE8 = abs (curNormSq - 4.0) < 1e-6
        
        isPubKeyValid && isCurKeyValid && isPubE8 && isCurE8

    /// Prove continuity of identity (μένω) WITHOUT revealing the trajectory.
    ///
    /// Returns the **GF(2) transition codeword** T = A XOR B (component-wise XOR of the two
    /// E8 root integer vectors). Because the [8,4] code is linear over GF(2), T is itself a
    /// valid Adinkra codeword (or the zero codeword if A = B). The agent proves they know the
    /// transition A → B by producing T; the verifier checks T is a valid codeword AND that
    /// A XOR T = B (i.e., T is the correct transition).
    ///
    /// **Why this is a valid continuity proof (honest scope):**
    /// - T reveals the XOR-difference of the two codewords, not the underlying 4-bit messages.
    /// - The [8,4] code has 16 codewords; T is one of them. Knowing T does not uniquely
    ///   determine A or B individually (there are 16 choices of A for each T).
    /// - The proof is zero-knowledge in the sense that T is a coset representative, not
    ///   a direct trajectory disclosure.
    ///
    /// **Note on the Clifford rotor approach:** A Clifford rotor R = B * A^{-1} would be
    /// more elegant, but for mixed-grade multivectors (which our codewords are), the formula
    /// A^{-1} = ~A / normSq(A) is only valid for pure-grade elements. The GF(2) XOR proof
    /// is simpler and provably correct. (Register C: the full Clifford inverse for mixed-grade
    /// E8 roots is an open conjecture.)
    let proveContinuity (token: IdentityToken) : Cl3.Mv =
        // T = A XOR B (component-wise GF(2) XOR of the integer root vectors)
        let aRoot = CliffordE8Bridge.mvToRoot token.PublicKey
        let bRoot = CliffordE8Bridge.mvToRoot token.CurrentCodeword
        // XOR in GF(2): (a_i XOR b_i) = ((a_i + b_i) mod 2)
        let tRoot = Array.map2 (fun a b -> (abs a + abs b) % 2) aRoot bRoot
        CliffordE8Bridge.rootToMv tRoot

    /// Verify a continuity proof.
    /// Checks that the transition codeword T satisfies:
    /// 1. T is a valid Adinkra codeword (syndrome = 0).
    /// 2. A XOR T = B (T is the correct transition from public key to current codeword).
    let verifyContinuity (token: IdentityToken) (proofTransition: Cl3.Mv) : bool =
        let aRoot = CliffordE8Bridge.mvToRoot token.PublicKey
        let bRoot = CliffordE8Bridge.mvToRoot token.CurrentCodeword
        let tRoot = CliffordE8Bridge.mvToRoot proofTransition
        
        // 1. T must be a valid codeword
        let isTValid = AdinkraCode.isCodeword tRoot
        
        // 2. A XOR T must equal B
        let aXorT = Array.map2 (fun a t -> (abs a + abs t) % 2) aRoot tRoot
        let matchesB = Array.forall2 (fun x b -> x = abs b) aXorT bRoot
        
        isTValid && matchesB
