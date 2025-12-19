import { useState, useEffect } from 'react';
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
import type { AIAgent } from '@/types/ai-agents';
import { toast } from 'sonner';
import { MediaUploadModal, TextLinkModal, MediaList } from '@/components/ai-agents/media';

interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

interface AgentSidebarProps {
  agent: AIAgent;
  totalChars: number;
  charLimit: number;
  onAgentUpdate: () => void;
}

// Helper para formatar temperatura com descrição curta
const formatTemperature = (val: number, type: 'text' | 'audio') => {
  if (type === 'text') {
    if (val <= 0.3) return `${val.toFixed(1)} Preciso`;
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

export function AgentSidebar({ agent, totalChars, charLimit, onAgentUpdate }: AgentSidebarProps) {
  const { updateAgent, addConnection, removeConnection } = useAIAgents();
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

  const handleUpdateField = async (field: string, value: unknown) => {
    await updateAgent(agent.id, { [field]: value });
    onAgentUpdate();
  };

  const handleAddTrigger = async () => {
    if (!newTrigger.trim()) return;
    
    const currentTriggers = agent.activation_triggers || [];
    const triggers = [...currentTriggers, newTrigger.trim()];
    await updateAgent(agent.id, { activation_triggers: triggers });
    setNewTrigger('');
    onAgentUpdate();
  };

  const handleRemoveTrigger = async (index: number) => {
    const triggers = (agent.activation_triggers || []).filter((_, i) => i !== index);
    await updateAgent(agent.id, { activation_triggers: triggers });
    onAgentUpdate();
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
            voiceName: agent.voice_name,
            speed: agent.speech_speed || 1.0,
            languageCode: agent.language_code || 'pt-BR',
            temperature: agent.audio_temperature ?? 0.7
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
                  value={agent.name}
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
                      <p className="text-xs max-w-[180px]">
                        Baixo = respostas precisas. Alto = respostas criativas.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select 
                  value={String(agent.temperature ?? 0.7)} 
                  onValueChange={(v) => handleUpdateField('temperature', Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((val) => (
                      <SelectItem key={val} value={String(val)}>
                        {formatTemperature(val, 'text')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  checked={agent.require_activation_trigger}
                  onCheckedChange={(v) => handleUpdateField('require_activation_trigger', v)}
                />
              </div>

              {agent.require_activation_trigger && (
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
                    {agent.activation_triggers?.map((trigger, index) => (
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
                  value={agent.deactivate_on_human_message} 
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

              {agent.deactivate_on_human_message === 'temporary' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Duração (min)</Label>
                  <Input
                    type="number"
                    value={agent.deactivate_temporary_minutes}
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
                  value={String(agent.message_batch_seconds ?? 75)} 
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
                  checked={agent.split_response_enabled ?? true}
                  onCheckedChange={(v) => handleUpdateField('split_response_enabled', v)}
                />
              </div>

              {(agent.split_response_enabled ?? true) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Delay entre msgs</Label>
                  <Select 
                    value={String(agent.split_message_delay_seconds ?? 2.0)} 
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
                  checked={agent.audio_enabled}
                  onCheckedChange={(v) => handleUpdateField('audio_enabled', v)}
                />
              </div>

              {agent.audio_enabled && (
                <>
                  {/* Audio switches em lista vertical compacta */}
                  <div className="space-y-2 py-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Áudio → Áudio</Label>
                      <Switch
                        checked={agent.audio_respond_with_audio}
                        onCheckedChange={(v) => handleUpdateField('audio_respond_with_audio', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Sempre áudio</Label>
                      <Switch
                        checked={agent.audio_always_respond_audio}
                        onCheckedChange={(v) => handleUpdateField('audio_always_respond_audio', v)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Voz</Label>
                    <Select 
                      value={agent.voice_name} 
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
                      value={agent.language_code || 'pt-BR'} 
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
                      value={String(agent.speech_speed ?? 1.0)} 
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
                      value={String(agent.audio_temperature ?? 0.7)} 
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
