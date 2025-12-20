import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import {
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Target,
  Award,
  Lightbulb,
  Zap,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CommercialReport } from '@/hooks/useReportsData';
import { ProfessionalReportPDF } from './ProfessionalReportPDF';

interface ReportDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: CommercialReport | null;
}

const classificationColors: Record<string, string> = {
  EXCEPCIONAL: 'bg-success/10 text-success border-success/20',
  BOM: 'bg-primary/10 text-primary border-primary/20',
  REGULAR: 'bg-warning/10 text-warning border-warning/20',
  RUIM: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  CRÍTICO: 'bg-destructive/10 text-destructive border-destructive/20',
  SEM_DADOS: 'bg-muted text-muted-foreground border-muted',
};

const criteriaLabels: Record<string, string> = {
  tempoResposta: 'Tempo de Resposta',
  comunicacao: 'Comunicação',
  objetividade: 'Objetividade',
  humanizacao: 'Humanização',
  fechamento: 'Fechamento',
  objecoes: 'Tratamento de Objeções',
  response_time: 'Tempo de Resposta',
  communication: 'Comunicação',
  objectivity: 'Objetividade',
  humanization: 'Humanização',
  closing: 'Fechamento',
  objection_handling: 'Tratamento de Objeções',
};

export function ReportDetailModal({ open, onOpenChange, report }: ReportDetailModalProps) {
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (!report) return null;

  const hasAIContent = report.report_content && Object.keys(report.report_content).length > 0;
  const content = report.report_content;

  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
      const blob = await pdf(<ProfessionalReportPDF report={report} />).toBlob();
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-comercial-${report.week_start}-${report.week_end}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('PDF profissional gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">
                    Relatório Comercial
                  </span>
                  {report.is_anticipated && (
                    <Badge 
                      variant="outline" 
                      className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs"
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Antecipado
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-normal">
                  {format(new Date(report.week_start), "dd 'de' MMMM", { locale: ptBR })} - {format(new Date(report.week_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </DialogTitle>
            <Button 
              onClick={generatePDF} 
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Document Preview - Continuous Scroll */}
        <ScrollArea className="flex-1 h-full">
          <div className="p-6 space-y-8 max-w-3xl mx-auto">
            
            {/* Cover Section */}
            <div className="text-center py-8 border-b">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                Relatório Semanal
              </Badge>
              <h1 className="text-3xl font-bold mb-2">Análise Comercial</h1>
              <p className="text-muted-foreground mb-6">Gerente Comercial com Inteligência Artificial</p>
              
              <Badge 
                variant="outline" 
                className={cn("text-lg px-6 py-2", classificationColors[report.classification || ''] || '')}
              >
                {report.classification === 'SEM_DADOS' ? 'Sem Dados' : report.classification || 'N/A'}
              </Badge>
            </div>

            {/* Key Metrics */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Métricas Principais
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-primary">
                      {report.average_score?.toFixed(1) || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Nota Média</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold">{report.total_conversations}</div>
                    <div className="text-sm text-muted-foreground">Conversas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-success">{report.qualified_leads}</div>
                    <div className="text-sm text-muted-foreground">Leads Qualificados</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-amber-500">{report.closed_deals}</div>
                    <div className="text-sm text-muted-foreground">Vendas Fechadas</div>
                  </CardContent>
                </Card>
              </div>
            </section>

            <Separator />

            {/* Executive Summary */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Sumário Executivo
              </h2>
              <Card>
                <CardContent className="p-6 space-y-4">
                  {hasAIContent && content?.executive_summary ? (
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {content.executive_summary}
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Durante o período de {format(new Date(report.week_start), "dd 'de' MMMM", { locale: ptBR })} a {format(new Date(report.week_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}, a equipe comercial realizou {report.total_conversations} atendimentos, obtendo uma nota média de {report.average_score?.toFixed(1) || 0}/10.
                    </p>
                  )}
                  
                  {hasAIContent && content?.period_overview && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Visão Geral do Período</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          {content.period_overview}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>

            <Separator />

            {/* Criteria Analysis */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Análise de Critérios
              </h2>
              <div className="space-y-4">
                {Object.entries(report.criteria_scores || {}).map(([key, value]) => {
                  const aiAnalysis = hasAIContent && content?.criteria_analysis?.[key];
                  
                  return (
                    <Card key={key}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{criteriaLabels[key] || key}</span>
                          <span className="text-lg font-bold text-primary">{value.toFixed(1)}/10</span>
                        </div>
                        <Progress value={value * 10} className="h-2 mb-3" />
                        
                        {aiAnalysis ? (
                          <div className="space-y-2 text-sm">
                            <p className="text-muted-foreground">{aiAnalysis.analysis}</p>
                            <div className="flex gap-4 text-xs">
                              <span className="text-primary">
                                <strong>Impacto:</strong> {aiAnalysis.impact}
                              </span>
                            </div>
                            <p className="text-success text-xs">
                              <strong>Recomendação:</strong> {aiAnalysis.recommendation}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {value >= 7 
                              ? `Bom desempenho neste critério.`
                              : `Oportunidade de melhoria identificada.`}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            <Separator />

            {/* Strengths & Weaknesses */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Pontos Fortes e Fracos
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Strengths */}
                <Card className="border-success/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      Pontos Fortes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {hasAIContent && content?.strengths_detailed?.length > 0 ? (
                      content.strengths_detailed.map((strength, i) => (
                        <div key={i} className="space-y-1">
                          <p className="font-medium text-sm">{strength.title}</p>
                          <p className="text-xs text-muted-foreground">{strength.description}</p>
                          <p className="text-xs text-success/80 italic">Evidência: {strength.evidence}</p>
                        </div>
                      ))
                    ) : report.strengths?.length > 0 ? (
                      report.strengths.map((s, i) => (
                        <p key={i} className="text-sm flex items-start gap-2">
                          <span className="text-success mt-0.5">•</span>
                          {s}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum ponto forte identificado</p>
                    )}
                  </CardContent>
                </Card>

                {/* Weaknesses */}
                <Card className="border-destructive/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-4 h-4" />
                      Pontos a Melhorar
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {hasAIContent && content?.weaknesses_detailed?.length > 0 ? (
                      content.weaknesses_detailed.map((weakness, i) => (
                        <div key={i} className="space-y-1">
                          <p className="font-medium text-sm">{weakness.title}</p>
                          <p className="text-xs text-muted-foreground">{weakness.description}</p>
                          <p className="text-xs text-destructive/80">Impacto: {weakness.impact}</p>
                          <p className="text-xs text-primary">Ação: {weakness.recommendation}</p>
                        </div>
                      ))
                    ) : report.weaknesses?.length > 0 ? (
                      report.weaknesses.map((w, i) => (
                        <p key={i} className="text-sm flex items-start gap-2">
                          <span className="text-destructive mt-0.5">•</span>
                          {w}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum ponto a melhorar identificado</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>

            <Separator />

            {/* Agents Performance */}
            {((hasAIContent && content?.agents_detailed?.length > 0) || report.agents_analysis?.length > 0) && (
              <>
                <section>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Performance dos Agentes
                  </h2>
                  <div className="space-y-4">
                    {hasAIContent && content?.agents_detailed?.length > 0 ? (
                      content.agents_detailed.map((agent, i) => (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium">{agent.agent_name}</span>
                              <Badge variant="outline" className={cn(
                                agent.score >= 8 ? 'bg-success/10 text-success border-success/20' :
                                agent.score >= 6 ? 'bg-primary/10 text-primary border-primary/20' :
                                agent.score >= 4 ? 'bg-warning/10 text-warning border-warning/20' :
                                'bg-destructive/10 text-destructive border-destructive/20'
                              )}>
                                {agent.score?.toFixed(1) || '0.0'}/10
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{agent.analysis}</p>
                            <div className="grid md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-medium text-success mb-1">Pontos Fortes:</p>
                                <ul className="list-disc list-inside text-muted-foreground">
                                  {agent.strengths?.map((s, j) => <li key={j}>{s}</li>)}
                                </ul>
                              </div>
                              <div>
                                <p className="font-medium text-warning mb-1">Áreas de Desenvolvimento:</p>
                                <ul className="list-disc list-inside text-muted-foreground">
                                  {agent.development_areas?.map((d, j) => <li key={j}>{d}</li>)}
                                </ul>
                              </div>
                            </div>
                            <p className="text-xs text-primary mt-2">
                              <strong>Plano de Ação:</strong> {agent.action_plan}
                            </p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      report.agents_analysis?.map((agent: any, i) => (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{agent.agent_name || agent.name || 'Agente'}</span>
                              <span className="font-bold">
                                {(agent.average_score ?? agent.score)?.toFixed(1) || '0.0'}/10
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* Insights */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Insights e Recomendações
              </h2>
              <div className="space-y-3">
                {hasAIContent && content?.insights_detailed?.length > 0 ? (
                  content.insights_detailed.map((item, i) => (
                    <Card key={i} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <p className="font-medium text-sm mb-2">{item.insight}</p>
                        <p className="text-xs text-muted-foreground mb-2">{item.context}</p>
                        <p className="text-xs text-primary flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          {item.action_suggested}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                ) : report.insights?.length > 0 ? (
                  report.insights.map((insight, i) => (
                    <Card key={i} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <p className="text-sm">{insight}</p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum insight gerado</p>
                )}
              </div>
            </section>

            <Separator />

            {/* Conclusion */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Conclusão
              </h2>
              <Card>
                <CardContent className="p-6 space-y-4">
                  {hasAIContent && content?.conclusion ? (
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {content.conclusion}
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      O período analisado apresentou {report.total_conversations} atendimentos com classificação {report.classification}.
                    </p>
                  )}

                  {hasAIContent && content?.next_steps?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Próximos Passos</h4>
                      <ul className="space-y-1">
                        {content.next_steps.map((step, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-primary font-bold">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasAIContent && content?.final_message && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                      <p className="text-sm text-primary italic text-center">
                        "{content.final_message}"
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground py-4 border-t">
              <p>Documento gerado em {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
              <p className="mt-1">Confidencial - Uso Interno</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
