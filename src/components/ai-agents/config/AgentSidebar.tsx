import { useState, useEffect } from 'react';
import { 
  Settings, 
  Zap, 
  Volume2, 
  Link2, 
  Clock,
  Play,
  Pause,
  Plus,
  X,
  Info,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useAIAgents } from '@/hooks/useAIAgents';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AI_AGENT_VOICES, AI_AGENT_DELAY_OPTIONS } from '@/types/ai-agents';
import type { AIAgent } from '@/types/ai-agents';
import { toast } from 'sonner';

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

export function AgentSidebar({ agent, totalChars, charLimit, onAgentUpdate }: AgentSidebarProps) {
  const { updateAgent, addConnection, removeConnection } = useAIAgents();
  const { profile } = useAuth();
  
  const [basicOpen, setBasicOpen] = useState(true);
  const [triggersOpen, setTriggersOpen] = useState(true);
  const [audioOpen, setAudioOpen] = useState(true);
  const [connectionsOpen, setConnectionsOpen] = useState(true);
  
  const [newTrigger, setNewTrigger] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
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
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status')
        .eq('company_id', profile.company_id)
        .eq('status', 'connected');

      if (error) throw error;

      // Filter out connections already linked to this agent
      const linkedConnectionIds = agent.connections?.map(c => c.connection_id) || [];
      const available = (data || []).filter(conn => !linkedConnectionIds.includes(conn.id));
      
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
          body: JSON.stringify({ voiceName: agent.voice_name }),
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
    <div className="w-80 border-l bg-muted/30 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Total de Caracteres */}
          <div className="bg-background rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total de Caracteres</span>
              <span className={`text-sm ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {totalChars.toLocaleString()} / {charLimit.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={charPercentage} 
              className={isOverLimit ? '[&>div]:bg-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              {Math.round(charPercentage)}% do limite recomendado
            </p>
          </div>

          {/* Configurações Básicas */}
          <Collapsible open={basicOpen} onOpenChange={setBasicOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Configurações Básicas</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do Agente</Label>
                <Input
                  value={agent.name}
                  onChange={(e) => handleUpdateField('name', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <Label className="text-xs">Delay (segundos)</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">
                        Tempo de espera antes de enviar resposta. 
                        Recomendado: 20 segundos para parecer mais natural.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select 
                  value={String(agent.delay_seconds)} 
                  onValueChange={(v) => handleUpdateField('delay_seconds', Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_AGENT_DELAY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Gatilhos de Ativação */}
          <Collapsible open={triggersOpen} onOpenChange={setTriggersOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">Gatilhos de Ativação</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Exigir gatilho para ativar</Label>
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
                      placeholder="Digite um gatilho..."
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
                <Label className="text-xs">Desativar quando humano enviar mensagem</Label>
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
                    <SelectItem value="temporary">Temporariamente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {agent.deactivate_on_human_message === 'temporary' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Tempo de desativação (minutos)</Label>
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

          {/* Configurações de Áudio */}
          <Collapsible open={audioOpen} onOpenChange={setAudioOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-medium">Configurações de Áudio</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Gerar Áudio com Agente</Label>
                <Switch
                  checked={agent.audio_enabled}
                  onCheckedChange={(v) => handleUpdateField('audio_enabled', v)}
                />
              </div>

              {agent.audio_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 border rounded-lg space-y-1">
                      <Label className="text-xs">Responder Áudio com Áudio</Label>
                      <Switch
                        checked={agent.audio_respond_with_audio}
                        onCheckedChange={(v) => handleUpdateField('audio_respond_with_audio', v)}
                      />
                    </div>
                    <div className="p-2 border rounded-lg space-y-1">
                      <Label className="text-xs">Sempre Responder com Áudio</Label>
                      <Switch
                        checked={agent.audio_always_respond_audio}
                        onCheckedChange={(v) => handleUpdateField('audio_always_respond_audio', v)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Voz do Agente</Label>
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
                            {voice.name} - {voice.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Prévia da Voz</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
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
                            Ouvir
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Velocidade de Fala</Label>
                      <span className="text-xs text-muted-foreground">{agent.speech_speed}x</span>
                    </div>
                    <Slider
                      value={[agent.speech_speed]}
                      onValueChange={([v]) => handleUpdateField('speech_speed', v)}
                      min={0.5}
                      max={2}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Devagar</span>
                      <span>Normal</span>
                      <span>Rápido</span>
                    </div>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Conexões Vinculadas */}
          <Collapsible open={connectionsOpen} onOpenChange={setConnectionsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                <span className="text-sm font-medium">Conexões Vinculadas</span>
                {agent.connections && agent.connections.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {agent.connections.length}
                  </Badge>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {agent.connections && agent.connections.length > 0 ? (
                <div className="space-y-2">
                  {agent.connections.map((conn) => (
                    <div 
                      key={conn.id} 
                      className="flex items-center justify-between p-2 bg-background rounded-lg text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{conn.connection?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {conn.connection?.phone_number}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemoveConnection(conn.connection_id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhuma conexão vinculada
                </p>
              )}
              
              <Popover open={connectionPopoverOpen} onOpenChange={setConnectionPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Conexão
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium px-2 py-1">Selecione uma conexão</p>
                    {isLoadingConnections ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : availableConnections.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhuma conexão disponível
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {availableConnections.map((conn) => (
                          <button
                            key={conn.id}
                            onClick={() => handleAddConnectionClick(conn.id)}
                            className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left transition-colors"
                          >
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{conn.name}</p>
                              <p className="text-xs text-muted-foreground">{conn.phone_number}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
