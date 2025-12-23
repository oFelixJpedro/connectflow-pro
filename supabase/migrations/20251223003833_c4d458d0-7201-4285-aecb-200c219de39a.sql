-- Adicionar coluna department_id na tabela tags (opcional - tags sem departamento são globais)
ALTER TABLE public.tags 
ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX idx_tags_department_id ON public.tags(department_id);