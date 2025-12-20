import { Library, Download, Calendar, Loader2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReportsData } from '@/hooks/useReportsData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const classificationColors: Record<string, string> = {
  EXCEPCIONAL: 'bg-success/10 text-success border-success/20',
  BOM: 'bg-primary/10 text-primary border-primary/20',
  REGULAR: 'bg-warning/10 text-warning border-warning/20',
  RUIM: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  CRÍTICO: 'bg-destructive/10 text-destructive border-destructive/20',
};

function ReportCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

interface ReportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportsModal({ open, onOpenChange }: ReportsModalProps) {
  const {
    loading,
    reports,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    downloadReport,
  } = useReportsData();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Library className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-xl font-bold">Relatórios</span>
              <p className="text-sm text-muted-foreground font-normal">
                Biblioteca de relatórios semanais do Gerente Comercial
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 py-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedMonth?.toString() ?? 'all'} 
            onValueChange={(v) => setSelectedMonth(v === 'all' ? null : parseInt(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Todos os meses" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reports List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading ? (
            <>
              <ReportCardSkeleton />
              <ReportCardSkeleton />
              <ReportCardSkeleton />
            </>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Library className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  Nenhum relatório encontrado para o período selecionado
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os relatórios são gerados automaticamente toda segunda-feira às 06:00
                </p>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          Semana {format(new Date(report.week_start), "dd/MM", { locale: ptBR })} - {format(new Date(report.week_end), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{report.total_conversations} conversas</span>
                        <span>•</span>
                        <span>Nota: {report.average_score?.toFixed(1) ?? 'N/A'}/10</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(classificationColors[report.classification || ''] || '')}
                      >
                        {report.classification || 'N/A'}
                      </Badge>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadReport(report)}
                        disabled={!report.pdf_url}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
