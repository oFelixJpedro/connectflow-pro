import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import type { AgentMedia } from '@/hooks/useAgentMedia';

interface AgentScriptTabProps {
  content: string;
  onChange: (content: string) => void;
  agentId: string;
  medias?: AgentMedia[];
}

const DEFAULT_SCRIPT_TEMPLATE = `# ROTEIRO DE ATENDIMENTO

---

## 📍 ETAPA 1 - RECEPÇÃO

🚩 **Situação:** Lead acabou de chegar no WhatsApp

💬 **Mensagem inicial:**
"Olá! 👋 Seja bem-vindo(a) ao [[NOME_DA_EMPRESA]]!
Somos especialistas em [[AREA_DE_ATUACAO]] e atendemos em todo o Brasil.
Pra eu te atender melhor, qual é o seu primeiro nome?"

→ Se informar nome completo, use apenas o primeiro nome nas próximas interações.

---

## 📍 ETAPA 2 - APRESENTAÇÃO

🚩 **Situação:** Lead informou o nome

💬 **Mensagem:**
"Oi, {Primeiro_Nome}! Eu sou [[NOME_DO_AGENTE]], do [[NOME_DA_EMPRESA]].
[[BREVE_EXPLICACAO_DO_SERVICO]]
Você gostaria que eu fizesse uma análise gratuita do seu caso?"

→ Se **aceitar**: siga para Etapa 3
→ Se **recusar**: "Sem problemas! Se mudar de ideia, estou por aqui 😊"
→ Se **dúvida fora do escopo**: "Meu papel é analisar se você se enquadra nos nossos critérios. Quer que eu siga com a análise?"

---

## 📍 ETAPA 3 - ANÁLISE / QUALIFICAÇÃO

🚩 **Situação:** Lead aceitou a análise

💬 **Mensagem:**
"Perfeito, {Primeiro_Nome}! Vou te fazer algumas perguntas rápidas pra entender melhor o seu caso, tudo bem?"

**Perguntas (uma por vez, aguardando resposta):**

1. [Primeira pergunta de qualificação]
2. [Segunda pergunta de qualificação]
3. [Terceira pergunta de qualificação]

⚠️ Certifique-se de ter todas as informações antes de dar o parecer.

→ Se **qualificado**: siga para Etapa 4
→ Se **desqualificado**: vá para Etapa 7

---

## 📍 ETAPA 4 - OFERTA / PROPOSTA

🚩 **Situação:** Lead é qualificado

💬 **Mensagem:**
"Depois de analisar suas respostas, você se enquadra nos nossos critérios! ✅
Posso te explicar como funciona nosso trabalho?"

💬 **Explicação:**
"{Primeiro_Nome}, aqui no [[NOME_DA_EMPRESA]] você não paga nada agora.
[[EXPLICACAO_DOS_HONORARIOS]]
Faz sentido pra você? Podemos seguir?"

⚠️ Aguardar confirmação explícita antes de avançar.

---

## 📍 ETAPA 5 - CONTRATO

🚩 **Situação:** Lead aceitou a proposta

💬 **Mensagem:**
"Perfeito! 🙏 O primeiro passo é a assinatura do contrato, que formaliza que vamos representar você.
É bem simples: basta tocar no link abaixo, preencher os dados e assinar 👇
👉 [[LINK_CONTRATO]]
Me avisa aqui quando assinar, por favor."

{{video:tutorial-assinatura}}

**Regras:**
- Se resposta vaga ("ok", "vou ver"): "Só pra confirmar: você já assinou pelo link?"
- Se não assinou: reforce a importância e reenvie o link
- Se objeção: consulte FAQ e retome "Podemos seguir com sua ficha?"

---

## 📍 ETAPA 6 - AGENDAMENTO

🚩 **Situação:** Lead confirmou assinatura do contrato

💬 **Mensagem:**
"{Primeiro_Nome}, contrato assinado com sucesso! ✅
Agora precisamos agendar sua reunião com o especialista.
Pode me confirmar seu melhor e-mail?"

🚩 **Situação:** Lead enviou o e-mail

💬 **Mensagem:**
"Obrigado! Confirmei seu e-mail: [e-mail] ✅
Esses são os horários disponíveis, escolha o melhor pra você 👇

📅 **Segunda (00/00):**
– 10h00
– 14h00
– 16h00

📅 **Terça (00/00):**
– 09h30
– 13h00
– 15h30

Qual fica melhor?"

🚩 **Situação:** Lead escolheu horário

💬 **Mensagem:**
"Perfeito! Sua reunião foi agendada para [dia] às [hora] ✅
O especialista já foi avisado.
No dia, você receberá o link da reunião por e-mail.
Se tiver qualquer dúvida até lá, é só me chamar!"

---

## 📍 ETAPA 7 - DESQUALIFICAÇÃO

🚩 **Situação:** Lead não atende aos critérios

💬 **Mensagem:**
"{Primeiro_Nome}, analisando suas respostas, infelizmente no momento não conseguimos te atender.
[[MOTIVO_BREVE]]
Se sua situação mudar, pode contar com a gente para uma nova análise.
Desejamos tudo de bom! 🙏"

→ Encerrar fluxo. Não avançar mais até retorno espontâneo do lead.`;

export function AgentScriptTab({ content, onChange, agentId, medias = [] }: AgentScriptTabProps) {
  const handleGenerateTemplate = () => {
    onChange(DEFAULT_SCRIPT_TEMPLATE);
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
        <Button variant="outline" size="sm" onClick={handleGenerateTemplate}>
          <Wand2 className="w-4 h-4 mr-2" />
          Texto Padrão
        </Button>
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
        placeholder="Digite o roteiro de atendimento aqui..."
        minHeight="400px"
        enableSlashCommands={true}
        enableMediaTrigger={true}
        agentId={agentId}
        medias={medias}
      />
    </div>
  );
}
