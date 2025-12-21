import { useState, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, 
  Eye, 
  Clock,
  MessageSquare,
  CheckCircle,
  XCircle,
  Flame,
  Zap,
  Filter,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AgentAlert } from '@/hooks/useAgentIndividualData';

interface AgentAlertsSectionProps {
  alerts: AgentAlert[];
  totalAlerts: number;
  hasMore: boolean;
  loadingMore: boolean;
  onViewConversation: (alert: AgentAlert) => void;
  onLoadMore: () => void;
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

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

export function AgentAlertsSection({ 
  alerts, 
  totalAlerts,
  hasMore, 
  loadingMore, 
  onViewConversation, 
  onLoadMore 
}: AgentAlertsSectionProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredAlerts = severityFilter === 'all' 
    ? alerts 
    : alerts.filter(a => a.severity === severityFilter);

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  // Handle scroll to bottom detection for infinite scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    
    if (bottom && hasMore && !loadingMore && severityFilter === 'all') {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore, severityFilter]);

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

  return (
    <Card className={cn(criticalCount > 0 && "border-destructive/50")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className={cn(
              "w-4 h-4",
              criticalCount > 0 ? "text-destructive" : "text-warning"
            )} />
            Alertas Comportamentais
            <Badge variant="secondary" className="ml-2">
              {alerts.length}{totalAlerts > alerts.length ? ` de ${totalAlerts}` : ''}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Filtrar por..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    Todas ({alerts.length})
                  </div>
                </SelectItem>
                <SelectItem value="critical" disabled={criticalCount === 0}>
                  <div className="flex items-center gap-2">
                    <Flame className="w-3 h-3 text-destructive" />
                    Crítico ({criticalCount})
                  </div>
                </SelectItem>
                <SelectItem value="high" disabled={highCount === 0}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-orange-600" />
                    Alto ({highCount})
                  </div>
                </SelectItem>
                <SelectItem value="medium" disabled={mediumCount === 0}>
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-warning" />
                    Médio ({mediumCount})
                  </div>
                </SelectItem>
                <SelectItem value="low" disabled={lowCount === 0}>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-muted-foreground" />
                    Baixo ({lowCount})
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea 
          className="max-h-[400px]" 
          ref={scrollRef}
          onScrollCapture={handleScroll}
        >
          <div className="p-4 pt-0 space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum alerta com essa prioridade
                </p>
              </div>
            ) : (
              <>
                {filteredAlerts.map((alert) => {
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

                {/* Loading indicator */}
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Carregando mais...</span>
                  </div>
                )}

                {/* Load more button - only show when filter is 'all' */}
                {hasMore && !loadingMore && severityFilter === 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground"
                    onClick={onLoadMore}
                  >
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Carregar mais alertas
                  </Button>
                )}

                {/* End of list indicator */}
                {!hasMore && alerts.length > 0 && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    Todos os {totalAlerts} alertas carregados
                  </p>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
