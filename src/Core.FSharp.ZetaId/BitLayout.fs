namespace Zeta.Core.FSharp.ZetaId

/// Layout direction. Both produce identical field offsets; TopDown is the
/// canonical authoring order (matches the human-readable layout spec); BottomUp
/// is provided as a cross-check (V8 cycle empirical-test discipline: two
/// independent computations of the same layout that must agree).
type LayoutDirection =
    | TopDown
    | BottomUp

/// Bit field descriptor — (offset, width). Offset is LSB-0 position; width is
/// the number of bits the field occupies. Reading: `(value >> offset) & ((1 << width) - 1)`.
type BitField = { Offset: int; Width: int }

/// Full ZetaId bit layout. 128 bits total; reserved bits at offset 69 (1 bit)
/// and offsets 32-34 (3 bits). Total: 5+48+5+1+4+1+5+8+8+8+3+32 = 128.
type BitLayout = {
    Version: BitField
    Timestamp: BitField
    Chromosome: BitField
    Category: BitField
    Firefly: BitField
    Authority: BitField
    Persona: BitField
    Momentum: BitField
    Location: BitField
    Randomness: BitField
    TotalBits: int
}

module BitLayout =
    /// Top-down construction. Allocates fields from MSB downward; explicit
    /// reserved-bit gaps preserved per spec.
    let private createTopDown () : BitLayout =
        // Mutable accumulator — emulates the C# pattern; reset to 128 at top.
        let mutable offset = 128

        let next width =
            offset <- offset - width
            { Offset = offset; Width = width }

        let skip bits = offset <- offset - bits

        // Spec: docs/zeta-id-v1-layout.yaml reserved_bits — 1 bit at offset 69
        // (between Chromosome and Category), 3 bits at offsets 32-34 (between
        // Location and Randomness).
        let version    = next 5       // bits 123-127
        let timestamp  = next 48      // bits 75-122
        let chromosome = next 5       // bits 70-74
        skip 1                        // reserved bit 69
        let category   = next 4       // bits 65-68
        let firefly    = next 1       // bit 64
        let authority  = next 5       // bits 59-63
        let persona    = next 8       // bits 51-58
        let momentum   = next 8       // bits 43-50
        let location   = next 8       // bits 35-42
        // Bits 32-34 reserved; Randomness occupies offset 0..31
        {
            Version = version
            Timestamp = timestamp
            Chromosome = chromosome
            Category = category
            Firefly = firefly
            Authority = authority
            Persona = persona
            Momentum = momentum
            Location = location
            Randomness = { Offset = 0; Width = 32 }
            TotalBits = 128
        }

    /// Bottom-up construction. Same final layout; computed by allocating fields
    /// from LSB upward. Both directions must produce byte-identical output
    /// (V8 cycle catch: independent computation paths surface drift the visual
    /// review missed twice).
    let private createBottomUp () : BitLayout =
        let mutable offset = 0

        let next width =
            let start = offset
            offset <- offset + width
            { Offset = start; Width = width }

        let skip bits = offset <- offset + bits

        let randomness = next 32      // bits 0-31
        skip 3                        // reserved bits 32-34
        let location   = next 8       // bits 35-42
        let momentum   = next 8       // bits 43-50
        let persona    = next 8       // bits 51-58
        let authority  = next 5       // bits 59-63
        let firefly    = next 1       // bit 64
        let category   = next 4       // bits 65-68
        skip 1                        // reserved bit 69
        let chromosome = next 5       // bits 70-74
        let timestamp  = next 48      // bits 75-122
        let version    = next 5       // bits 123-127
        {
            Version = version
            Timestamp = timestamp
            Chromosome = chromosome
            Category = category
            Firefly = firefly
            Authority = authority
            Persona = persona
            Momentum = momentum
            Location = location
            Randomness = randomness
            TotalBits = 128
        }

    /// Build a layout for the given direction.
    let create (direction: LayoutDirection) : BitLayout =
        match direction with
        | TopDown -> createTopDown ()
        | BottomUp -> createBottomUp ()

    /// Default canonical layout = TopDown.
    let Default : BitLayout = create TopDown
