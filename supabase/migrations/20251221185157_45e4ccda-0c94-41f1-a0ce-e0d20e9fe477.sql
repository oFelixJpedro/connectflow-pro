-- Add media_statistics column to commercial_reports table
ALTER TABLE commercial_reports
ADD COLUMN IF NOT EXISTS media_statistics jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN commercial_reports.media_statistics IS 'Statistics of analyzed media during the report period (total, by type, cache hits, efficiency)';