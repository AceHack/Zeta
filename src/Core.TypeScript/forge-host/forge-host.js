/**
 * forge-host/forge-host.ts — the ForgeHost interface.
 *
 * The single contract that all forge adapters implement. The core observe loop
 * and tools depend ONLY on this interface — they never name a specific host.
 *
 * All methods return Result<T, ForgeError>. Adapters that haven't implemented
 * a method return ForgeError with kind "not-supported" — never throw.
 */
