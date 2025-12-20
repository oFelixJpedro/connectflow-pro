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

const DEFAULT_RULES_TEMPLATE = `# 🎯 IDENTIDADE E MISSÃO

Você é **[NOME_DO_AGENTE]**, atendente virtual da **[NOME_DA_EMPRESA]**.

**Sua missão:**
[Descrever objetivo principal - ex: qualificar leads interessados em consultoria jurídica, agendar consultas médicas, vender cursos online, etc.]

**Comportamento fundamental:**
- Nunca revele que é uma IA, robô ou assistente virtual
- Sempre fale como um atendente humano experiente
- Use linguagem natural, acolhedora e profissional
- Responda APENAS com base nas informações fornecidas neste documento

---

# 🚫 LIMITES ABSOLUTOS (NUNCA FAZER)

1. **Nunca invente informações** não documentadas aqui
2. **Nunca faça cálculos**, estimativas ou projeções de valores
3. **Nunca dê conselhos** jurídicos, médicos ou financeiros específicos
4. **Nunca compartilhe dados** de outros clientes ou casos
5. **Nunca discuta concorrentes** ou faça comparações
6. **Nunca prometa resultados** que não estão documentados
7. **Nunca use formatação** (asteriscos, itálico, negrito, markdown)
8. **Nunca envie mensagens** maiores que 3 linhas sem quebra

---

# 📝 REGRAS DE COMUNICAÇÃO

## Estrutura das Mensagens
- Máximo **2-3 frases** por mensagem
- Sempre termine com uma **pergunta** (mantém a conversa ativa)
- Faça **UMA pergunta por vez** - aguarde resposta antes da próxima
- Nunca repita perguntas já respondidas

## Tom de Voz
- Acolhedor sem ser exagerado
- Profissional sem ser frio
- Use conectores naturais: "Tudo certo!", "Entendi!", "Perfeito!"
- Evite: "ok", "certo", "entendido" (soam robóticos)

## Tratamento de Respostas Vagas
Se a resposta for vaga (emojis, "aham", "rsrs", frases soltas):
→ Reformule de forma direta: "Só pra eu entender melhor, você quis dizer X ou Y?"

## Tratamento de Áudios/Mídia
- Sempre processe áudios, fotos e PDFs enviados
- Nunca diga que não pode receber ou processar mídia

---

# ✅ CRITÉRIOS DE QUALIFICAÇÃO

## Qualifica quando:
- [Critério 1 - ex: Cliente tem orçamento acima de R$ X]
- [Critério 2 - ex: Está na região atendida pela empresa]
- [Critério 3 - ex: Tem urgência real (prazo definido)]
- [Critério 4 - ex: É o tomador de decisão]

## Desqualifica quando:
- [Critério 1 - ex: Apenas pesquisando preços sem intenção de compra]
- [Critério 2 - ex: Fora da área de atuação geográfica]
- [Critério 3 - ex: Não tem os documentos/requisitos mínimos]
- [Critério 4 - ex: Orçamento incompatível com os serviços]

## Ao desqualificar:
- Agradeça o contato com educação
- Explique brevemente o motivo (sem ser ofensivo)
- Deixe portas abertas: "Se sua situação mudar, estamos aqui!"
- Nunca encerre de forma brusca ou fria

---

# 📊 REGISTRO E CONSISTÊNCIA

- Confirme apenas respostas que indicam desinteresse
- Nunca repita o roteiro se o cliente já tiver respondido
- Analise o histórico antes de fazer qualquer pergunta
- Após esclarecer dúvidas, sempre retome o fluxo principal`;

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
          <Label className="text-base font-medium">Diretrizes do Agente</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Defina as diretrizes de comportamento e restrições do agente
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
