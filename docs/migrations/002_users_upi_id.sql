-- =====================================================================
-- Migration 002: optional UPI ID for each user.
-- Run once on databases created from the original schema.sql.
-- Safe to re-run: the column and constraint are added only if missing.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_id VARCHAR(256);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_upi_id'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_upi_id CHECK (
                upi_id IS NULL OR upi_id ~ '^[A-Za-z0-9_.-]{2,255}@[A-Za-z]{2,64}$'
            );
    END IF;
END $$;
