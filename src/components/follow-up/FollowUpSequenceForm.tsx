import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFollowUpSequences } from '@/hooks/useFollowUpSequences';
import { useAICredits } from '@/hooks/useAICredits';
import {
  FollowUpSequence,
  FollowUpType,
  DelayUnit,
  FOLLOWUP_TYPE_LABELS,
  DELAY_UNIT_LABELS,
  CreateStepData
} from '@/types/follow-up';

interface FollowUpSequenceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence?: FollowUpSequence | null;
}

interface LocalStep {
  id?: string;
  delay_value: number;
  delay_unit: DelayUnit;
  manual_content: string;
  ai_instruction: string;
  stop_if_replied: boolean;
}

export function FollowUpSequenceForm({ open, onOpenChange, sequence }: FollowUpSequenceFormProps) {
  const { createSequence, updateSequence, addStep, updateStep, deleteStep } = useFollowUpSequences();
  const { credits, isLoading: loadingCredits } = useAICredits();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('manual');
  const [aiModelType, setAiModelType] = useState<'standard' | 'advanced'>('standard');
  const [personaPrompt, setPersonaPrompt] = useState('');
  const [rulesContent, setRulesContent] = useState('');
  const [knowledgeBaseContent, setKnowledgeBaseContent] = useState('');
  const [steps, setSteps] = useState<LocalStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!sequence;

  // Check credits
  const hasStandardCredits = (credits?.standard_text || 0) > 0;
  const hasAdvancedCredits = (credits?.advanced_text || 0) > 0;
  const canUseAI = hasStandardCredits || hasAdvancedCredits;

  // Reset form when sequence changes
  useEffect(() => {
    if (sequence) {
      setName(sequence.name);
      setDescription(sequence.description || '');
      setFollowUpType(sequence.follow_up_type);
      setAiModelType(sequence.ai_model_type);
      setPersonaPrompt(sequence.persona_prompt || '');
      setRulesContent(sequence.rules_content || '');
      setKnowledgeBaseContent(sequence.knowledge_base_content || '');
      setSteps(
        sequence.steps?.map(s => ({
          id: s.id,
          delay_value: s.delay_value,
          delay_unit: s.delay_unit,
          manual_content: s.manual_content || '',
          ai_instruction: s.ai_instruction || '',
          stop_if_replied: s.stop_if_replied
        })) || []
      );
    } else {
      // Reset to defaults
      setName('');
      setDescription('');
      setFollowUpType('manual');
      setAiModelType('standard');
      setPersonaPrompt('');
      setRulesContent('');
      setKnowledgeBaseContent('');
      setSteps([]);
    }
  }, [sequence, open]);

  const addNewStep = () => {
    setSteps([
      ...steps,
      {
        delay_value: 1,
        delay_unit: 'hours' as DelayUnit,
        manual_content: '',
        ai_instruction: '',
        stop_if_replied: true
      }
    ]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateLocalStep = (index: number, field: keyof LocalStep, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (isEditing && sequence) {
        // Update sequence
        await updateSequence(sequence.id, {
          name,
          description: description || undefined,
          follow_up_type: followUpType,
          ai_model_type: aiModelType,
          persona_prompt: personaPrompt || undefined,
          rules_content: rulesContent || undefined,
          knowledge_base_content: knowledgeBaseContent || undefined
        });

        // Handle steps - delete removed, update existing, add new
        const existingStepIds = sequence.steps?.map(s => s.id) || [];
        const currentStepIds = steps.filter(s => s.id).map(s => s.id!);
        
        // Delete removed steps
        for (const stepId of existingStepIds) {
          if (!currentStepIds.includes(stepId)) {
            await deleteStep(stepId);
          }
        }

        // Update or add steps
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepData: CreateStepData = {
            step_order: i + 1,
            delay_value: step.delay_value,
            delay_unit: step.delay_unit,
            manual_content: followUpType === 'manual' ? step.manual_content : undefined,
            ai_instruction: followUpType !== 'manual' ? step.ai_instruction : undefined,
            stop_if_replied: step.stop_if_replied
          };

          if (step.id) {
            await updateStep(step.id, stepData);
          } else {
            await addStep(sequence.id, stepData);
          }
        }
      } else {
        // Create new sequence
        const newSequence = await createSequence({
          name,
          description: description || undefined,
          follow_up_type: followUpType,
          ai_model_type: aiModelType,
          persona_prompt: personaPrompt || undefined,
          rules_content: rulesContent || undefined,
          knowledge_base_content: knowledgeBaseContent || undefined
        });

        if (newSequence) {
          // Add steps
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            await addStep(newSequence.id, {
              step_order: i + 1,
              delay_value: step.delay_value,
              delay_unit: step.delay_unit,
              manual_content: followUpType === 'manual' ? step.manual_content : undefined,
              ai_instruction: followUpType !== 'manual' ? step.ai_instruction : undefined,
              stop_if_replied: step.stop_if_replied
            });
          }
        }
      }

      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Editar Sequência' : 'Nova Sequência de Follow-up'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Sequência *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Recuperação de Leads Inativos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o objetivo desta sequência..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Follow-up Type */}
            <div className="space-y-4">
              <Label>Tipo de Follow-up</Label>
              <RadioGroup value={followUpType} onValueChange={(v) => setFollowUpType(v as FollowUpType)}>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="manual" id="manual" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="manual" className="cursor-pointer font-medium">
                        Padrão (Manual)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Mensagens fixas, mesmo conteúdo para todos os contatos
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer ${!canUseAI ? 'opacity-50' : ''}`}>
                    <RadioGroupItem value="ai" id="ai" className="mt-1" disabled={!canUseAI} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="ai" className="cursor-pointer font-medium">
                          Com IA
                        </Label>
                        {!canUseAI && (
                          <Badge variant="outline" className="text-xs">
                            Requer créditos
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        IA analisa o contexto e gera mensagem personalizada
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer ${!canUseAI ? 'opacity-50' : ''}`}>
                    <RadioGroupItem value="advanced" id="advanced" className="mt-1" disabled={!canUseAI} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="advanced" className="cursor-pointer font-medium">
                          Avançado
                        </Label>
                        {!canUseAI && (
                          <Badge variant="outline" className="text-xs">
                            Requer créditos
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        IA + Persona + Regras + Base de Conhecimento
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* AI Model Selection (for AI types) */}
            {followUpType !== 'manual' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modelo de IA</Label>
                    <Select value={aiModelType} onValueChange={(v) => setAiModelType(v as 'standard' | 'advanced')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard" disabled={!hasStandardCredits}>
                          IA Padrão {!hasStandardCredits && '(sem créditos)'}
                        </SelectItem>
                        <SelectItem value="advanced" disabled={!hasAdvancedCredits}>
                          IA Avançada {!hasAdvancedCredits && '(sem créditos)'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Advanced Settings */}
            {followUpType === 'advanced' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Configurações Avançadas</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="persona">Persona</Label>
                    <Textarea
                      id="persona"
                      placeholder="Descreva a persona que a IA deve assumir..."
                      value={personaPrompt}
                      onChange={(e) => setPersonaPrompt(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rules">Regras</Label>
                    <Textarea
                      id="rules"
                      placeholder="Defina regras de comunicação..."
                      value={rulesContent}
                      onChange={(e) => setRulesContent(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="knowledge">Base de Conhecimento</Label>
                    <Textarea
                      id="knowledge"
                      placeholder="Informações que a IA deve usar..."
                      value={knowledgeBaseContent}
                      onChange={(e) => setKnowledgeBaseContent(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Steps */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Etapas da Sequência</Label>
                <Button variant="outline" size="sm" onClick={addNewStep}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {steps.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg">
                  <p>Nenhuma etapa adicionada</p>
                  <Button variant="link" size="sm" onClick={addNewStep}>
                    Adicionar primeira etapa
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div
                      key={index}
                      className="p-4 border border-border rounded-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <span className="text-sm font-medium">Etapa {index + 1}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Após</span>
                        <Input
                          type="number"
                          min={1}
                          className="w-20"
                          value={step.delay_value}
                          onChange={(e) => updateLocalStep(index, 'delay_value', parseInt(e.target.value) || 1)}
                        />
                        <Select
                          value={step.delay_unit}
                          onValueChange={(v) => updateLocalStep(index, 'delay_unit', v)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">minutos</SelectItem>
                            <SelectItem value="hours">horas</SelectItem>
                            <SelectItem value="days">dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {followUpType === 'manual' ? (
                        <Textarea
                          placeholder="Digite a mensagem do follow-up..."
                          value={step.manual_content}
                          onChange={(e) => updateLocalStep(index, 'manual_content', e.target.value)}
                          rows={2}
                        />
                      ) : (
                        <Textarea
                          placeholder="Instrução para a IA (ex: Reforce a urgência da oferta)"
                          value={step.ai_instruction}
                          onChange={(e) => updateLocalStep(index, 'ai_instruction', e.target.value)}
                          rows={2}
                        />
                      )}

                      <div className="flex items-center justify-between">
                        <Label htmlFor={`stop-${index}`} className="text-sm">
                          Parar se contato responder
                        </Label>
                        <Switch
                          id={`stop-${index}`}
                          checked={step.stop_if_replied}
                          onCheckedChange={(v) => updateLocalStep(index, 'stop_if_replied', v)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Sequência'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
