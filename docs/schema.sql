-- =====================================================================
-- ZeroOut: PostgreSQL schema (PostgreSQL 13+ for gen_random_uuid via pgcrypto).
-- All money is stored as NUMERIC(10,2) and computed in integer paise
-- by the application layer.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    upi_id        VARCHAR(256),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_upi_id CHECK (
        upi_id IS NULL OR upi_id ~ '^[A-Za-z0-9_.-]{2,255}@[A-Za-z]{2,64}$'
    )
);

-- 2. groups
CREATE TABLE IF NOT EXISTS groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    category    VARCHAR(50)  NOT NULL DEFAULT 'Trip',
    created_by  UUID         NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. group_members (composite PK)
CREATE TABLE IF NOT EXISTS group_members (
    group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id),
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- 4. expenses
CREATE TABLE IF NOT EXISTS expenses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    paid_by      UUID          NOT NULL REFERENCES users(id),
    amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    description  VARCHAR(255)  NOT NULL,
    split_type   VARCHAR(20)   NOT NULL CHECK (split_type IN ('EQUAL', 'EXACT', 'PERCENTAGE')),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 5. expense_splits
CREATE TABLE IF NOT EXISTS expense_splits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id   UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id      UUID          NOT NULL REFERENCES users(id),
    amount_owed  NUMERIC(10,2) NOT NULL CHECK (amount_owed >= 0),
    percentage   NUMERIC(5,2)  CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
    CONSTRAINT uq_expense_splits_expense_user UNIQUE (expense_id, user_id)
);

-- 6. settlements
CREATE TABLE IF NOT EXISTS settlements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    paid_by     UUID          NOT NULL REFERENCES users(id),
    paid_to     UUID          NOT NULL REFERENCES users(id),
    amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CHECK (paid_by <> paid_to)
);

-- ---------------------------------------------------------------------
-- Performance indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_groups_created_by         ON groups (created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_user        ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group_created    ON expenses (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by          ON expenses (paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user       ON expense_splits (user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group_created ON settlements (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_paid_by       ON settlements (paid_by);
CREATE INDEX IF NOT EXISTS idx_settlements_paid_to       ON settlements (paid_to);
