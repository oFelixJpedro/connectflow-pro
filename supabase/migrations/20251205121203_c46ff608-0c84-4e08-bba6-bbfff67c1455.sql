-- 1. Remover a constraint antiga que bloqueia múltiplos NULL
ALTER TABLE whatsapp_connections 
DROP CONSTRAINT IF EXISTS whatsapp_connections_company_id_phone_number_key;

-- 2. Criar índice único parcial que permite múltiplos NULL/placeholders
-- Só impede duplicação quando phone_number é um número real (não placeholder)
CREATE UNIQUE INDEX IF NOT EXISTS unique_company_phone_when_connected 
ON whatsapp_connections (company_id, phone_number) 
WHERE phone_number IS NOT NULL 
  AND phone_number != 'Aguardando...'
  AND phone_number != '';

-- 3. Garantir que session_id seja único globalmente (já existe, mas vamos garantir)
-- Primeiro verificar se já existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'whatsapp_connections_session_id_key'
  ) THEN
    ALTER TABLE whatsapp_connections ADD CONSTRAINT whatsapp_connections_session_id_key UNIQUE (session_id);
  END IF;
END
$$;

-- 4. Limpar registros órfãos (conexões que nunca completaram há mais de 1 hora)
DELETE FROM whatsapp_connections 
WHERE (phone_number IS NULL OR phone_number = 'Aguardando...')
  AND status IN ('connecting', 'qr_ready')
  AND created_at < NOW() - INTERVAL '1 hour';