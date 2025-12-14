-- Delete duplicate general rooms, keeping only the oldest one per company
DELETE FROM internal_chat_rooms
WHERE type = 'general'
AND id NOT IN (
  SELECT DISTINCT ON (company_id) id
  FROM internal_chat_rooms
  WHERE type = 'general'
  ORDER BY company_id, created_at ASC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_unique_general_room_per_company 
ON internal_chat_rooms (company_id) 
WHERE type = 'general';