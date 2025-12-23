-- Configura REPLICA IDENTITY FULL para a tabela kanban_cards
-- Isso garante que todas as colunas (incluindo contact_id) sejam incluídas
-- nos eventos de UPDATE do WAL, permitindo que o Supabase Realtime
-- filtre corretamente por contact_id mesmo quando essa coluna não é alterada.

ALTER TABLE public.kanban_cards REPLICA IDENTITY FULL;