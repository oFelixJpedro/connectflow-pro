import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useAIAgents } from '@/hooks/useAIAgents';
import { SubAgentCard } from '../SubAgentCard';
import { CreateSubAgentModal } from '../CreateSubAgentModal';
import type { AIAgent } from '@/types/ai-agents';

interface AgentSubAgentsTabProps {
  agent: AIAgent;
  onUpdate: () => void;
}

export function AgentSubAgentsTab({ agent, onUpdate }: AgentSubAgentsTabProps) {
  const navigate = useNavigate();
  const { agents, setAgentStatus, deleteAgent } = useAIAgents();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AIAgent | null>(null);

  // Filtrar sub-agentes deste agente pai
  const subAgents = agents.filter(a => a.parent_agent_id === agent.id);

  const handleToggleStatus = async (subAgent: AIAgent) => {
    const newStatus = subAgent.status === 'active' ? 'inactive' : 'active';
    await setAgentStatus(subAgent.id, newStatus);
    onUpdate();
  };

  const handleDeleteConfirm = async () => {
    if (agentToDelete) {
      await deleteAgent(agentToDelete.id);
      setAgentToDelete(null);
      onUpdate();
    }
  };

  const handleSubAgentCreated = (agentId: string) => {
    onUpdate();
    // Opcionalmente navegar para o sub-agente criado
    // navigate(`/ai-agents/${agentId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Sub-agentes
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os sub-agentes que compõem este sistema multiagente.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Sub-agente
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Como funcionam os sub-agentes?</p>
            <p className="text-blue-700 dark:text-blue-300">
              Em um sistema multiagente, o agente principal gerencia a conversa e pode 
              transferir o atendimento para sub-agentes especializados conforme o contexto.
              Cada sub-agente pode ter suas próprias regras, roteiro e configurações.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Sub-agentes */}
      {subAgents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <h4 className="font-medium mb-2">Nenhum sub-agente</h4>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Adicione sub-agentes para criar um sistema de atendimento especializado.
              Cada sub-agente pode lidar com um tipo específico de interação.
            </p>
            <Button variant="outline" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar primeiro sub-agente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subAgents.map((subAgent) => (
            <SubAgentCard
              key={subAgent.id}
              agent={subAgent}
              onNavigate={(id) => navigate(`/ai-agents/${id}`)}
              onToggleStatus={handleToggleStatus}
              onDelete={setAgentToDelete}
            />
          ))}
        </div>
      )}

      {/* Modal de criação */}
      <CreateSubAgentModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        parentAgentId={agent.id}
        parentAgentName={agent.name}
        onSubAgentCreated={handleSubAgentCreated}
      />

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={!!agentToDelete} onOpenChange={() => setAgentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sub-agente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o sub-agente "{agentToDelete?.name}"? 
              Esta ação não pode ser desfeita e todas as configurações serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
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
