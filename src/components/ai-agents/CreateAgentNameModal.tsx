import { useState } from 'react';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
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

  const typeLabel = agentType === 'single' ? 'Agente Único' : 'Sistema de Multiagentes';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Criar Novo Agente</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground">Defina o nome do seu agente</p>
            <p className="text-sm text-muted-foreground">
              Criando {typeLabel.toLowerCase()}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-name">Nome do Agente *</Label>
            <Input
              id="agent-name"
              placeholder="Ex: Atendimento Comercial, Suporte BPC, etc."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleCreate();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Escolha um nome descritivo e fácil de identificar
            </p>
          </div>

          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <strong>Configurações padrão:</strong>
              <ul className="mt-1 space-y-1">
                <li>✓ Agente será criado como inativo</li>
                <li>✓ Gatilhos estarão desativados inicialmente</li>
              </ul>
            </AlertDescription>
          </Alert>
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
