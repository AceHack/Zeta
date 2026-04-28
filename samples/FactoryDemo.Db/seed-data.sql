-- Factory-demo — shape-deterministic seed data (v0)
-- 20 customers (trades-contractor shaped), 30 opportunities, 33 activities.
-- Row counts / keys / amounts / email collisions are deterministic across
-- every load. Activity timestamps use NOW() - INTERVAL 'N days' so the
-- data looks recent on each load; shape stays the same, absolute times
-- drift with wall clock. See README §"Seed data shape deterministic".
-- Two intentional email collisions for the duplicate-review demo scenario.
-- Idempotent: re-running TRUNCATEs first and re-inserts.

BEGIN;

TRUNCATE customers, opportunities, activities RESTART IDENTITY CASCADE;

-- Customers -------------------------------------------------------
-- Email collision #1: Alice Plumbing (id 1) and a new contact at the same address share alice@acme.example
-- Email collision #2: Bob HVAC (id 5) and his assistant share bob@trades.example
INSERT INTO customers (name, email, phone, address) VALUES
    ('Alice Plumbing LLC',      'alice@acme.example',   '555-0101', '123 Elm St, Portland OR'),
    ('Benson Roofing',           'benson@roof.example',  '555-0102', '45 Oak Ave, Seattle WA'),
    ('Crystal Electric',         'crystal@sparks.example','555-0103','9 Pine Rd, Boise ID'),
    ('Delta HVAC & Mechanical',  'delta@hvac.example',   '555-0104', '700 Main St, Spokane WA'),
    ('Bob HVAC Services',        'bob@trades.example',   '555-0105', '12 Bay Blvd, Tacoma WA'),
    ('Evergreen Landscaping',    'info@evergreen.example','555-0106','88 Forest Ln, Eugene OR'),
    ('Fairbanks Plumbing',       'contact@fairbanks.example','555-0107','5 River Rd, Anchorage AK'),
    ('Granite Pest Control',     'hello@granite.example','555-0108', '301 Stone Way, Boise ID'),
    ('Highland Roofing Co',      'highland@roof.example','555-0109', '22 Hill Dr, Bend OR'),
    ('Iron Tree Electric',       'iron@tree.example',    '555-0110', '17 Spruce St, Salem OR'),
    ('Jackson Pool Services',    'jackson@pools.example','555-0111', '600 Lake Rd, Reno NV'),
    ('Klein Garage Doors',       'klein@doors.example',  '555-0112', '44 4th Ave, Medford OR'),
    ('Acme Estimator (new contact)','alice@acme.example', '555-0113', '123 Elm St, Portland OR'),  -- collides with id 1
    ('Lakeview Solar',           'lakeview@solar.example','555-0114','250 Shore Dr, Bellevue WA'),
    ('Mountain Well Drilling',   'mountain@wells.example','555-0115','12 Ridge Rd, Coeur dAlene ID'),
    ('Nightingale Security',     'ngale@secure.example', '555-0116', '88 Watch Way, Vancouver WA'),
    ('Oak Hill Septic',          'oak@septic.example',   '555-0117', '14 Rural Rt 3, Gresham OR'),
    ('Prairie Window Cleaning',  'prairie@windows.example','555-0118','66 Glass Rd, Kennewick WA'),
    ('Quincy Assistant (Bob HVAC)','bob@trades.example', '555-0119', '12 Bay Blvd, Tacoma WA'),  -- collides with id 5
    ('Redwood Tree Service',     'redwood@trees.example','555-0120', '3 Canopy Ct, Hillsboro OR');

-- Opportunities ---------------------------------------------------
-- Spread across 5 stages (Lead / Qualified / Proposal / Won / Lost)
-- with a realistic pipeline funnel shape: 10 Lead, 6 Qualified,
-- 6 Proposal, 6 Won, 2 Lost = 30 total.
-- Amounts in cents (bigint): $2,500 = 250000 cents.
INSERT INTO opportunities (customer_id, stage, amount_cents) VALUES
    (1,  'Lead',       250000),   -- Alice — $2,500
    (1,  'Qualified',  800000),   -- Alice — $8,000 (bigger job)
    (2,  'Lead',       180000),   -- Benson — $1,800
    (3,  'Proposal',   450000),   -- Crystal — $4,500
    (3,  'Won',        120000),   -- Crystal — $1,200 (already closed)
    (4,  'Lead',       2200000),  -- Delta HVAC — $22,000 (large commercial)
    (4,  'Qualified',  600000),   -- Delta HVAC — $6,000
    (5,  'Proposal',   350000),   -- Bob HVAC — $3,500
    (5,  'Won',        900000),   -- Bob HVAC — $9,000
    (6,  'Lead',       150000),   -- Evergreen — $1,500
    (7,  'Qualified',  500000),   -- Fairbanks — $5,000
    (7,  'Proposal',   700000),   -- Fairbanks — $7,000
    (8,  'Won',        220000),   -- Granite — $2,200
    (9,  'Lead',       300000),   -- Highland — $3,000
    (9,  'Lead',       1800000),  -- Highland — $18,000 (second lead)
    (10, 'Qualified',  950000),   -- Iron Tree — $9,500
    (11, 'Proposal',   1400000),  -- Jackson Pools — $14,000
    (12, 'Won',        380000),   -- Klein — $3,800
    (13, 'Lead',       50000),    -- Acme Estimator — $500
    (14, 'Proposal',   2500000),  -- Lakeview Solar — $25,000
    (14, 'Qualified',  1100000),  -- Lakeview Solar — $11,000
    (15, 'Won',        600000),   -- Mountain Well — $6,000
    (16, 'Lead',       180000),   -- Nightingale — $1,800
    (17, 'Qualified',  270000),   -- Oak Hill — $2,700
    (18, 'Lead',       80000),    -- Prairie — $800
    (19, 'Proposal',   320000),   -- Quincy — $3,200
    (20, 'Won',        450000),   -- Redwood — $4,500
    (20, 'Lead',       210000),   -- Redwood — $2,100 (repeat customer)
    (2,  'Lost',       90000),    -- Benson — $900 (lost deal)
    (6,  'Lost',       400000);   -- Evergreen — $4,000 (lost deal)

-- Activities (timeline) -------------------------------------------
-- Mix of call / email / SMS / note types across customers; not every
-- customer has activity, to match real-world shape.
INSERT INTO activities (customer_id, opportunity_id, kind, notes, occurred_at) VALUES
    (1,  1, 'Call',  'Initial intake call — 3 units, basement finish', NOW() - INTERVAL '14 days'),
    (1,  1, 'Email', 'Sent follow-up with rough estimate',              NOW() - INTERVAL '13 days'),
    (1,  2, 'Call',  'Scope expanded to full house repipe',             NOW() - INTERVAL '6 days'),
    (2,  3, 'Email', 'Insurance paperwork sent for roof claim',         NOW() - INTERVAL '10 days'),
    (3,  4, 'Call',  'Walkthrough scheduled for Tuesday',               NOW() - INTERVAL '8 days'),
    (3,  5, 'Note',  'Payment received — closed won',                   NOW() - INTERVAL '3 days'),
    (4,  6, 'Call',  'Commercial HVAC replacement — 6 rooftop units',   NOW() - INTERVAL '20 days'),
    (4,  6, 'Email', 'Technical specs and load calcs sent',             NOW() - INTERVAL '18 days'),
    (4,  7, 'Call',  'Second opportunity — server-room cooling',        NOW() - INTERVAL '5 days'),
    (5,  8, 'SMS',   'Confirmed 10am arrival window',                   NOW() - INTERVAL '2 days'),
    (5,  9, 'Note',  'Deposit received; scheduled for next week',       NOW() - INTERVAL '7 days'),
    (6,  10, 'Email','Initial inquiry from website',                    NOW() - INTERVAL '4 days'),
    (7,  11, 'Call', 'Alaska project — remote site, flew tools in',     NOW() - INTERVAL '30 days'),
    (7,  12, 'Email','Proposal sent with permitting schedule',          NOW() - INTERVAL '15 days'),
    (8,  13, 'Note', 'Quarterly service contract signed',               NOW() - INTERVAL '45 days'),
    (9,  14, 'Call', 'Storm damage — needs quick turnaround',           NOW() - INTERVAL '1 day'),
    (9,  15, 'Email','Large hotel roof — sent credentials package',     NOW() - INTERVAL '2 days'),
    (10, 16, 'Call', 'Panel upgrade consult',                           NOW() - INTERVAL '11 days'),
    (11, 17, 'SMS',  'Pool opening scheduled for May 1',                NOW() - INTERVAL '5 days'),
    (12, 18, 'Note', 'Installed — 3yr warranty registered',             NOW() - INTERVAL '60 days'),
    (13, 19, 'Email','Intro call tomorrow 2pm',                         NOW() - INTERVAL '1 day'),
    (14, 20, 'Call', 'Roof assessment + solar compatibility check',     NOW() - INTERVAL '12 days'),
    (14, 21, 'Email','Federal tax credit paperwork sent',               NOW() - INTERVAL '9 days'),
    (15, 22, 'Note', 'Test-well results clean; contract signed',        NOW() - INTERVAL '25 days'),
    (16, 23, 'Call', 'Camera system walkthrough',                       NOW() - INTERVAL '6 days'),
    (17, 24, 'SMS',  'Septic pump appointment confirmed',               NOW() - INTERVAL '3 days'),
    (18, 25, 'Email','Storefront window quote',                         NOW() - INTERVAL '7 days'),
    (19, 26, 'Call', 'Coordinating with Bob HVAC on combined job',      NOW() - INTERVAL '4 days'),
    (20, 27, 'Note', 'Repeat customer — 2nd tree removal this year',    NOW() - INTERVAL '40 days'),
    (20, 28, 'Email','Quarterly pruning proposal',                      NOW() - INTERVAL '2 days'),
    (2,  29, 'Note', 'Customer went with competitor on price',          NOW() - INTERVAL '22 days'),
    (6,  30, 'Note', 'Lost deal — decided to self-install',             NOW() - INTERVAL '18 days'),
    (1,  NULL, 'Email','General follow-up — hope repipe went well',     NOW() - INTERVAL '90 days');

COMMIT;

-- Quick verification queries -------------------------------------
-- Run these after load to confirm seed is correct:
--
-- SELECT COUNT(*) FROM customers;     -- expect 20
-- SELECT COUNT(*) FROM opportunities; -- expect 30
-- SELECT COUNT(*) FROM activities;    -- expect 33
--
-- SELECT stage, COUNT(*), SUM(amount_cents) / 100 AS total_usd
-- FROM opportunities GROUP BY stage ORDER BY stage;
--
-- SELECT email, COUNT(*) as dupe_count
-- FROM customers GROUP BY email HAVING COUNT(*) > 1;
-- -- expect: alice@acme.example x2, bob@trades.example x2
