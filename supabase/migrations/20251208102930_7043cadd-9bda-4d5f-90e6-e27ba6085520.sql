-- Adicionar coluna department_access_mode na tabela connection_users
-- para distinguir entre 'all' (todos departamentos), 'specific' (selecionados) e 'none' (nenhum)
ALTER TABLE public.connection_users 
ADD COLUMN department_access_mode text NOT NULL DEFAULT 'all' 
CHECK (department_access_mode IN ('all', 'specific', 'none'));