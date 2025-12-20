import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  BarChart3,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { CommercialReport } from '@/hooks/useReportsData';

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
  // Português (como vem do banco)
  tempoResposta: 'Tempo de Resposta',
  comunicacao: 'Comunicação',
  objetividade: 'Objetividade',
  humanizacao: 'Humanização',
  fechamento: 'Fechamento',
  objecoes: 'Tratamento de Objeções',
  // Inglês (fallback)
  response_time: 'Tempo de Resposta',
  communication: 'Comunicação',
  objectivity: 'Objetividade',
  humanization: 'Humanização',
  closing: 'Fechamento',
  objection_handling: 'Tratamento de Objeções',
};

const levelColors: Record<string, string> = {
  INICIANTE: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  INTERMEDIÁRIO: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  AVANÇADO: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  ESPECIALISTA: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  MESTRE: 'bg-success/10 text-success border-success/20',
};

export function ReportDetailModal({ open, onOpenChange, report }: ReportDetailModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (!report) return null;

  const radarData = Object.entries(report.criteria_scores || {}).map(([key, value]) => ({
    criteria: criteriaLabels[key] || key,
    score: value,
    fullMark: 10,
  }));

  const generatePDF = async () => {
    if (!contentRef.current) return;

    setGeneratingPdf(true);
    try {
      const element = contentRef.current;
      
      // Capture the content as canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio-${report.week_start}-${report.week_end}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">
                    Semana {format(new Date(report.week_start), "dd/MM", { locale: ptBR })} - {format(new Date(report.week_end), "dd/MM/yyyy", { locale: ptBR })}
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
                  Relatório detalhado do Gerente Comercial
                </p>
              </div>
            </DialogTitle>
            <Button 
              onClick={generatePDF} 
              disabled={generatingPdf}
              className="ml-4"
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

        <ScrollArea className="flex-1 h-full">
          <div ref={contentRef} className="p-4 pb-8 bg-background">
            <Tabs defaultValue="resumo" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="criterios">Critérios</TabsTrigger>
                <TabsTrigger value="agentes">Agentes</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>

              {/* Resumo Tab */}
              <TabsContent value="resumo" className="space-y-4">
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-primary">
                        {report.average_score?.toFixed(1) || 'N/A'}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Award className="w-4 h-4" />
                        Nota Média
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold">
                        {report.total_conversations}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        Conversas
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-success">
                        {report.qualified_leads}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Users className="w-4 h-4" />
                        Leads Qualificados
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-amber-500">
                        {report.closed_deals}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Target className="w-4 h-4" />
                        Vendas Fechadas
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Classification Badge */}
                <div className="flex justify-center">
                  <Badge 
                    variant="outline" 
                    className={cn("text-lg px-4 py-2", classificationColors[report.classification || ''] || '')}
                  >
                    {report.classification === 'SEM_DADOS' ? 'Sem Dados' : report.classification || 'N/A'}
                  </Badge>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-success/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-success">
                        <TrendingUp className="w-4 h-4" />
                        Pontos Fortes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {report.strengths && report.strengths.length > 0 ? (
                        <ul className="space-y-2">
                          {report.strengths.map((strength, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-success mt-1">•</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum ponto forte identificado</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-destructive/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-destructive">
                        <TrendingDown className="w-4 h-4" />
                        Pontos a Melhorar
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {report.weaknesses && report.weaknesses.length > 0 ? (
                        <ul className="space-y-2">
                          {report.weaknesses.map((weakness, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-destructive mt-1">•</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum ponto a melhorar identificado</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Critérios Tab */}
              <TabsContent value="criterios" className="space-y-4">
                {radarData.length > 0 ? (
                  <>
                    {/* Radar Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Gráfico de Critérios</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="criteria" tick={{ fontSize: 12 }} />
                              <PolarRadiusAxis angle={30} domain={[0, 10]} />
                              <Radar
                                name="Score"
                                dataKey="score"
                                stroke="hsl(var(--primary))"
                                fill="hsl(var(--primary))"
                                fillOpacity={0.5}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Criteria Progress Bars */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Detalhamento por Critério</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {Object.entries(report.criteria_scores || {}).map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{criteriaLabels[key] || key}</span>
                              <span className="font-medium">{value.toFixed(1)}/10</span>
                            </div>
                            <Progress value={value * 10} className="h-2" />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">Nenhum critério avaliado neste relatório</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Agentes Tab */}
              <TabsContent value="agentes" className="space-y-4">
                {report.agents_analysis && report.agents_analysis.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Performance dos Agentes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Agente</TableHead>
                            <TableHead>Nível</TableHead>
                            <TableHead className="text-center">Score</TableHead>
                            <TableHead>Recomendação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.agents_analysis.map((agent: any, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                {agent.agent_name || agent.name || 'Agente'}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs", levelColors[agent.level] || 'bg-slate-500/10 text-slate-600 border-slate-500/20')}
                                >
                                  {agent.level || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {(agent.average_score ?? agent.score)?.toFixed(1) || '0.0'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                {agent.recommendation || `${agent.total_conversations || 0} conversas`}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Nenhum agente analisado neste relatório</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Insights Tab */}
              <TabsContent value="insights" className="space-y-4">
                {report.insights && report.insights.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Insights e Recomendações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {report.insights.map((insight, i) => (
                          <li 
                            key={i} 
                            className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                          >
                            <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Lightbulb className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Nenhum insight gerado para este relatório</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
