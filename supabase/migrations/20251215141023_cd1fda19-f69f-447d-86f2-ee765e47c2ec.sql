
-- Fix messages_deleted_by_fkey: Change from NO ACTION to SET NULL
ALTER TABLE messages DROP CONSTRAINT messages_deleted_by_fkey;
ALTER TABLE messages 
ADD CONSTRAINT messages_deleted_by_fkey 
FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix developer_permission_requests_approver_id_fkey: Change from NO ACTION to SET NULL
ALTER TABLE developer_permission_requests DROP CONSTRAINT developer_permission_requests_approver_id_fkey;
ALTER TABLE developer_permission_requests 
ADD CONSTRAINT developer_permission_requests_approver_id_fkey 
FOREIGN KEY (approver_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix internal_chat_rooms_created_by_fkey: Change from NO ACTION to SET NULL
ALTER TABLE internal_chat_rooms DROP CONSTRAINT internal_chat_rooms_created_by_fkey;
ALTER TABLE internal_chat_rooms 
ADD CONSTRAINT internal_chat_rooms_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
