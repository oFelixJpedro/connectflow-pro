import { User, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import type { AIAgentType } from '@/types/ai-agents';

interface CreateAgentTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeSelected: (type: AIAgentType) => void;
}

export function CreateAgentTypeModal({
  open,
  onOpenChange,
  onTypeSelected,
}: CreateAgentTypeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center">Criar Novo Agente</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Agente Único */}
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => onTypeSelected('single')}
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Agente Único</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Um agente para todas as suas necessidades
                </p>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Configuração rápida e simples</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Ideal para um único fluxo de atendimento</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Multiagentes */}
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => onTypeSelected('multi')}
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Multiagentes</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Vários agentes trabalhando juntos
                </p>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Agente de recepção + especialistas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Direcionamento inteligente por assunto</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
