import { useState } from 'react';
import { Bot, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAIAgents } from '@/hooks/useAIAgents';

interface CreateSubAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentAgentId: string;
  parentAgentName: string;
  onSubAgentCreated: (agentId: string) => void;
}

export function CreateSubAgentModal({
  open,
  onOpenChange,
  parentAgentId,
  parentAgentName,
  onSubAgentCreated,
}: CreateSubAgentModalProps) {
  const { createAgent } = useAIAgents();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const agent = await createAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        agent_type: 'single', // Sub-agentes são sempre single
        is_primary: false,
        parent_agent_id: parentAgentId,
      });

      if (agent) {
        setName('');
        setDescription('');
        onSubAgentCreated(agent.id);
        onOpenChange(false);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Criar Sub-agente</DialogTitle>
          <DialogDescription className="text-center">
            Vinculado ao agente "{parentAgentName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subagent-name">Nome do Sub-agente *</Label>
            <Input
              id="subagent-name"
              placeholder="Ex: Qualificação, Agendamento, Suporte..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleCreate();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subagent-description">Descrição (opcional)</Label>
            <Textarea
              id="subagent-description"
              placeholder="Descreva a função deste sub-agente..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
          >
            <Plus className="w-4 h-4 mr-2" />
            {isCreating ? 'Criando...' : 'Criar Sub-agente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
