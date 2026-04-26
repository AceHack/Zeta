-- Factory-demo — Postgres schema (v0)
-- Standard Postgres 14+. Boring by design — the factory story is
-- the demo, not the database. See README.md for the framing.

BEGIN;

-- Customers --------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email is deliberately NOT unique — duplicate-review is a demo scenario.
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);

-- Opportunities ----------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunities (
    id            BIGSERIAL PRIMARY KEY,
    customer_id   BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    stage         TEXT NOT NULL,
    amount_cents  BIGINT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT opp_stage_valid CHECK (
        stage IN ('Lead', 'Qualified', 'Proposal', 'Won', 'Lost')
    ),
    CONSTRAINT opp_amount_nonneg CHECK (amount_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_customer ON opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage    ON opportunities(stage);

-- Activities (timeline of calls / emails / SMS / notes) ------------

CREATE TABLE IF NOT EXISTS activities (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    opportunity_id  BIGINT REFERENCES opportunities(id) ON DELETE SET NULL,
    kind            TEXT NOT NULL,
    notes           TEXT NOT NULL DEFAULT '',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT act_kind_valid CHECK (
        kind IN ('Call', 'Email', 'SMS', 'Note')
    )
);

CREATE INDEX IF NOT EXISTS idx_activities_customer    ON activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_activities_opportunity ON activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_activities_occurred    ON activities(occurred_at DESC);

-- updated_at triggers ---------------------------------------------

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_touch     ON customers;
DROP TRIGGER IF EXISTS trg_opportunities_touch ON opportunities;

CREATE TRIGGER trg_customers_touch
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_opportunities_touch
    BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
