import { useState } from 'react';
import { HelpCircle, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import type { AIAgentCompanyInfo } from '@/types/ai-agents';

interface AgentFAQTabProps {
  content: string;
  onChange: (content: string) => void;
  companyInfo: AIAgentCompanyInfo;
  onCompanyInfoChange: (info: AIAgentCompanyInfo) => void;
  contractLink: string;
  onContractLinkChange: (link: string) => void;
}

const COMPANY_INFO_FIELDS = [
  { key: 'company_name', label: 'Nome do Escritório/Empresa', placeholder: 'Ex: Escritório Exemplo' },
  { key: 'agent_name', label: 'Nome do Agente', placeholder: 'Ex: Maria' },
  { key: 'cnpj', label: 'CNPJ', placeholder: 'Ex: 00.000.000/0001-00' },
  { key: 'business_area', label: 'Área de Atuação', placeholder: 'Ex: Direito Civil' },
  { key: 'address', label: 'Endereço', placeholder: 'Ex: Rua Exemplo, nº 123, Centro, Cidade/UF' },
  { key: 'responsible_person', label: 'Advogado/Responsável', placeholder: 'Ex: Dr. João da Silva' },
  { key: 'oab', label: 'OAB', placeholder: 'Ex: OAB/UF nº 00000' },
  { key: 'fees', label: 'Honorários', placeholder: 'Ex: 20% do êxito + parcelas de R$ 000,00' },
  { key: 'cancellation_fee', label: 'Multa de Desistência', placeholder: 'Ex: R$ 0,00' },
  { key: 'minimum_wage', label: 'Salário Mínimo Vigente', placeholder: 'Ex: R$ 1.500,00' },
];

const FAQ_PLACEHOLDER = `## Perguntas Frequentes

**P: Qual o horário de atendimento?**
R: Nosso horário de atendimento é de segunda a sexta, das 9h às 18h.

**P: Quanto tempo demora o processo?**
R: O prazo médio é de 6 a 12 meses, dependendo da complexidade do caso.

**P: Quais documentos são necessários?**
R: Os documentos básicos são:
- RG
- CPF
- Comprovante de residência
- Documentação específica do caso`;

export function AgentFAQTab({
  content,
  onChange,
  companyInfo,
  onCompanyInfoChange,
  contractLink,
  onContractLinkChange,
}: AgentFAQTabProps) {
  const [companyInfoOpen, setCompanyInfoOpen] = useState(true);
  const [faqOpen, setFaqOpen] = useState(true);

  const handleCompanyFieldChange = (key: string, value: string) => {
    onCompanyInfoChange({
      ...companyInfo,
      [key]: value,
    });
  };

  // Verificar campos incompletos
  const incompleteFields = COMPANY_INFO_FIELDS.filter(
    field => !companyInfo[field.key as keyof AIAgentCompanyInfo]
  );

  return (
    <div className="space-y-6">
      {/* Informações da Empresa */}
      <Collapsible open={companyInfoOpen} onOpenChange={setCompanyInfoOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  <CardTitle className="text-base">Informações do Escritório</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {incompleteFields.length > 0 && (
                    <Alert className="py-1 px-2 border-amber-500/50 bg-amber-500/10">
                      <AlertDescription className="text-xs text-amber-600">
                        {incompleteFields.length} campos incompletos
                      </AlertDescription>
                    </Alert>
                  )}
                  {companyInfoOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4">
                {COMPANY_INFO_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={field.key} className="text-sm">
                      {field.label}
                    </Label>
                    <Input
                      id={field.key}
                      value={companyInfo[field.key as keyof AIAgentCompanyInfo] || ''}
                      onChange={(e) => handleCompanyFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="contract_link" className="text-sm">
                    Link do Contrato
                  </Label>
                  <Input
                    id="contract_link"
                    value={contractLink}
                    onChange={(e) => onContractLinkChange(e.target.value)}
                    placeholder="Ex: https://exemplo.com.br/contrato/..."
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* FAQ Content */}
      <Collapsible open={faqOpen} onOpenChange={setFaqOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  <CardTitle className="text-base">Perguntas Frequentes</CardTitle>
                </div>
                {faqOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Adicione perguntas frequentes e suas respostas para o agente consultar durante o atendimento.
              </p>

              <MarkdownEditor
                value={content}
                onChange={onChange}
                placeholder={FAQ_PLACEHOLDER}
                minHeight="300px"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
