import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Sparkles, Volume2, Zap } from 'lucide-react';
import { AI_CREDIT_TYPES, type CreditType } from '@/types/ai-credits';

interface AICreditsInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AICreditsInfoModal({ open, onOpenChange }: AICreditsInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Tipos de IA e Créditos
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            {/* Text AI Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-lg">IA de Texto</h3>
              </div>
              
              <div className="grid gap-4">
                <CreditInfoCard type="standard_text" />
                <CreditInfoCard type="advanced_text" recommended />
              </div>
            </div>

            <Separator />

            {/* Audio AI Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-lg">IA de Áudio (TTS)</h3>
              </div>
              
              <div className="grid gap-4">
                <CreditInfoCard type="standard_audio" />
                <CreditInfoCard type="advanced_audio" recommended />
              </div>
            </div>

            <Separator />

            {/* Important Notes */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium">Informações Importantes</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Cada recarga adiciona <strong>1 milhão de tokens</strong></li>
                <li>• Os tokens são consumidos proporcionalmente ao uso</li>
                <li>• Sem créditos, nenhuma função de IA estará disponível</li>
                <li>• A IA Padrão de Texto é usada por todas as funcionalidades</li>
                <li>• A IA Avançada de Texto está disponível apenas no Agente de IA</li>
                <li>• As IAs de Áudio são usadas apenas quando o Agente responde com áudio</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CreditInfoCard({ type, recommended }: { type: CreditType; recommended?: boolean }) {
  const config = AI_CREDIT_TYPES[type];
  
  return (
    <div className={`border rounded-lg p-4 space-y-3 ${recommended ? 'border-primary/50 bg-primary/5' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{config.label}</h4>
          {recommended && <Badge className="bg-primary">Recomendado</Badge>}
        </div>
        <span className="font-semibold text-primary">{config.price}</span>
      </div>
      
      <p className="text-sm text-muted-foreground">{config.description}</p>
      
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase">Funcionalidades:</p>
        <ul className="grid gap-1">
          {config.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
