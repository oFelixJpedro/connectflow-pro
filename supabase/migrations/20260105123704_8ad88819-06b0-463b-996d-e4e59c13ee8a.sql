-- Habilitar extensão pgvector para embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Adicionar campo de conhecimento textual na tabela ai_agents
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS knowledge_base_content TEXT;

-- Tabela de documentos do knowledge base
CREATE TABLE IF NOT EXISTS ai_agent_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de chunks com embeddings para busca semântica
CREATE TABLE IF NOT EXISTS ai_agent_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES ai_agent_knowledge_documents(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por similaridade (IVFFlat)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
ON ai_agent_knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent ON ai_agent_knowledge_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_company ON ai_agent_knowledge_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent ON ai_agent_knowledge_chunks(agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON ai_agent_knowledge_chunks(document_id);

-- RLS Policies para documents
ALTER TABLE ai_agent_knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view knowledge documents from their company" 
ON ai_agent_knowledge_documents 
FOR SELECT 
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert knowledge documents for their company" 
ON ai_agent_knowledge_documents 
FOR INSERT 
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update knowledge documents from their company" 
ON ai_agent_knowledge_documents 
FOR UPDATE 
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete knowledge documents from their company" 
ON ai_agent_knowledge_documents 
FOR DELETE 
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies para chunks
ALTER TABLE ai_agent_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view knowledge chunks from their company agents" 
ON ai_agent_knowledge_chunks 
FOR SELECT 
USING (agent_id IN (
  SELECT id FROM ai_agents WHERE company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
));

CREATE POLICY "Users can insert knowledge chunks for their company agents" 
ON ai_agent_knowledge_chunks 
FOR INSERT 
WITH CHECK (agent_id IN (
  SELECT id FROM ai_agents WHERE company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
));

CREATE POLICY "Users can delete knowledge chunks from their company agents" 
ON ai_agent_knowledge_chunks 
FOR DELETE 
USING (agent_id IN (
  SELECT id FROM ai_agents WHERE company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
));

-- Função de busca por similaridade
CREATE OR REPLACE FUNCTION search_agent_knowledge(
  p_agent_id UUID,
  p_query_embedding VECTOR(768),
  p_limit INTEGER DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS chunk_id,
    c.document_id,
    c.content,
    (1 - (c.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM ai_agent_knowledge_chunks c
  WHERE c.agent_id = p_agent_id
    AND (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- Criar bucket de storage para documentos do knowledge base
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-agent-knowledge',
  'ai-agent-knowledge',
  false,
  20971520, -- 20MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload knowledge documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ai-agent-knowledge' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view knowledge documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ai-agent-knowledge' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete knowledge documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ai-agent-knowledge' 
  AND auth.role() = 'authenticated'
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_knowledge_doc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON ai_agent_knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_doc_updated_at();