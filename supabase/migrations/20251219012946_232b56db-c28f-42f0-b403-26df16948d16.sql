-- Adicionar constraint ÚNICA na coluna connection_id
-- Garante que uma conexão só pode estar vinculada a UM agente
ALTER TABLE ai_agent_connections 
ADD CONSTRAINT unique_connection_one_agent UNIQUE (connection_id);