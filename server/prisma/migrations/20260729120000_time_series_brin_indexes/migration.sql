-- Time-series BRIN indexes.
--
-- Analytics and AuditLog are append-only, naturally time-ordered tables that
-- grow without bound between retention runs. BRIN (Block Range) indexes are
-- tiny and ideal for such data: they make time-range scans and the retention
-- DELETEs (WHERE timestamp/createdAt < cutoff) efficient at scale without the
-- write overhead of large btree indexes.
--
-- These complement the existing btree indexes and are a low-risk stepping stone
-- toward native range partitioning (see the "Data lifecycle" runbook).

CREATE INDEX IF NOT EXISTS "Analytics_timestamp_brin_idx"
  ON "Analytics" USING BRIN ("timestamp");

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_brin_idx"
  ON "AuditLog" USING BRIN ("createdAt");
