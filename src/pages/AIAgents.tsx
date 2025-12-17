import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, BookTemplate, Bell, RotateCcw, Search, Power, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAIAgents } from '@/hooks/useAIAgents';
import { useAuth } from '@/contexts/AuthContext';
import { CreateAgentTypeModal } from '@/components/ai-agents/CreateAgentTypeModal';
import { CreateAgentNameModal } from '@/components/ai-agents/CreateAgentNameModal';
import { AgentTemplatesModal } from '@/components/ai-agents/AgentTemplatesModal';
import type { AIAgentType, AIAgent } from '@/types/ai-agents';

type SubMenuTab = 'agents' | 'followup';

export default function AIAgents() {
  const navigate = useNavigate();
  const { profile, userRole } = useAuth();
  const { primaryAgents, secondaryAgents, isLoading, setAgentStatus } = useAIAgents();
  
  const [activeTab, setActiveTab] = useState<SubMenuTab>('agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedAgentType, setSelectedAgentType] = useState<AIAgentType | null>(null);
  const [primaryExpanded, setPrimaryExpanded] = useState(true);
  const [secondaryExpanded, setSecondaryExpanded] = useState(true);

  // Verificar permissão (owner/admin)
  const canManage = userRole?.role === 'owner' || userRole?.role === 'admin';

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Bot className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center">
          Apenas proprietários e administradores podem acessar os Agentes de IA.
        </p>
      </div>
    );
  }

  const handleTypeSelected = (type: AIAgentType) => {
    setSelectedAgentType(type);
    setShowTypeModal(false);
    setShowNameModal(true);
  };

  const handleAgentCreated = (agentId: string) => {
    setShowNameModal(false);
    setSelectedAgentType(null);
    navigate(`/ai-agents/${agentId}`);
  };

  const handleToggleStatus = async (agent: AIAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    await setAgentStatus(agent.id, newStatus);
  };

  // Filtrar agentes pela busca
  const filteredPrimary = primaryAgents.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredSecondary = secondaryAgents.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Ativo</Badge>;
      case 'paused':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Pausado</Badge>;
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar de submenu */}
      <div className="w-64 border-r bg-[#0F1729] p-4 flex flex-col gap-2">
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
            activeTab === 'agents' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Bot className="w-5 h-5" />
          <span className="font-medium">Agentes de Atendimento</span>
        </button>
        
        <button
          onClick={() => setActiveTab('followup')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
            activeTab === 'followup' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <RotateCcw className="w-5 h-5" />
          <span className="font-medium">Follow-up</span>
        </button>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Agentes</h1>
              <p className="text-muted-foreground">Gerenciamento de agentes de IA</p>
            </div>
          </div>

          {activeTab === 'agents' && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar agentes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowTemplatesModal(true)}
              >
                <BookTemplate className="w-4 h-4 mr-2" />
                Modelos
              </Button>
              <Button onClick={() => setShowTypeModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Agente
              </Button>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <ScrollArea className="flex-1 p-6">
          {activeTab === 'agents' ? (
            <div className="space-y-6">
              {/* Agentes Principais */}
              <Collapsible open={primaryExpanded} onOpenChange={setPrimaryExpanded}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                  <span>Agentes Principais ({filteredPrimary.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  {filteredPrimary.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <Bot className="w-12 h-12 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground text-center">
                          Nenhum agente principal criado.<br />
                          Clique em "Novo Agente" para começar.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredPrimary.map((agent) => (
                      <Card 
                        key={agent.id} 
                        className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => navigate(`/ai-agents/${agent.id}`)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{agent.name}</CardTitle>
                                {agent.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                    {agent.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getStatusBadge(agent.status)}
                              <Switch
                                checked={agent.status === 'active'}
                                onClick={(e) => handleToggleStatus(agent, e)}
                              />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {agent.connections && agent.connections.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase">
                                Conexões Vinculadas ({agent.connections.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {agent.connections.slice(0, 3).map((conn) => (
                                  <Badge key={conn.id} variant="outline" className="text-xs">
                                    {conn.connection?.name || 'Conexão'} • {conn.connection?.phone_number}
                                  </Badge>
                                ))}
                                {agent.connections.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{agent.connections.length - 3} mais
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Agentes Secundários */}
              <Collapsible open={secondaryExpanded} onOpenChange={setSecondaryExpanded}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                  <span>Agentes Secundários ({filteredSecondary.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  {filteredSecondary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Agentes secundários são criados dentro de um sistema de multiagentes.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredSecondary.map((agent) => (
                        <Card 
                          key={agent.id}
                          className="cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate(`/ai-agents/${agent.id}`)}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2">
                              <Bot className="w-5 h-5 text-secondary-foreground" />
                            </div>
                            <p className="font-medium text-sm line-clamp-1">{agent.name}</p>
                            {getStatusBadge(agent.status)}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <RotateCcw className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Follow-up Automático</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Em breve você poderá configurar sequências automáticas de follow-up 
                para manter contato com seus clientes.
              </p>
              <Badge variant="outline" className="mt-4">Em desenvolvimento</Badge>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Modais */}
      <CreateAgentTypeModal
        open={showTypeModal}
        onOpenChange={setShowTypeModal}
        onTypeSelected={handleTypeSelected}
      />

      <CreateAgentNameModal
        open={showNameModal}
        onOpenChange={setShowNameModal}
        agentType={selectedAgentType}
        onAgentCreated={handleAgentCreated}
      />

      <AgentTemplatesModal
        open={showTemplatesModal}
        onOpenChange={setShowTemplatesModal}
        onTemplateSelected={(templateId) => {
          setShowTemplatesModal(false);
          // TODO: implementar criação a partir de template
        }}
      />
    </div>
  );
}
