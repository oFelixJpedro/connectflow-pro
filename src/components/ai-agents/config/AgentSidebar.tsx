import { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Zap, 
  Volume2, 
  Link2, 
  Play,
  Pause,
  Plus,
  X,
  Info,
  Loader2,
  MessageSquare,
  Paperclip,
  Image,
  Video,
  Mic,
  FileText,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAIAgents } from '@/hooks/useAIAgents';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentMedia } from '@/hooks/useAgentMedia';
import { supabase } from '@/integrations/supabase/client';
import { AI_AGENT_VOICES, AI_AGENT_BATCH_OPTIONS, AI_AGENT_SPLIT_DELAY_OPTIONS } from '@/types/ai-agents';
import type { AIAgent, UpdateAIAgentData } from '@/types/ai-agents';
import type { AICredits } from '@/types/ai-credits';
import { toast } from 'sonner';
import { MediaUploadModal, TextLinkModal, MediaList } from '@/components/ai-agents/media';

interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

import type { DeactivateOnHumanMessage } from '@/types/ai-agents';

// Campos editáveis no sidebar que devem ser acumulados
export interface SidebarPendingChanges {
  name?: string;
  temperature?: number;
  require_activation_trigger?: boolean;
  activation_triggers?: string[];
  deactivate_on_human_message?: DeactivateOnHumanMessage;
  deactivate_temporary_minutes?: number;
  message_batch_seconds?: number;
  split_response_enabled?: boolean;
  split_message_delay_seconds?: number;
  audio_enabled?: boolean;
  audio_respond_with_audio?: boolean;
  voice_name?: string;
  language_code?: string;
  speech_speed?: number;
  audio_temperature?: number;
  ai_model_type?: 'standard' | 'advanced';
  audio_model_type?: 'standard' | 'advanced';
}

interface AgentSidebarProps {
  agent: AIAgent;
  totalChars: number;
  charLimit: number;
  onAgentUpdate: () => void;
  onPendingChanges?: (changes: SidebarPendingChanges, hasChanges: boolean) => void;
  pendingChanges?: SidebarPendingChanges;
  credits?: AICredits | null;
}

// Helper para formatar temperatura com descrição curta
const formatTemperature = (val: number, type: 'text' | 'audio') => {
  if (type === 'text') {
    if (val === 1.0) return `${val.toFixed(1)} Recomendado ⭐`;
    if (val <= 0.3) return `${val.toFixed(1)} Preciso`;
    if (val >= 1.5) return `${val.toFixed(1)} Muito Criativo`;
    if (val >= 0.8) return `${val.toFixed(1)} Criativo`;
  } else {
    if (val <= 0.3) return `${val.toFixed(1)} Neutro`;
    if (val >= 0.8) return `${val.toFixed(1)} Expressivo`;
  }
  return val.toFixed(1);
};

// Helper para formatar voz com descrição curta
const formatVoiceName = (voice: { name: string; description: string }) => {
  const desc = voice.description.toLowerCase();
  if (desc.includes('feminina')) return `${voice.name} (feminina)`;
  if (desc.includes('masculina')) return `${voice.name} (masculina)`;
  if (desc.includes('neutra') || desc.includes('neutro')) return `${voice.name} (neutra)`;
  return voice.name;
};

export function AgentSidebar({ 
  agent, 
  totalChars, 
  charLimit, 
  onAgentUpdate,
  onPendingChanges,
  pendingChanges = {},
  credits
}: AgentSidebarProps) {
  const { addConnection, removeConnection } = useAIAgents();
  const { profile } = useAuth();
  const { medias, isLoading: isLoadingMedias, loadMedias, uploadMedia, createTextOrLink, deleteMedia } = useAgentMedia(agent.id);
  
  const [basicOpen, setBasicOpen] = useState(true);
  const [triggersOpen, setTriggersOpen] = useState(true);
  const [responseOpen, setResponseOpen] = useState(true);
  const [audioOpen, setAudioOpen] = useState(true);
  const [connectionsOpen, setConnectionsOpen] = useState(true);
  const [mediasOpen, setMediasOpen] = useState(true);
  
  const [newTrigger, setNewTrigger] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Media upload modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadMediaType, setUploadMediaType] = useState<'image' | 'video' | 'audio' | 'document'>('image');
  const [textLinkModalOpen, setTextLinkModalOpen] = useState(false);
  const [textLinkType, setTextLinkType] = useState<'text' | 'link'>('text');

  // Load medias on mount
  useEffect(() => {
    if (agent.id) {
      loadMedias();
    }
  }, [agent.id, loadMedias]);

  // Connection selector state
  const [availableConnections, setAvailableConnections] = useState<WhatsAppConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [connectionPopoverOpen, setConnectionPopoverOpen] = useState(false);

  const charPercentage = Math.min(100, (totalChars / charLimit) * 100);
  const isOverLimit = totalChars > charLimit;

  // Valores atuais (pendingChanges tem prioridade sobre agent)
  const getValue = useCallback(<K extends keyof SidebarPendingChanges>(key: K): SidebarPendingChanges[K] | AIAgent[K] => {
    if (key in pendingChanges && pendingChanges[key] !== undefined) {
      return pendingChanges[key];
    }
    return agent[key as keyof AIAgent] as SidebarPendingChanges[K];
  }, [pendingChanges, agent]);

  // Load available connections when popover opens
  useEffect(() => {
    if (connectionPopoverOpen && profile?.company_id) {
      loadAvailableConnections();
    }
  }, [connectionPopoverOpen, profile?.company_id]);

  const loadAvailableConnections = async () => {
    if (!profile?.company_id) return;
    
    setIsLoadingConnections(true);
    try {
      // 1. Buscar conexões da empresa
      const { data: connections, error: connError } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status')
        .eq('company_id', profile.company_id)
        .eq('status', 'connected');

      if (connError) throw connError;

      // 2. Buscar TODAS as conexões já vinculadas a QUALQUER agente
      const { data: allLinked, error: linkedError } = await supabase
        .from('ai_agent_connections')
        .select('connection_id, agent_id');

      if (linkedError) throw linkedError;

      // 3. IDs das conexões vinculadas ao AGENTE ATUAL (para não esconder as que já tem)
      const currentAgentConnectionIds = agent.connections?.map(c => c.connection_id) || [];

      // 4. IDs das conexões vinculadas a OUTROS agentes
      const otherAgentsConnectionIds = (allLinked || [])
        .filter(link => link.agent_id !== agent.id)
        .map(link => link.connection_id);

      // 5. Filtrar: mostrar apenas conexões NÃO vinculadas a outros agentes
      //    E que também não estão vinculadas ao agente atual (essas já aparecem na lista de vinculadas)
      const available = (connections || []).filter(conn => 
        !otherAgentsConnectionIds.includes(conn.id) && 
        !currentAgentConnectionIds.includes(conn.id)
      );
      
      setAvailableConnections(available);
    } catch (err) {
      console.error('Erro ao carregar conexões:', err);
      toast.error('Erro ao carregar conexões disponíveis');
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const handleAddConnectionClick = async (connectionId: string) => {
    const success = await addConnection(agent.id, connectionId);
    if (success) {
      setConnectionPopoverOpen(false);
      onAgentUpdate();
    }
  };

  const handleRemoveConnection = async (connectionId: string) => {
    const success = await removeConnection(agent.id, connectionId);
    if (success) {
      onAgentUpdate();
    }
  };

  // Atualiza mudanças pendentes em vez de salvar diretamente
  const handleUpdateField = (field: keyof SidebarPendingChanges, value: unknown) => {
    if (onPendingChanges) {
      const newChanges = { ...pendingChanges, [field]: value };
      onPendingChanges(newChanges, true);
    }
  };

  const handleAddTrigger = () => {
    if (!newTrigger.trim()) return;
    
    const currentTriggers = (getValue('activation_triggers') as string[]) || [];
    const triggers = [...currentTriggers, newTrigger.trim()];
    handleUpdateField('activation_triggers', triggers);
    setNewTrigger('');
  };

  const handleRemoveTrigger = (index: number) => {
    const currentTriggers = (getValue('activation_triggers') as string[]) || [];
    const triggers = currentTriggers.filter((_, i) => i !== index);
    handleUpdateField('activation_triggers', triggers);
  };

  const handlePlayVoicePreview = async () => {
    // Stop current audio if playing
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setAudioElement(null);
      setIsPlayingPreview(false);
      return;
    }

    setIsPlayingPreview(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent-voice-preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            voiceName: getValue('voice_name') || agent.voice_name,
            speed: getValue('speech_speed') ?? agent.speech_speed ?? 1.0,
            languageCode: getValue('language_code') || agent.language_code || 'pt-BR',
            temperature: getValue('audio_temperature') ?? agent.audio_temperature ?? 0.7
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar preview');
      }

      const data = await response.json();

      let audioUrl: string;
      
      if (data.audioUrl) {
        audioUrl = data.audioUrl;
      } else if (data.audioBase64) {
        audioUrl = `data:${data.mimeType || 'audio/mp3'};base64,${data.audioBase64}`;
      } else {
        throw new Error('Nenhum áudio retornado');
      }

      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsPlayingPreview(false);
        setAudioElement(null);
      };

      audio.onerror = () => {
        toast.error('Erro ao reproduzir áudio');
        setIsPlayingPreview(false);
        setAudioElement(null);
      };

      setAudioElement(audio);
      await audio.play();

    } catch (error) {
      console.error('Erro no preview de voz:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar preview de voz');
      setIsPlayingPreview(false);
    }
  };

  // Valores calculados usando getValue
  const currentName = getValue('name') as string ?? agent.name;
  const currentTemperature = getValue('temperature') as number ?? agent.temperature ?? 1.0;
  const currentRequireTrigger = getValue('require_activation_trigger') as boolean ?? agent.require_activation_trigger;
  const currentTriggers = (getValue('activation_triggers') as string[]) ?? agent.activation_triggers ?? [];
  const currentDeactivateOnHuman = getValue('deactivate_on_human_message') as string ?? agent.deactivate_on_human_message;
  const currentDeactivateMinutes = getValue('deactivate_temporary_minutes') as number ?? agent.deactivate_temporary_minutes;
  const currentBatchSeconds = getValue('message_batch_seconds') as number ?? agent.message_batch_seconds ?? 75;
  const currentSplitEnabled = getValue('split_response_enabled') as boolean ?? agent.split_response_enabled ?? true;
  const currentSplitDelay = getValue('split_message_delay_seconds') as number ?? agent.split_message_delay_seconds ?? 2.0;
  const currentAudioEnabled = getValue('audio_enabled') as boolean ?? agent.audio_enabled;
  const currentAudioRespond = getValue('audio_respond_with_audio') as boolean ?? agent.audio_respond_with_audio;
  const currentVoiceName = getValue('voice_name') as string ?? agent.voice_name;
  const currentLanguageCode = getValue('language_code') as string ?? agent.language_code ?? 'pt-BR';
  const currentSpeechSpeed = getValue('speech_speed') as number ?? agent.speech_speed ?? 1.0;
  const currentAudioTemp = getValue('audio_temperature') as number ?? agent.audio_temperature ?? 0.7;

  return (
    <div className="w-[40%] border-l bg-muted/30 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Caracteres */}
          <div className="bg-background rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Caracteres</span>
              <span className={`text-xs font-medium ${isOverLimit ? 'text-destructive' : ''}`}>
                {totalChars.toLocaleString()} / {charLimit.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={charPercentage} 
              className={`h-1.5 ${isOverLimit ? '[&>div]:bg-destructive' : ''}`}
            />
          </div>

          <Separator className="opacity-50" />

          {/* Básico */}
          <Collapsible open={basicOpen} onOpenChange={setBasicOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Básico</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={currentName}
                  onChange={(e) => handleUpdateField('name', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Criatividade</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">
                        Padrão Google para Gemini: 1.0. Valores mais baixos = respostas precisas. Valores mais altos = respostas criativas.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select 
                  value={String(currentTemperature)} 
                  onValueChange={(v) => handleUpdateField('temperature', Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0].map((val) => (
                      <SelectItem key={val} value={String(val)}>
                        {formatTemperature(val, 'text')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model selector - only show if credits available */}
              {credits && (credits.standard_text > 0 || credits.advanced_text > 0) && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Modelo de IA</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-3 h-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-[200px]">
                          Padrão: Custo menor, ideal para a maioria dos casos. Avançada: Melhor qualidade para atendimentos complexos.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={(getValue('ai_model_type') as string) ?? agent.ai_model_type ?? 'standard'} 
                    onValueChange={(v) => handleUpdateField('ai_model_type', v as 'standard' | 'advanced')}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {credits.standard_text > 0 && (
                        <SelectItem value="standard">IA Padrão (R$10/1M)</SelectItem>
                      )}
                      {credits.advanced_text > 0 && (
                        <SelectItem value="advanced">IA Avançada (R$30/1M)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="opacity-50" />

          {/* Gatilhos */}
          <Collapsible open={triggersOpen} onOpenChange={setTriggersOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">Gatilhos</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Exigir gatilho</Label>
                <Switch
                  checked={currentRequireTrigger}
                  onCheckedChange={(v) => handleUpdateField('require_activation_trigger', v)}
                />
              </div>

              {currentRequireTrigger && (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={newTrigger}
                      onChange={(e) => setNewTrigger(e.target.value)}
                      placeholder="Novo gatilho..."
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTrigger()}
                    />
                    <Button size="sm" onClick={handleAddTrigger} className="h-8">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {currentTriggers.map((trigger, index) => (
                      <Badge key={index} variant="secondary" className="text-xs pr-1">
                        {trigger}
                        <button
                          onClick={() => handleRemoveTrigger(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Pausa ao intervir</Label>
                <Select 
                  value={currentDeactivateOnHuman} 
                  onValueChange={(v) => handleUpdateField('deactivate_on_human_message', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Nunca</SelectItem>
                    <SelectItem value="always">Sempre</SelectItem>
                    <SelectItem value="temporary">Temporário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentDeactivateOnHuman === 'temporary' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Duração (min)</Label>
                  <Input
                    type="number"
                    value={currentDeactivateMinutes}
                    onChange={(e) => handleUpdateField('deactivate_temporary_minutes', Number(e.target.value))}
                    className="h-8 text-sm"
                    min={1}
                    max={60}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="opacity-50" />

          {/* Resposta (Batching & Humanização) */}
          <Collapsible open={responseOpen} onOpenChange={setResponseOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-medium">Resposta</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Agrupamento</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">
                        Tempo para aguardar mais mensagens do cliente antes de gerar a resposta.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select 
                  value={String(currentBatchSeconds)} 
                  onValueChange={(v) => handleUpdateField('message_batch_seconds', Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_AGENT_BATCH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Quebrar resposta</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">
                        Dividir resposta em várias mensagens para parecer mais humano.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={currentSplitEnabled}
                  onCheckedChange={(v) => handleUpdateField('split_response_enabled', v)}
                />
              </div>

              {currentSplitEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Delay entre msgs</Label>
                  <Select 
                    value={String(currentSplitDelay)} 
                    onValueChange={(v) => handleUpdateField('split_message_delay_seconds', Number(v))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_AGENT_SPLIT_DELAY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="opacity-50" />
          <Collapsible open={audioOpen} onOpenChange={setAudioOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-medium">Áudio</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Gerar áudio</Label>
                <Switch
                  checked={currentAudioEnabled}
                  onCheckedChange={(v) => handleUpdateField('audio_enabled', v)}
                />
              </div>

              {currentAudioEnabled && (
                <>
                  {/* Audio model selector - only show if audio credits available */}
                  {credits && (credits.standard_audio > 0 || credits.advanced_audio > 0) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Modelo de Áudio</Label>
                      <Select 
                        value={(getValue('audio_model_type') as string) ?? agent.audio_model_type ?? 'standard'} 
                        onValueChange={(v) => handleUpdateField('audio_model_type', v as 'standard' | 'advanced')}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {credits.standard_audio > 0 && (
                            <SelectItem value="standard">Áudio Padrão (R$60/1M)</SelectItem>
                          )}
                          {credits.advanced_audio > 0 && (
                            <SelectItem value="advanced">Áudio Avançado (R$120/1M)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Audio switch */}
                  <div className="flex items-center justify-between py-1">
                    <Label className="text-xs text-muted-foreground">Áudio → Áudio</Label>
                    <Switch
                      checked={currentAudioRespond}
                      onCheckedChange={(v) => handleUpdateField('audio_respond_with_audio', v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Voz</Label>
                    <Select 
                      value={currentVoiceName} 
                      onValueChange={(v) => handleUpdateField('voice_name', v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_AGENT_VOICES.map((voice) => (
                          <SelectItem key={voice.name} value={voice.name}>
                            {formatVoiceName(voice)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Idioma</Label>
                    <Select 
                      value={currentLanguageCode} 
                      onValueChange={(v) => handleUpdateField('language_code', v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">🇧🇷 Português</SelectItem>
                        <SelectItem value="en-US">🇺🇸 English</SelectItem>
                        <SelectItem value="es-ES">🇪🇸 Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preview button inline */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handlePlayVoicePreview}
                    disabled={isPlayingPreview && !audioElement}
                  >
                    {isPlayingPreview ? (
                      audioElement ? (
                        <>
                          <Pause className="w-3 h-3 mr-1" />
                          Parar
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Gerando...
                        </>
                      )
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Ouvir prévia
                      </>
                    )}
                  </Button>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Velocidade</Label>
                    <Select 
                      value={String(currentSpeechSpeed)} 
                      onValueChange={(v) => handleUpdateField('speech_speed', Number(v))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.7">Lenta</SelectItem>
                        <SelectItem value="1">Normal</SelectItem>
                        <SelectItem value="1.2">Rápida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Expressividade</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[180px]">
                            Baixo = voz consistente. Alto = voz expressiva.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select 
                      value={String(currentAudioTemp)} 
                      onValueChange={(v) => handleUpdateField('audio_temperature', Number(v))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((val) => (
                          <SelectItem key={val} value={String(val)}>
                            {formatTemperature(val, 'audio')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="opacity-50" />

          {/* Conexões */}
          <Collapsible open={connectionsOpen} onOpenChange={setConnectionsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                <span className="text-sm font-medium">Conexões</span>
                {agent.connections && agent.connections.length > 0 && (
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {agent.connections.length}
                  </Badge>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {agent.connections && agent.connections.length > 0 ? (
                <div className="space-y-1.5">
                  {agent.connections.map((conn) => (
                    <div 
                      key={conn.id} 
                      className="flex items-center justify-between p-2 bg-background rounded-lg text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{conn.connection?.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {conn.connection?.phone_number}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveConnection(conn.connection_id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhuma conexão
                </p>
              )}
              
              <Popover open={connectionPopoverOpen} onOpenChange={setConnectionPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Conexão
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-1">
                    {isLoadingConnections ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : availableConnections.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        Nenhuma disponível
                      </p>
                    ) : (
                      availableConnections.map((conn) => (
                        <button
                          key={conn.id}
                          onClick={() => handleAddConnectionClick(conn.id)}
                          className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left transition-colors"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{conn.name}</p>
                            <p className="text-[10px] text-muted-foreground">{conn.phone_number}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="opacity-50" />

          {/* Mídias */}
          <Collapsible open={mediasOpen} onOpenChange={setMediasOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                <span className="text-sm font-medium">Mídias</span>
                {medias.length > 0 && (
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {medias.length}
                  </Badge>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Mídia
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => { setUploadMediaType('image'); setUploadModalOpen(true); }}>
                    <Image className="w-4 h-4 mr-2 text-blue-500" />
                    Imagem
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setUploadMediaType('video'); setUploadModalOpen(true); }}>
                    <Video className="w-4 h-4 mr-2 text-purple-500" />
                    Vídeo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setUploadMediaType('audio'); setUploadModalOpen(true); }}>
                    <Mic className="w-4 h-4 mr-2 text-green-500" />
                    Áudio
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setUploadMediaType('document'); setUploadModalOpen(true); }}>
                    <FileText className="w-4 h-4 mr-2 text-orange-500" />
                    Documento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setTextLinkType('text'); setTextLinkModalOpen(true); }}>
                    <Type className="w-4 h-4 mr-2 text-gray-500" />
                    Texto Fixo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setTextLinkType('link'); setTextLinkModalOpen(true); }}>
                    <Link2 className="w-4 h-4 mr-2 text-cyan-500" />
                    Link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <MediaList 
                medias={medias} 
                onDelete={deleteMedia}
                isLoading={isLoadingMedias}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Media Upload Modal */}
      <MediaUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        mediaType={uploadMediaType}
        onUpload={async (key, file) => {
          const result = await uploadMedia(uploadMediaType, key, file);
          return !!result;
        }}
      />

      {/* Text/Link Modal */}
      <TextLinkModal
        open={textLinkModalOpen}
        onOpenChange={setTextLinkModalOpen}
        contentType={textLinkType}
        onCreate={async (key, content) => {
          const result = await createTextOrLink(textLinkType, key, content);
          return !!result;
        }}
      />
    </div>
  );
}
