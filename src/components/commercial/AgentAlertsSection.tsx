import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Eye, 
  Clock,
  MessageSquare,
  CheckCircle,
  XCircle,
  Flame,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AgentAlert } from '@/hooks/useAgentIndividualData';

interface AgentAlertsSectionProps {
  alerts: AgentAlert[];
  onViewConversation: (alert: AgentAlert) => void;
}

const severityConfig = {
  critical: { 
    label: 'Crítico', 
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: Flame
  },
  high: { 
    label: 'Alto', 
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    icon: AlertTriangle
  },
  medium: { 
    label: 'Médio', 
    color: 'bg-warning/10 text-warning border-warning/20',
    icon: Zap
  },
  low: { 
    label: 'Baixo', 
    color: 'bg-muted text-muted-foreground border-border',
    icon: MessageSquare
  },
};

const alertTypeLabels: Record<string, string> = {
  aggressive: 'Comportamento Agressivo',
  negligent: 'Negligência',
  lazy: 'Falta de Proatividade',
  slow_response: 'Resposta Lenta',
  sabotage: 'Prejuízo ao Atendimento',
  quality_issue: 'Qualidade Baixa',
  unprofessional: 'Conduta Não Profissional',
};

export function AgentAlertsSection({ alerts, onViewConversation }: AgentAlertsSectionProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            Alertas Comportamentais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-center">
            <div>
              <CheckCircle className="w-12 h-12 text-success/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum alerta comportamental detectado
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Este atendente está mantendo um bom padrão de conduta
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;

  return (
    <Card className={cn(criticalCount > 0 && "border-destructive/50")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className={cn(
              "w-4 h-4",
              criticalCount > 0 ? "text-destructive" : "text-warning"
            )} />
            Alertas Comportamentais
            <Badge variant="secondary" className="ml-2">
              {alerts.length}
            </Badge>
          </CardTitle>
          {(criticalCount > 0 || highCount > 0) && (
            <div className="flex gap-2">
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalCount} Crítico{criticalCount > 1 ? 's' : ''}
                </Badge>
              )}
              {highCount > 0 && (
                <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
                  {highCount} Alto{highCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="p-4 pt-0 space-y-3">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const SeverityIcon = config.icon;
              
              return (
                <div 
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    alert.severity === 'critical' && "bg-destructive/5 border-destructive/30",
                    alert.severity === 'high' && "bg-orange-500/5 border-orange-500/30",
                    alert.severity === 'medium' && "bg-warning/5 border-warning/30",
                    alert.severity === 'low' && "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityIcon className={cn(
                          "w-4 h-4 shrink-0",
                          alert.severity === 'critical' && "text-destructive",
                          alert.severity === 'high' && "text-orange-600",
                          alert.severity === 'medium' && "text-warning",
                          alert.severity === 'low' && "text-muted-foreground"
                        )} />
                        <span className="font-medium text-sm truncate">
                          {alert.title}
                        </span>
                        <Badge variant="outline" className={cn("text-xs shrink-0", config.color)}>
                          {config.label}
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2">
                        {alert.description}
                      </p>
                      
                      {alert.message_excerpt && (
                        <div className="bg-background/50 p-2 rounded text-xs italic text-muted-foreground border border-dashed mb-2">
                          "{alert.message_excerpt}"
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(alert.detected_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                        
                        {alert.contact && (
                          <button
                            onClick={() => onViewConversation(alert)}
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            {alert.contact.name || alert.contact.phone_number}
                          </button>
                        )}
                        
                        {alert.lead_was_rude && (
                          <Badge variant="outline" className="text-xs bg-muted">
                            Lead foi rude primeiro
                          </Badge>
                        )}
                        
                        {alert.reviewed && (
                          <Badge variant="outline" className="text-xs bg-success/10 text-success">
                            Revisado
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => onViewConversation(alert)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
