-- Habilitar REPLICA IDENTITY FULL para capturar todos os dados nas mudanças
ALTER TABLE scheduled_messages REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_messages;