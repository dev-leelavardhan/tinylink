-- Add standalone timestamp index for efficient analytics cleanup queries.
CREATE INDEX "Analytics_timestamp_idx" ON "Analytics" ("timestamp");
