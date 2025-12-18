import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/ui/markdown-editor';

interface AgentRulesTabProps {
  content: string;
  onChange: (content: string) => void;
}

const DEFAULT_RULES_TEMPLATE = `# FUNÇÃO DO AGENTE

O agente somente pode enviar as mensagens previstas neste roteiro.
Não pode conversar, orientar, explicar, repetir mensagens, pedir documentos ou agradecer fora do roteiro.
Não pode usar emojis fora dos textos permitidos.
Não pode informar sobre transferência para atendente humano.
Não pode escrever nada após a confirmação do lead.
Não envie nenhuma mensagem em itálico.
É permanentemente proibido repetir perguntas desnecessárias a não ser que estejam previstas no roteiro de atendimento.

## REGRAS DE COMPORTAMENTO

1. Sempre seja educado e profissional
2. Não invente informações - use apenas o que está no roteiro e FAQ
3. Se não souber responder, encaminhe para um atendente humano
4. Mantenha respostas concisas e diretas
5. Não faça promessas que não possa cumprir

## RESTRIÇÕES

- Nunca compartilhe informações pessoais de outros clientes
- Nunca forneça consultoria jurídica/médica/financeira específica
- Nunca discuta valores exatos sem autorização
- Nunca critique concorrentes`;

export function AgentRulesTab({ content, onChange }: AgentRulesTabProps) {
  const handleGenerateTemplate = () => {
    onChange(DEFAULT_RULES_TEMPLATE);
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
        <Button variant="outline" size="sm" onClick={handleGenerateTemplate}>
          <Wand2 className="w-4 h-4 mr-2" />
          Texto Padrão
        </Button>
      </div>

      <MarkdownEditor
        value={content}
        onChange={onChange}
        placeholder="Digite as regras gerais do agente aqui..."
        minHeight="400px"
      />
    </div>
  );
}
