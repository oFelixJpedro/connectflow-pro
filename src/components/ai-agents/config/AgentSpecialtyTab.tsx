import { useState } from 'react';
import { Plus, X, Target, UserCheck, UserX, Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AgentSpecialtyTabProps {
  specialtyKeywords: string[];
  qualificationSummary: string;
  disqualificationSigns: string;
  onKeywordsChange: (keywords: string[]) => void;
  onQualificationChange: (summary: string) => void;
  onDisqualificationChange: (signs: string) => void;
}

export function AgentSpecialtyTab({
  specialtyKeywords,
  qualificationSummary,
  disqualificationSigns,
  onKeywordsChange,
  onQualificationChange,
  onDisqualificationChange,
}: AgentSpecialtyTabProps) {
  const [newKeyword, setNewKeyword] = useState('');

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const keyword = newKeyword.trim().toLowerCase();
    if (!specialtyKeywords.includes(keyword)) {
      onKeywordsChange([...specialtyKeywords, keyword]);
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (index: number) => {
    onKeywordsChange(specialtyKeywords.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Header explicativo */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium text-sm">Redirecionamento Inteligente</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure as informações de especialidade deste agente. O sistema usará esses dados 
              para redirecionar automaticamente leads entre agentes, sem precisar escrever instruções 
              de transferência no roteiro.
            </p>
          </div>
        </div>
      </div>

      {/* Palavras-chave */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Palavras-chave da Especialidade</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-xs">
                  Termos que identificam esta especialidade. Ex: "agendamento", "orçamento", "suporte", "vendas".
                  O sistema usa essas palavras para identificar quando um lead menciona algo relacionado.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription>
            Termos que identificam quando um lead está falando sobre esta especialidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Ex: agendamento, orçamento, dúvidas, suporte..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
            />
            <Button onClick={handleAddKeyword} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {specialtyKeywords.map((keyword, index) => (
              <Badge key={index} variant="secondary" className="text-sm py-1 px-2">
                {keyword}
                <button
                  onClick={() => handleRemoveKeyword(index)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {specialtyKeywords.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma palavra-chave adicionada ainda
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Perfil de Qualificação */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            <CardTitle className="text-base">Perfil do Cliente Ideal</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-xs">
                  Descreva o perfil do cliente ideal para esta especialidade. Outros agentes usarão 
                  essa descrição para saber quando transferir um lead para você.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription>
            Descrição do perfil ideal para esta especialidade (outros agentes verão isso)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={qualificationSummary}
            onChange={(e) => onQualificationChange(e.target.value)}
            placeholder="Ex: Pessoas interessadas no serviço, com orçamento definido, prontas para começar, que precisam de atendimento urgente..."
            className="min-h-[100px] resize-none"
            maxLength={500}
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs text-muted-foreground">
              {qualificationSummary.length}/500
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Sinais de Desqualificação */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-amber-500" />
            <CardTitle className="text-base">Sinais de Não-Qualificação</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-xs">
                  Indicadores de que o lead NÃO se encaixa nesta especialidade. O agente usará 
                  isso para identificar quando deve transferir para outro especialista.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription>
            Indicadores de que o lead não se encaixa nesta especialidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={disqualificationSigns}
            onChange={(e) => onDisqualificationChange(e.target.value)}
            placeholder="Ex: Apenas pesquisando preços, sem urgência, fora da área de atuação, orçamento incompatível..."
            className="min-h-[100px] resize-none"
            maxLength={500}
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs text-muted-foreground">
              {disqualificationSigns.length}/500
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Preview de como será mostrado */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">
            Preview: Como outros agentes verão este agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
            <p>
              <strong>Palavras-chave:</strong>{' '}
              {specialtyKeywords.length > 0 
                ? specialtyKeywords.join(', ') 
                : <span className="text-muted-foreground italic">não definidas</span>}
            </p>
            <p>
              <strong>Perfil ideal:</strong>{' '}
              {qualificationSummary 
                ? qualificationSummary.substring(0, 150) + (qualificationSummary.length > 150 ? '...' : '')
                : <span className="text-muted-foreground italic">não definido</span>}
            </p>
            <p>
              <strong>Não se encaixa se:</strong>{' '}
              {disqualificationSigns 
                ? disqualificationSigns.substring(0, 150) + (disqualificationSigns.length > 150 ? '...' : '')
                : <span className="text-muted-foreground italic">não definido</span>}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}