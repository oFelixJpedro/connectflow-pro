-- Remove Google Calendar integration

-- Drop the Google tokens table
DROP TABLE IF EXISTS public.calendar_google_tokens CASCADE;

-- Remove Google-related columns from calendar_events
ALTER TABLE public.calendar_events 
  DROP COLUMN IF EXISTS google_event_id,
  DROP COLUMN IF EXISTS google_calendar_synced;