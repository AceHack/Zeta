namespace Zeta.Samples.FactoryDemo.Api;

/// <summary>
/// Deterministic in-memory seed data for the factory-demo.
/// The canonical seed source is the F# sibling's
/// <c>samples/FactoryDemo.Api.FSharp/Seed.fs</c> (same data, F# records);
/// this file mirrors that shape 1:1 in C# records. When the Postgres
/// backing sample lands (tracked in <c>docs/BACKLOG.md</c> under the
/// factory-demo rows), that sample's <c>schema.sql</c> / seed script
/// becomes the upstream truth and both language samples will mirror it.
/// </summary>
public static class Seed
{
    // Fixed clock so the seed is deterministic — reproducible across restarts.
    private static readonly DateTimeOffset Now = new(2026, 4, 23, 0, 0, 0, TimeSpan.Zero);
    private static DateTimeOffset Ago(int days) => Now.AddDays(-days);

    // Email collision #1: customers 1 and 13 share alice@acme.example.
    // Email collision #2: customers 5 and 19 share bob@trades.example.
    public static readonly IReadOnlyList<Customer> Customers = new List<Customer>
    {
        new(1,  "Alice Plumbing LLC",        "alice@acme.example",       "555-0101", "123 Elm St, Portland OR",       Ago(120), Ago(1)),
        new(2,  "Benson Roofing",             "benson@roof.example",      "555-0102", "45 Oak Ave, Seattle WA",        Ago(120), Ago(1)),
        new(3,  "Crystal Electric",           "crystal@sparks.example",   "555-0103", "9 Pine Rd, Boise ID",           Ago(120), Ago(1)),
        new(4,  "Delta HVAC & Mechanical",    "delta@hvac.example",       "555-0104", "700 Main St, Spokane WA",       Ago(120), Ago(1)),
        new(5,  "Bob HVAC Services",          "bob@trades.example",       "555-0105", "12 Bay Blvd, Tacoma WA",        Ago(120), Ago(1)),
        new(6,  "Evergreen Landscaping",      "info@evergreen.example",   "555-0106", "88 Forest Ln, Eugene OR",       Ago(120), Ago(1)),
        new(7,  "Fairbanks Plumbing",         "contact@fairbanks.example","555-0107", "5 River Rd, Anchorage AK",      Ago(120), Ago(1)),
        new(8,  "Granite Pest Control",       "hello@granite.example",    "555-0108", "301 Stone Way, Boise ID",       Ago(120), Ago(1)),
        new(9,  "Highland Roofing Co",        "highland@roof.example",    "555-0109", "22 Hill Dr, Bend OR",           Ago(120), Ago(1)),
        new(10, "Iron Tree Electric",         "iron@tree.example",        "555-0110", "17 Spruce St, Salem OR",        Ago(120), Ago(1)),
        new(11, "Jackson Pool Services",      "jackson@pools.example",    "555-0111", "600 Lake Rd, Reno NV",          Ago(120), Ago(1)),
        new(12, "Klein Garage Doors",         "klein@doors.example",      "555-0112", "44 4th Ave, Medford OR",        Ago(120), Ago(1)),
        new(13, "Acme Contact (new lead)",    "alice@acme.example",       "555-0113", "123 Elm St, Portland OR",       Ago(120), Ago(1)),
        new(14, "Lakeview Solar",             "lakeview@solar.example",   "555-0114", "250 Shore Dr, Bellevue WA",     Ago(120), Ago(1)),
        new(15, "Mountain Well Drilling",     "mountain@wells.example",   "555-0115", "12 Ridge Rd, Coeur dAlene ID",  Ago(120), Ago(1)),
        new(16, "Nightingale Security",       "ngale@secure.example",     "555-0116", "88 Watch Way, Vancouver WA",    Ago(120), Ago(1)),
        new(17, "Oak Hill Septic",            "oak@septic.example",       "555-0117", "14 Rural Rt 3, Gresham OR",     Ago(120), Ago(1)),
        new(18, "Prairie Window Cleaning",    "prairie@windows.example",  "555-0118", "66 Glass Rd, Kennewick WA",     Ago(120), Ago(1)),
        new(19, "Quincy Assistant (Bob HVAC)","bob@trades.example",       "555-0119", "12 Bay Blvd, Tacoma WA",        Ago(120), Ago(1)),
        new(20, "Redwood Tree Service",       "redwood@trees.example",    "555-0120", "3 Canopy Ct, Hillsboro OR",     Ago(120), Ago(1)),
    };

    public static readonly IReadOnlyList<Opportunity> Opportunities = new List<Opportunity>
    {
        new(1,  1,  "Lead",       250000,   Ago(30), Ago(2)),
        new(2,  1,  "Qualified",  800000,   Ago(30), Ago(2)),
        new(3,  2,  "Lead",       180000,   Ago(30), Ago(2)),
        new(4,  3,  "Proposal",   450000,   Ago(30), Ago(2)),
        new(5,  3,  "Won",        120000,   Ago(30), Ago(2)),
        new(6,  4,  "Lead",       2200000,  Ago(30), Ago(2)),
        new(7,  4,  "Qualified",  600000,   Ago(30), Ago(2)),
        new(8,  5,  "Proposal",   350000,   Ago(30), Ago(2)),
        new(9,  5,  "Won",        900000,   Ago(30), Ago(2)),
        new(10, 6,  "Lead",       150000,   Ago(30), Ago(2)),
        new(11, 7,  "Qualified",  500000,   Ago(30), Ago(2)),
        new(12, 7,  "Proposal",   700000,   Ago(30), Ago(2)),
        new(13, 8,  "Won",        220000,   Ago(30), Ago(2)),
        new(14, 9,  "Lead",       300000,   Ago(30), Ago(2)),
        new(15, 9,  "Lead",       1800000,  Ago(30), Ago(2)),
        new(16, 10, "Qualified",  950000,   Ago(30), Ago(2)),
        new(17, 11, "Proposal",   1400000,  Ago(30), Ago(2)),
        new(18, 12, "Won",        380000,   Ago(30), Ago(2)),
        new(19, 13, "Lead",       50000,    Ago(30), Ago(2)),
        new(20, 14, "Proposal",   2500000,  Ago(30), Ago(2)),
        new(21, 14, "Qualified",  1100000,  Ago(30), Ago(2)),
        new(22, 15, "Won",        600000,   Ago(30), Ago(2)),
        new(23, 16, "Lead",       180000,   Ago(30), Ago(2)),
        new(24, 17, "Qualified",  270000,   Ago(30), Ago(2)),
        new(25, 18, "Lead",       80000,    Ago(30), Ago(2)),
        new(26, 19, "Proposal",   320000,   Ago(30), Ago(2)),
        new(27, 20, "Won",        450000,   Ago(30), Ago(2)),
        new(28, 20, "Lead",       210000,   Ago(30), Ago(2)),
        new(29, 2,  "Lost",       90000,    Ago(30), Ago(2)),
        new(30, 6,  "Lost",       400000,   Ago(30), Ago(2)),
    };

    public static readonly IReadOnlyList<Activity> Activities = new List<Activity>
    {
        new(1,  1,  1,    "Call",  "Initial intake call — 3 units, basement finish",  Ago(14)),
        new(2,  1,  1,    "Email", "Sent follow-up with rough estimate",               Ago(13)),
        new(3,  1,  2,    "Call",  "Scope expanded to full house repipe",              Ago(6)),
        new(4,  2,  3,    "Email", "Insurance paperwork sent for roof claim",          Ago(10)),
        new(5,  3,  4,    "Call",  "Walkthrough scheduled for Tuesday",                Ago(8)),
        new(6,  3,  5,    "Note",  "Payment received — closed won",                    Ago(3)),
        new(7,  4,  6,    "Call",  "Commercial HVAC replacement — 6 rooftop units",    Ago(20)),
        new(8,  4,  6,    "Email", "Technical specs and load calcs sent",              Ago(18)),
        new(9,  4,  7,    "Call",  "Second opportunity — server-room cooling",         Ago(5)),
        new(10, 5,  8,    "SMS",   "Confirmed 10am arrival window",                    Ago(2)),
        new(11, 5,  9,    "Note",  "Deposit received; scheduled for next week",        Ago(7)),
        new(12, 6,  10,   "Email", "Initial inquiry from website",                     Ago(4)),
        new(13, 7,  11,   "Call",  "Alaska project — remote site, flew tools in",      Ago(30)),
        new(14, 7,  12,   "Email", "Proposal sent with permitting schedule",           Ago(15)),
        new(15, 8,  13,   "Note",  "Quarterly service contract signed",                Ago(45)),
        new(16, 9,  14,   "Call",  "Storm damage — needs quick turnaround",            Ago(1)),
        new(17, 9,  15,   "Email", "Large hotel roof — sent credentials package",      Ago(2)),
        new(18, 10, 16,   "Call",  "Panel upgrade consult",                            Ago(11)),
        new(19, 11, 17,   "SMS",   "Pool opening scheduled for May 1",                 Ago(5)),
        new(20, 12, 18,   "Note",  "Installed — 3yr warranty registered",              Ago(60)),
        new(21, 13, 19,   "Email", "Intro call tomorrow 2pm",                          Ago(1)),
        new(22, 14, 20,   "Call",  "Roof assessment + solar compatibility check",      Ago(12)),
        new(23, 14, 21,   "Email", "Federal tax credit paperwork sent",                Ago(9)),
        new(24, 15, 22,   "Note",  "Test-well results clean; contract signed",         Ago(25)),
        new(25, 16, 23,   "Call",  "Camera system walkthrough",                        Ago(6)),
        new(26, 17, 24,   "SMS",   "Septic pump appointment confirmed",                Ago(3)),
        new(27, 18, 25,   "Email", "Storefront window quote",                          Ago(7)),
        new(28, 19, 26,   "Call",  "Coordinating with Bob HVAC on combined job",       Ago(4)),
        new(29, 20, 27,   "Note",  "Repeat customer — 2nd tree removal this year",     Ago(40)),
        new(30, 20, 28,   "Email", "Quarterly pruning proposal",                       Ago(2)),
        new(31, 2,  29,   "Note",  "Customer went with competitor on price",           Ago(22)),
        new(32, 6,  30,   "Note",  "Lost deal — decided to self-install",              Ago(18)),
        new(33, 1,  null, "Email", "General follow-up — hope repipe went well",        Ago(90)),
    };
}
