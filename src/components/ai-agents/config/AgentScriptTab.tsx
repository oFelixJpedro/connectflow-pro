import { Wand2, Plus, Image, Video, Mic, FileText, Link, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AgentScriptTabProps {
  content: string;
  onChange: (content: string) => void;
  agentId: string;
}

const DEFAULT_SCRIPT_TEMPLATE = `# 1. ENTRADA DO LEAD

Assim que o lead responder, o agente deve analisar a mensagem e enviar a saudação inicial.

**SAUDAÇÃO:**
"Olá! 👋 Seja bem-vindo(a)! Sou a assistente virtual e estou aqui para ajudar você."

## 2. QUALIFICAÇÃO

Após a saudação, pergunte o que o cliente precisa:
"Como posso ajudar você hoje?"

## 3. IDENTIFICAÇÃO DA NECESSIDADE

Se o cliente mencionar [área específica]:
- Colete nome completo
- Colete telefone de contato
- Confirme o interesse

## 4. COLETA DE DADOS

"Para darmos continuidade, preciso de algumas informações:
📝 Qual o seu nome completo?"

Após receber o nome:
"Obrigado, [NOME]! Agora, qual o seu telefone com DDD?"

## 5. CONFIRMAÇÃO

"Perfeito! Vou registrar seus dados:
👤 Nome: [NOME]
📞 Telefone: [TELEFONE]

Está tudo certo?"

## 6. ENCERRAMENTO

Se confirmado:
"Excelente! Um de nossos especialistas entrará em contato em breve. Obrigado pelo contato! 🙏"

## 7. OBJEÇÕES

Se o cliente disser que não tem interesse:
- Chame o agente /tratar-objecoes

Se o cliente pedir para falar com humano:
- Informe que um atendente assumirá em breve
- Desative a IA para essa conversa`;

export function AgentScriptTab({ content, onChange, agentId }: AgentScriptTabProps) {
  const handleGenerateTemplate = () => {
    onChange(DEFAULT_SCRIPT_TEMPLATE);
  };

  const insertPlaceholder = (type: string) => {
    const placeholder = `{{${type}:nome-do-arquivo}}`;
    onChange(content + placeholder);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Roteiro de Atendimento</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Defina o fluxo de atendimento do agente passo a passo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Inserir Mídia
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => insertPlaceholder('imagem')}>
                <Image className="w-4 h-4 mr-2" />
                Imagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertPlaceholder('video')}>
                <Video className="w-4 h-4 mr-2" />
                Vídeo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertPlaceholder('audio')}>
                <Mic className="w-4 h-4 mr-2" />
                Áudio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertPlaceholder('documento')}>
                <FileText className="w-4 h-4 mr-2" />
                Documento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertPlaceholder('texto')}>
                <Type className="w-4 h-4 mr-2" />
                Texto Fixo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertPlaceholder('link')}>
                <Link className="w-4 h-4 mr-2" />
                Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleGenerateTemplate}>
            <Wand2 className="w-4 h-4 mr-2" />
            Texto Padrão
          </Button>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <p className="font-medium">💡 Dicas de formatação:</p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>• Use <code className="bg-muted px-1 rounded">{"{{imagem:nome}}"}</code> para enviar uma imagem</li>
          <li>• Use <code className="bg-muted px-1 rounded">{"{{video:nome}}"}</code> para enviar um vídeo</li>
          <li>• Use <code className="bg-muted px-1 rounded">/nome-do-agente</code> para chamar outro agente</li>
          <li>• Use "Se o cliente falar X, faça Y" para criar condicionais</li>
        </ul>
      </div>

      <MarkdownEditor
        value={content}
        onChange={onChange}
        placeholder="Digite o roteiro de atendimento aqui..."
        minHeight="400px"
      />
    </div>
  );
}
