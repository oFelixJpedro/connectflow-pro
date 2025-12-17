import { User, Users, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
          <div className="text-center">
            <p className="text-muted-foreground">
              Como você deseja criar seus agentes?
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha entre criar um agente único ou um sistema completo de multiagentes
            </p>
          </div>

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
                  Perfeito para necessidades simples e específicas
                </p>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Criação do zero com total personalização</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Configuração rápida e direta</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Ideal para uma única área ou necessidade específica</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Sistema de Multiagentes */}
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => onTypeSelected('multi')}
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Sistema de Multiagentes</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Solução completa com agentes especializados
                </p>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Agente principal de recepção (Nível 1)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Agentes especialistas por área (Nível 2)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Sistema inteligente de direcionamento</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <strong>Dica:</strong> Se você precisa atender diferentes áreas (ex: Bancário, 
              Trabalhista, BPC), escolha o Sistema de Multiagentes. Para uma única área ou 
              necessidade específica, o Agente Único é mais adequado.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}
