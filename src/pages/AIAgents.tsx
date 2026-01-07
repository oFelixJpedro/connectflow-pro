import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bot, Plus, BookTemplate, RotateCcw, Search, CreditCard, Bell, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AgentGridCard } from '@/components/ai-agents/AgentGridCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAIAgents } from '@/hooks/useAIAgents';
import { useAICredits } from '@/hooks/useAICredits';
import { useAuth } from '@/contexts/AuthContext';
import { CreateAgentTypeModal } from '@/components/ai-agents/CreateAgentTypeModal';
import { CreateAgentNameModal } from '@/components/ai-agents/CreateAgentNameModal';
import { AgentTemplatesModal } from '@/components/ai-agents/AgentTemplatesModal';
import { AICreditsTab } from '@/components/ai-credits';
import { FollowUpTab } from '@/components/follow-up';
import { NotificationsTab } from '@/components/notifications';
import { CalendarTab } from '@/components/calendar';
import { toast } from 'sonner';
import type { AIAgentType, AIAgent } from '@/types/ai-agents';

type SubMenuTab = 'agents' | 'notifications' | 'followup' | 'credits' | 'calendar';

export default function AIAgents() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, userRole } = useAuth();
  const { primaryAgents, secondaryAgents, isLoading, setAgentStatus, deleteAgent } = useAIAgents();
  const { credits, isLoading: isLoadingCredits } = useAICredits();
  
  const [activeTab, setActiveTab] = useState<SubMenuTab>('agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedAgentType, setSelectedAgentType] = useState<AIAgentType | null>(null);
  const [primaryExpanded, setPrimaryExpanded] = useState(true);
  const [secondaryExpanded, setSecondaryExpanded] = useState(true);
  const [agentToDelete, setAgentToDelete] = useState<AIAgent | null>(null);
  
  // Check if user has text credits available - during loading, assume no credits (safer)
  const hasTextCredits = !isLoadingCredits && credits && (credits.standard_text > 0 || credits.advanced_text > 0);
  const canCreateAgents = hasTextCredits;
  const canActivateAgents = hasTextCredits;

  // Handle credit purchase success/cancel from URL params
  useEffect(() => {
    const creditsParam = searchParams.get('credits');
    if (creditsParam === 'success') {
      toast.success('Recarga de créditos realizada com sucesso!');
      setActiveTab('credits');
      // Clear URL params
      navigate('/ai-agents', { replace: true });
    } else if (creditsParam === 'cancelled') {
      toast.info('Compra de créditos cancelada');
      setActiveTab('credits');
      navigate('/ai-agents', { replace: true });
    }
  }, [searchParams, navigate]);

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
    
    // If trying to ACTIVATE (agent is currently inactive), verify credits first
    if (agent.status !== 'active' && !canActivateAgents) {
      toast.error('Adquira créditos de IA para ativar agentes');
      return;
    }
    
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    await setAgentStatus(agent.id, newStatus);
  };

  const handleDeleteClick = (agent: AIAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    setAgentToDelete(agent);
  };

  const handleConfirmDelete = async () => {
    if (agentToDelete) {
      await deleteAgent(agentToDelete.id);
      setAgentToDelete(null);
    }
  };

  // Filtrar agentes pela busca
  const filteredPrimary = primaryAgents.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredSecondary = secondaryAgents.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );


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
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
            activeTab === 'notifications' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Bell className="w-5 h-5" />
          <span className="font-medium">Notificações</span>
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
        
        <button
          onClick={() => setActiveTab('credits')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
            activeTab === 'credits' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="font-medium">Créditos de IA</span>
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
                disabled={!canCreateAgents}
              >
                <BookTemplate className="w-4 h-4 mr-2" />
                Modelos
              </Button>
              {canCreateAgents ? (
                <Button onClick={() => setShowTypeModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Agente
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button disabled className="opacity-50 cursor-not-allowed">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Agente
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Adquira créditos de IA para criar agentes</p>
                  </TooltipContent>
                </Tooltip>
              )}
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
                <CollapsibleContent className="mt-4">
                  {filteredPrimary.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      <Card className="border-dashed min-h-[180px] flex items-center justify-center">
                        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                          <Bot className="w-10 h-10 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Nenhum agente principal criado.<br />
                            Clique em "Novo Agente" para começar.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredPrimary.map((agent) => (
                        <AgentGridCard
                          key={agent.id}
                          agent={agent}
                          onNavigate={(id) => navigate(`/ai-agents/${id}`)}
                          onToggleStatus={handleToggleStatus}
                          onDelete={handleDeleteClick}
                          canActivate={canActivateAgents}
                        />
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Agentes Secundários */}
              <Collapsible open={secondaryExpanded} onOpenChange={setSecondaryExpanded}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                  <span>Agentes Secundários / Sub-agentes ({filteredSecondary.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  {filteredSecondary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sub-agentes são criados dentro de um agente do tipo "Multiagente".
                      Acesse a configuração de um agente multiagente para adicionar sub-agentes.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredSecondary.map((agent) => {
                        const parentAgent = primaryAgents.find(p => p.id === agent.parent_agent_id);
                        return (
                          <AgentGridCard
                            key={agent.id}
                            agent={agent}
                            onNavigate={(id) => navigate(`/ai-agents/${id}`)}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDeleteClick}
                            parentAgentName={parentAgent?.name}
                            canActivate={canActivateAgents}
                          />
                        );
                      })}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : activeTab === 'notifications' ? (
            <NotificationsTab />
          ) : activeTab === 'followup' ? (
            <FollowUpTab />
          ) : (
            <AICreditsTab />
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

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={!!agentToDelete} onOpenChange={() => setAgentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agente "{agentToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
