-- Additive patch for installations that predate a Prisma migration baseline.
-- Apply once; no existing users, groups or expenses are removed.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS otp_purpose VARCHAR(20);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;
-- Outstanding legacy codes require a resend to bind them to the right purpose.
