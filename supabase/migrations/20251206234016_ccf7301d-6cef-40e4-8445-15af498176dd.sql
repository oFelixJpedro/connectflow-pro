-- ======================================================================
-- HABILITAR SUPABASE REALTIME NAS TABELAS DE CONVERSAS E MENSAGENS
-- ======================================================================

-- Habilitar REPLICA IDENTITY FULL para capturar dados completos nas mudanças
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação supabase_realtime
-- Nota: Se já existir, vai dar erro, mas podemos ignorar
DO $$
BEGIN
  -- Tentar adicionar conversations
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    RAISE NOTICE 'Tabela conversations adicionada ao Realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Tabela conversations já está no Realtime';
  END;
  
  -- Tentar adicionar messages
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    RAISE NOTICE 'Tabela messages adicionada ao Realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Tabela messages já está no Realtime';
  END;
END $$;