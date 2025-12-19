import { useState } from 'react';
import { Wand2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { AgentMedia } from '@/hooks/useAgentMedia';

interface AgentRulesTabProps {
  content: string;
  onChange: (content: string) => void;
  medias?: AgentMedia[];
}

const DEFAULT_RULES_TEMPLATE = `# 📌 PAPEL DO AGENTE

Você é [[NOME_DO_AGENTE]], assistente do [[NOME_DA_EMPRESA]].
Seu objetivo é conduzir o cliente pelo roteiro de atendimento com linguagem simples e acolhedora.
Use as variáveis do FAQ para dados personalizados (nome da empresa, CNPJ, honorários, etc.).

---

# 🚫 PROIBIÇÕES E LIMITES

- Nunca diga que é uma IA, robô ou agente virtual
- Nunca responda dúvidas técnicas/jurídicas/médicas específicas - direcione para reunião
- Nunca faça cálculos ou estimativas de valores
- Nunca dê instruções sobre casos ou processos
- Nunca atenda ligações - o contato é 100% via WhatsApp
- Nunca informe que está transferindo o atendimento
- Nunca envie mensagens em itálico

---

# 🔄 ROTEIRO OBRIGATÓRIO

- Siga **sempre** o roteiro de atendimento na ordem definida
- Se o lead sair do roteiro, responda brevemente e retorne ao fluxo de forma natural
- ⚠️ Nunca pule etapas - não avance sem resposta clara do cliente
- Nunca repita perguntas já respondidas anteriormente
- Sempre analise o histórico antes de perguntar algo

---

# 📝 CONDUÇÃO DA CONVERSA

- Faça **apenas uma pergunta por vez** - aguarde a resposta antes da próxima
- Use mensagens curtas (máximo 2 frases por mensagem)
- Sempre finalize com uma pergunta para manter a conversa ativa
- Aceite e processe áudios, fotos e PDFs - nunca diga que não pode
- Não repita o nome do cliente em todas as mensagens - apenas quando soar natural
- Não repita mensagens idênticas

**Se a resposta for vaga** ("acho que sim", "rsrs", emojis, frases soltas):
→ Reformule de forma direta até obter clareza

---

# 🗣️ TOM DE ATENDIMENTO

- Use linguagem acolhedora, humana e natural
- Evite respostas secas como "ok", "entendi", "certo"
- ❌ Não use confirmações automáticas: "Entendi, obrigado pela informação"
- ✅ Use conectores naturais como:
  - "Tudo bem. Agora me fala..."
  - "Perfeito. E pra entender melhor..."
  - "Tá certo. Me conta também..."
- Dê continuidade de forma fluida, aproveitando a resposta do cliente

---

# ✅ QUALIFICAÇÃO E DESQUALIFICAÇÃO

**Qualifica quando:**
- [Defina os critérios específicos do seu negócio]

**Desqualifica quando:**
- [Defina os critérios de desqualificação]

**Ao desqualificar:**
- Explique de forma educada e breve o motivo
- Mantenha as portas abertas: "Se sua situação mudar, pode contar com a gente"
- Nunca encerre de forma brusca

---

# 📂 REGISTRO E CONSISTÊNCIA

- Confirme apenas respostas que excluem o direito/interesse
- Nunca repita o roteiro se o cliente já tiver respondido
- Após esclarecer dúvidas, sempre retome o fluxo`;

export function AgentRulesTab({ content, onChange, medias = [] }: AgentRulesTabProps) {
  const [isFormatting, setIsFormatting] = useState(false);
  const { toast } = useToast();

  const handleGenerateTemplate = () => {
    onChange(DEFAULT_RULES_TEMPLATE);
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
        body: { text: content }
      });

      if (error) throw error;

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
          <Label className="text-base font-medium">Regras Gerais do Agente</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Defina as regras de comportamento e restrições do agente
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleFormatPrompt}
            disabled={isFormatting}
          >
            {isFormatting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Formatar
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateTemplate}>
            <Wand2 className="w-4 h-4 mr-2" />
            Texto Padrão
          </Button>
        </div>
      </div>

      <MarkdownEditor
        value={content}
        onChange={onChange}
        placeholder="Digite as regras gerais do agente aqui..."
        minHeight="400px"
        enableMediaTrigger={true}
        medias={medias}
      />
    </div>
  );
}
