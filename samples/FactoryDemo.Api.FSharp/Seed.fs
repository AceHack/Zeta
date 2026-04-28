module Zeta.Samples.FactoryDemo.Api.Seed

open System

// Deterministic in-memory seed data for the API sample. Keep these
// values stable so the same demo scenarios work whether the backing
// store is Postgres (production-shape, planned follow-up) or this
// in-memory fallback (zero-dependency, current).

type Customer =
    { Id: int64
      Name: string
      Email: string
      Phone: string
      Address: string
      CreatedAt: DateTimeOffset
      UpdatedAt: DateTimeOffset }

type Opportunity =
    { Id: int64
      CustomerId: int64
      Stage: string
      AmountCents: int64
      CreatedAt: DateTimeOffset
      UpdatedAt: DateTimeOffset }

type Activity =
    { Id: int64
      CustomerId: int64
      OpportunityId: int64 option
      Kind: string
      Notes: string
      OccurredAt: DateTimeOffset }

// Fixed clock so the seed is deterministic. Any timestamp computed
// from this is reproducible across restarts.
let private now = DateTimeOffset(2026, 4, 23, 0, 0, 0, TimeSpan.Zero)
let private ago (days: int) = now.AddDays(float -days)

let customers : Customer list =
    let mk id name email phone address =
        { Id = id
          Name = name
          Email = email
          Phone = phone
          Address = address
          CreatedAt = ago 120
          UpdatedAt = ago 1 }
    // Email collision #1: Alice Plumbing (1) and Acme Contact (13) share alice@acme.example.
    // Email collision #2: Bob HVAC (5) and Quincy Assistant (19) share bob@trades.example.
    [ mk 1L  "Alice Plumbing LLC"        "alice@acme.example"    "555-0101" "123 Elm St, Portland OR"
      mk 2L  "Benson Roofing"             "benson@roof.example"   "555-0102" "45 Oak Ave, Seattle WA"
      mk 3L  "Crystal Electric"           "crystal@sparks.example" "555-0103" "9 Pine Rd, Boise ID"
      mk 4L  "Delta HVAC & Mechanical"    "delta@hvac.example"    "555-0104" "700 Main St, Spokane WA"
      mk 5L  "Bob HVAC Services"          "bob@trades.example"    "555-0105" "12 Bay Blvd, Tacoma WA"
      mk 6L  "Evergreen Landscaping"      "info@evergreen.example" "555-0106" "88 Forest Ln, Eugene OR"
      mk 7L  "Fairbanks Plumbing"         "contact@fairbanks.example" "555-0107" "5 River Rd, Anchorage AK"
      mk 8L  "Granite Pest Control"       "hello@granite.example" "555-0108" "301 Stone Way, Boise ID"
      mk 9L  "Highland Roofing Co"        "highland@roof.example" "555-0109" "22 Hill Dr, Bend OR"
      mk 10L "Iron Tree Electric"         "iron@tree.example"     "555-0110" "17 Spruce St, Salem OR"
      mk 11L "Jackson Pool Services"      "jackson@pools.example" "555-0111" "600 Lake Rd, Reno NV"
      mk 12L "Klein Garage Doors"         "klein@doors.example"   "555-0112" "44 4th Ave, Medford OR"
      mk 13L "Acme Contact (new lead)"    "alice@acme.example"    "555-0113" "123 Elm St, Portland OR"
      mk 14L "Lakeview Solar"             "lakeview@solar.example" "555-0114" "250 Shore Dr, Bellevue WA"
      mk 15L "Mountain Well Drilling"     "mountain@wells.example" "555-0115" "12 Ridge Rd, Coeur dAlene ID"
      mk 16L "Nightingale Security"       "ngale@secure.example"  "555-0116" "88 Watch Way, Vancouver WA"
      mk 17L "Oak Hill Septic"            "oak@septic.example"    "555-0117" "14 Rural Rt 3, Gresham OR"
      mk 18L "Prairie Window Cleaning"    "prairie@windows.example" "555-0118" "66 Glass Rd, Kennewick WA"
      mk 19L "Quincy Assistant (Bob HVAC)" "bob@trades.example"   "555-0119" "12 Bay Blvd, Tacoma WA"
      mk 20L "Redwood Tree Service"       "redwood@trees.example" "555-0120" "3 Canopy Ct, Hillsboro OR" ]

let opportunities : Opportunity list =
    let mk id custId stage amount =
        { Id = id
          CustomerId = custId
          Stage = stage
          AmountCents = amount
          CreatedAt = ago 30
          UpdatedAt = ago 2 }
    [ mk 1L  1L  "Lead"      250000L
      mk 2L  1L  "Qualified" 800000L
      mk 3L  2L  "Lead"      180000L
      mk 4L  3L  "Proposal"  450000L
      mk 5L  3L  "Won"       120000L
      mk 6L  4L  "Lead"      2200000L
      mk 7L  4L  "Qualified" 600000L
      mk 8L  5L  "Proposal"  350000L
      mk 9L  5L  "Won"       900000L
      mk 10L 6L  "Lead"      150000L
      mk 11L 7L  "Qualified" 500000L
      mk 12L 7L  "Proposal"  700000L
      mk 13L 8L  "Won"       220000L
      mk 14L 9L  "Lead"      300000L
      mk 15L 9L  "Lead"      1800000L
      mk 16L 10L "Qualified" 950000L
      mk 17L 11L "Proposal"  1400000L
      mk 18L 12L "Won"       380000L
      mk 19L 13L "Lead"      50000L
      mk 20L 14L "Proposal"  2500000L
      mk 21L 14L "Qualified" 1100000L
      mk 22L 15L "Won"       600000L
      mk 23L 16L "Lead"      180000L
      mk 24L 17L "Qualified" 270000L
      mk 25L 18L "Lead"      80000L
      mk 26L 19L "Proposal"  320000L
      mk 27L 20L "Won"       450000L
      mk 28L 20L "Lead"      210000L
      mk 29L 2L  "Lost"      90000L
      mk 30L 6L  "Lost"      400000L ]

let activities : Activity list =
    let mk id custId oppId kind notes daysAgo =
        { Id = id
          CustomerId = custId
          OpportunityId = oppId
          Kind = kind
          Notes = notes
          OccurredAt = ago daysAgo }
    [ mk 1L  1L  (Some 1L)  "Call"  "Initial intake call — 3 units, basement finish" 14
      mk 2L  1L  (Some 1L)  "Email" "Sent follow-up with rough estimate"              13
      mk 3L  1L  (Some 2L)  "Call"  "Scope expanded to full house repipe"             6
      mk 4L  2L  (Some 3L)  "Email" "Insurance paperwork sent for roof claim"         10
      mk 5L  3L  (Some 4L)  "Call"  "Walkthrough scheduled for Tuesday"               8
      mk 6L  3L  (Some 5L)  "Note"  "Payment received — closed won"                   3
      mk 7L  4L  (Some 6L)  "Call"  "Commercial HVAC replacement — 6 rooftop units"   20
      mk 8L  4L  (Some 6L)  "Email" "Technical specs and load calcs sent"             18
      mk 9L  4L  (Some 7L)  "Call"  "Second opportunity — server-room cooling"        5
      mk 10L 5L  (Some 8L)  "SMS"   "Confirmed 10am arrival window"                   2
      mk 11L 5L  (Some 9L)  "Note"  "Deposit received; scheduled for next week"       7
      mk 12L 6L  (Some 10L) "Email" "Initial inquiry from website"                    4
      mk 13L 7L  (Some 11L) "Call"  "Alaska project — remote site, flew tools in"     30
      mk 14L 7L  (Some 12L) "Email" "Proposal sent with permitting schedule"          15
      mk 15L 8L  (Some 13L) "Note"  "Quarterly service contract signed"               45
      mk 16L 9L  (Some 14L) "Call"  "Storm damage — needs quick turnaround"           1
      mk 17L 9L  (Some 15L) "Email" "Large hotel roof — sent credentials package"     2
      mk 18L 10L (Some 16L) "Call"  "Panel upgrade consult"                           11
      mk 19L 11L (Some 17L) "SMS"   "Pool opening scheduled for May 1"                5
      mk 20L 12L (Some 18L) "Note"  "Installed — 3yr warranty registered"             60
      mk 21L 13L (Some 19L) "Email" "Intro call tomorrow 2pm"                         1
      mk 22L 14L (Some 20L) "Call"  "Roof assessment + solar compatibility check"     12
      mk 23L 14L (Some 21L) "Email" "Federal tax credit paperwork sent"               9
      mk 24L 15L (Some 22L) "Note"  "Test-well results clean; contract signed"        25
      mk 25L 16L (Some 23L) "Call"  "Camera system walkthrough"                       6
      mk 26L 17L (Some 24L) "SMS"   "Septic pump appointment confirmed"               3
      mk 27L 18L (Some 25L) "Email" "Storefront window quote"                         7
      mk 28L 19L (Some 26L) "Call"  "Coordinating with Bob HVAC on combined job"      4
      mk 29L 20L (Some 27L) "Note"  "Repeat customer — 2nd tree removal this year"    40
      mk 30L 20L (Some 28L) "Email" "Quarterly pruning proposal"                      2
      mk 31L 2L  (Some 29L) "Note"  "Customer went with competitor on price"          22
      mk 32L 6L  (Some 30L) "Note"  "Lost deal — decided to self-install"             18
      mk 33L 1L  None       "Email" "General follow-up — hope repipe went well"       90 ]
