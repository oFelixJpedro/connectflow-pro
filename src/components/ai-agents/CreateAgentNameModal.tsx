import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAIAgents } from '@/hooks/useAIAgents';
import type { AIAgentType } from '@/types/ai-agents';

interface CreateAgentNameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentType: AIAgentType | null;
  onAgentCreated: (agentId: string) => void;
}

export function CreateAgentNameModal({
  open,
  onOpenChange,
  agentType,
  onAgentCreated,
}: CreateAgentNameModalProps) {
  const { createAgent } = useAIAgents();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !agentType) return;

    setIsCreating(true);
    try {
      const agent = await createAgent({
        name: name.trim(),
        agent_type: agentType,
        is_primary: true,
      });

      if (agent) {
        setName('');
        onAgentCreated(agent.id);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Criar Novo Agente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Nome do Agente *</Label>
            <Input
              id="agent-name"
              placeholder="Ex: Atendimento, Suporte, Vendas..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleCreate();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleClose}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
          >
            {isCreating ? 'Criando...' : 'Criar Agente'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
