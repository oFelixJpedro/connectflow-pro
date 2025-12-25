-- Add 'blocked' value to conversation_status enum
ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'blocked';