import { useState } from 'react';
import { Wand2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AgentMedia } from '@/hooks/useAgentMedia';
import { useAICredits } from '@/hooks/useAICredits';

interface AgentScriptTabProps {
  content: string;
  onChange: (content: string) => void;
  agentId: string;
  medias?: AgentMedia[];
}

const DEFAULT_SCRIPT_TEMPLATE = `# 📋 FLUXO DE ATENDIMENTO

Siga este roteiro **na ordem**, fazendo uma pergunta por vez e aguardando a resposta antes de avançar.

---

## 📍 ETAPA 1: BOAS-VINDAS

**Objetivo:** Criar conexão e identificar o cliente

**Quando:** Lead acabou de enviar a primeira mensagem

**Ação:**
1. Cumprimente de forma calorosa
2. Pergunte o nome do cliente

**Exemplo de mensagem:**
"Olá! Seja bem-vindo(a) ao [NOME_EMPRESA]! 👋
Sou [NOME_AGENTE] e vou te atender.
Qual é o seu nome?"

**Regras:**
- Se informar nome completo, use apenas o primeiro nome nas próximas mensagens
- Se já tiver o nome no histórico, pule para Etapa 2

---

## 📍 ETAPA 2: DESCOBERTA DA NECESSIDADE

**Objetivo:** Entender exatamente o que o cliente precisa

**Quando:** Cliente informou o nome

**Ação:**
1. Agradeça e personalize com o nome
2. Pergunte como pode ajudar

**Exemplo de mensagem:**
"Prazer, {Nome}! 
Como posso te ajudar hoje?"

**Se a resposta for genérica ("quero saber mais", "vi o anúncio"):**
→ Faça uma pergunta direcionada: "Claro! Você está buscando [opção A] ou [opção B]?"

---

## 📍 ETAPA 3: QUALIFICAÇÃO

**Objetivo:** Verificar se o cliente atende aos critérios

**Quando:** Cliente explicou sua necessidade

**Perguntas de qualificação (fazer UMA por vez):**

1. "[Pergunta de qualificação 1 - ex: Qual sua região?]"
2. "[Pergunta de qualificação 2 - ex: Qual seu orçamento disponível?]"
3. "[Pergunta de qualificação 3 - ex: Para quando você precisa?]"

**Regras:**
- Aguarde a resposta de cada pergunta antes de fazer a próxima
- Nunca repita perguntas já respondidas
- Se resposta for vaga, reformule de forma objetiva

**Se QUALIFICADO:** → Siga para Etapa 4
**Se DESQUALIFICADO:** → Siga para Etapa 6

---

## 📍 ETAPA 4: APRESENTAÇÃO DA SOLUÇÃO

**Objetivo:** Mostrar como podemos ajudar

**Quando:** Cliente passou pela qualificação

**Ação:**
1. Confirme que pode ajudar
2. Explique brevemente a solução
3. Pergunte se faz sentido

**Exemplo de mensagem:**
"Perfeito, {Nome}! Analisando o que você me contou, você se enquadra perfeitamente no nosso perfil.

[Explicação breve da solução - 2 a 3 frases]

Faz sentido pra você? Posso te explicar como funciona?"

---

## 📍 ETAPA 5: PRÓXIMOS PASSOS

**Objetivo:** Converter para a próxima ação

**Quando:** Cliente demonstrou interesse na solução

**Opção A - Agendamento:**
"Ótimo! O próximo passo é agendar uma conversa com nosso especialista.
Tenho horários disponíveis [dias/horários].
Qual fica melhor pra você?"

**Opção B - Envio de contrato/proposta:**
"Perfeito! Vou te enviar o [contrato/proposta] agora.
É só clicar no link, conferir os dados e assinar 👇
[Link]
Me avisa quando concluir!"

**Opção C - Transferência para humano:**
/transferir_usuario:[Nome do Especialista]

---

## 📍 ETAPA 6: ENCERRAMENTO (Desqualificado)

**Objetivo:** Encerrar com educação mantendo portas abertas

**Quando:** Cliente não atende aos critérios

**Exemplo de mensagem:**
"{Nome}, analisando suas respostas, infelizmente no momento não conseguimos te atender.
[Motivo breve - ex: "Nosso serviço é focado em empresas acima de 10 funcionários"]
Se sua situação mudar, pode contar com a gente para uma nova análise.
Desejamos sucesso! 🙏"

**Ações:**
- Não continuar o atendimento após desqualificar
- Aguardar retorno espontâneo do lead`;

export function AgentScriptTab({ content, onChange, agentId, medias = [] }: AgentScriptTabProps) {
  const [isFormatting, setIsFormatting] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();
  const { hasCredits, isLoading: isLoadingCredits } = useAICredits();
  const hasTextCredits = !isLoadingCredits && hasCredits('standard_text');

  const handleGenerateTemplate = () => {
    onChange(DEFAULT_SCRIPT_TEMPLATE);
  };

  const handleFormatPrompt = async () => {
    if (!content.trim()) {
      toast({
        title: "Erro",
        description: "Adicione conteúdo antes de formatar",
        variant: "destructive",
      });
      return;
    }

    setIsFormatting(true);
    try {
      const { data, error } = await supabase.functions.invoke('format-prompt', {
        body: { text: content, companyId: profile?.company_id }
      });

      if (error) throw error;

      // 💰 Handle insufficient credits
      if (data?.code === 'INSUFFICIENT_CREDITS') {
        toast({
          title: "Créditos insuficientes",
          description: "Recarregue seus créditos de IA para usar esta função.",
          variant: "destructive",
        });
        return;
      }

      if (data?.formattedText) {
        onChange(data.formattedText);
        toast({
          title: "Formatado!",
          description: "O prompt foi formatado com sucesso",
        });
      } else {
        throw new Error('Resposta inválida');
      }
    } catch (error) {
      console.error('Error formatting prompt:', error);
      toast({
        title: "Erro ao formatar",
        description: "Não foi possível formatar o prompt",
        variant: "destructive",
      });
    } finally {
      setIsFormatting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Fluxo de Atendimento</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Defina o fluxo de atendimento do agente passo a passo
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleFormatPrompt}
            disabled={isFormatting || !hasTextCredits}
            title={hasTextCredits ? 'Formatar com IA' : 'Créditos insuficientes'}
            className={!hasTextCredits ? 'opacity-50' : ''}
          >
            {isFormatting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {hasTextCredits ? 'Formatar' : 'Sem créditos'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateTemplate}>
            <Wand2 className="w-4 h-4 mr-2" />
            Texto Padrão
          </Button>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <p className="font-medium">💡 Dicas de formatação:</p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>• Digite <code className="bg-muted px-1 rounded">{"{{"}</code> para abrir a seleção de mídias</li>
          <li>• Use <code className="bg-muted px-1 rounded">{"{{image:nome}}"}</code> para enviar uma imagem</li>
          <li>• Use <code className="bg-muted px-1 rounded">{"{{video:nome}}"}</code> para enviar um vídeo</li>
          <li>• Digite <code className="bg-muted px-1 rounded">/</code> para comandos (etiquetas, transferências, etc.)</li>
        </ul>
      </div>

      <MarkdownEditor
        value={content}
        onChange={onChange}
        placeholder="Digite o fluxo de atendimento aqui..."
        minHeight="400px"
        enableSlashCommands={true}
        enableMediaTrigger={true}
        agentId={agentId}
        medias={medias}
      />
    </div>
  );
}
