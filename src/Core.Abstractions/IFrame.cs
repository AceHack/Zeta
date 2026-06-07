namespace Zeta.Core;

/// <summary>
/// A frame a ray/query is cast <i>from</i>. **Ray-traceability is the capability of being traced from ANY
/// arbitrary frame** (Aaron 2026-06-07: *"from any arbitrary frame actually — that's what ray-traceable gives
/// you"*). Most frames are just observation vantage points; <see cref="ITravelerFrame"/> is the proof-bearing one.
/// </summary>
public interface IFrame { }
