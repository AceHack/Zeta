namespace Zeta.Core.CSharp.ZetaId;

// Location enum — small numeric codes packed into the 8-bit Location field
// of the 128-bit ZetaId. Byte values 1-11 cover the major regions across
// AWS, GCP, Azure, and DigitalOcean. MultiRegion is the special value for
// global/anycast/multi-cloud deployments.
//
// Backlog (human maintainer 2026-05-21): registry/locations.yaml + provider-specific
// mapping layer (AWS/GCP/Azure/DO region names, account/subscription IDs,
// etc.) ships in a separate follow-up PR. The core enum stays small +
// stable; the rich layer lives in CloudEvents-wrapped envelopes per
// CNCF CloudEvents spec (https://cloudevents.io/) — also backlogged.
public enum Location : byte
{
    EastUsVa         = 1,   // AWS us-east-1, Azure East US, GCP us-east4
    WestUsOr         = 2,   // AWS us-west-2, Azure West US 2, GCP us-west1
    CentralUs        = 3,   // AWS us-east-2, GCP us-central1
    CanadaToronto    = 4,   // AWS ca-central-1, Azure Canada Central
    WestEurope       = 5,   // AWS eu-west-1, Azure West Europe, GCP europe-west4
    NorthEurope      = 6,   // AWS eu-north-1, Azure North Europe
    SoutheastAsiaSg  = 7,   // AWS ap-southeast-1, Azure Southeast Asia
    NortheastAsiaTk  = 8,   // AWS ap-northeast-1, Azure Japan East
    AustraliaSyd     = 9,   // AWS ap-southeast-2, Azure Australia East
    SouthAmericaSp   = 10,  // AWS sa-east-1, Azure Brazil South
    MultiRegion      = 11,  // global/anycast/multi-cloud
}
