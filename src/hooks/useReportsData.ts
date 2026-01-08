import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ReportContentCriteriaItem {
  score: number;
  analysis: string;
  impact: string;
  recommendation: string;
}

export interface ReportContentAgent {
  agent_id: string;
  agent_name: string;
  score: number;
  analysis: string;
  strengths: string[];
  development_areas: string[];
  action_plan: string;
}

export interface ReportContentStrength {
  title: string;
  description: string;
  evidence: string;
}

export interface ReportContentWeakness {
  title: string;
  description: string;
  impact: string;
  recommendation: string;
}

export interface ReportContentInsight {
  insight: string;
  context: string;
  action_suggested: string;
}

export interface ReportContent {
  executive_summary: string;
  period_overview: string;
  criteria_analysis: Record<string, ReportContentCriteriaItem>;
  agents_detailed: ReportContentAgent[];
  strengths_detailed: ReportContentStrength[];
  weaknesses_detailed: ReportContentWeakness[];
  insights_detailed: ReportContentInsight[];
  conclusion: string;
  next_steps: string[];
  final_message: string;
}

export interface CommercialReport {
  id: string;
  report_date: string;
  week_start: string;
  week_end: string;
  average_score: number;
  classification: 'EXCEPCIONAL' | 'BOM' | 'REGULAR' | 'RUIM' | 'CRÍTICO' | 'SEM_DADOS';
  total_conversations: number;
  qualified_leads: number;
  closed_deals: number;
  conversion_rate: number;
  pdf_url: string | null;
  created_at: string;
  criteria_scores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  insights: string[];
  agents_analysis: Array<{
    id: string;
    name: string;
    level: string;
    score: number;
    recommendation: string;
  }>;
  is_anticipated?: boolean;
  anticipated_at?: string;
  anticipated_by?: string;
  report_content?: ReportContent;
}

function getCurrentWeekMondayStr(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

export function useReportsData() {
  const { profile, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<CommercialReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [generatingAnticipated, setGeneratingAnticipated] = useState(false);

  const isAdmin = userRole?.role === 'owner' || userRole?.role === 'admin';

  const fetchReports = useCallback(async () => {
    if (!profile?.company_id || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('commercial_reports')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('report_date', { ascending: false });

      // Apply year filter
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;
      query = query.gte('report_date', yearStart).lte('report_date', yearEnd);

      // Apply month filter if selected
      if (selectedMonth !== null) {
        const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
        const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
        const monthEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
        query = query.gte('report_date', monthStart).lt('report_date', monthEnd);
      }

      const { data, error } = await query;

      if (error) throw error;

      setReports((data || []).map(r => ({
        id: r.id,
        report_date: r.report_date,
        week_start: r.week_start,
        week_end: r.week_end,
        average_score: Number(r.average_score) || 0,
        classification: (r.classification || 'REGULAR') as CommercialReport['classification'],
        total_conversations: r.total_conversations || 0,
        qualified_leads: r.qualified_leads || 0,
        closed_deals: r.closed_deals || 0,
        conversion_rate: Number(r.conversion_rate) || 0,
        pdf_url: r.pdf_url,
        created_at: r.created_at || '',
        criteria_scores: (r.criteria_scores as Record<string, number>) || {},
        strengths: r.strengths || [],
        weaknesses: r.weaknesses || [],
        insights: r.insights || [],
        agents_analysis: (r.agents_analysis as any[]) || [],
        is_anticipated: r.is_anticipated || false,
        anticipated_at: r.anticipated_at || undefined,
        anticipated_by: r.anticipated_by || undefined,
        report_content: (r.report_content as unknown as ReportContent) || undefined,
      })));
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, isAdmin, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Check if user can generate an anticipated report this week
  const canGenerateAnticipated = useMemo(() => {
    if (!isAdmin) return false;
    
    const currentWeekMonday = getCurrentWeekMondayStr();
    
    // Check if an anticipated report already exists for this week
    return !reports.some(r => 
      r.week_start === currentWeekMonday && r.is_anticipated === true
    );
  }, [reports, isAdmin]);

  // Generate anticipated report
  const generateAnticipatedReport = async () => {
    if (!canGenerateAnticipated || generatingAnticipated) return;

    setGeneratingAnticipated(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-anticipated-report');

      if (error) {
        console.error('Error generating anticipated report:', error);
        toast.error('Erro ao gerar relatório antecipado');
        return;
      }

      if (data?.code === 'INSUFFICIENT_CREDITS') {
        toast.error('Créditos de IA insuficientes. Recarregue para gerar relatórios.');
        return;
      }

      if (data?.error) {
        if (data.already_generated) {
          toast.error('Você já gerou um relatório antecipado esta semana');
        } else {
          toast.error(data.error);
        }
        return;
      }

      toast.success(data?.message || 'Relatório antecipado gerado com sucesso!');
      
      // Refresh reports list
      await fetchReports();
    } catch (error) {
      console.error('Error generating anticipated report:', error);
      toast.error('Erro ao gerar relatório antecipado');
    } finally {
      setGeneratingAnticipated(false);
    }
  };

  const downloadReport = async (report: CommercialReport) => {
    if (!report.pdf_url) {
      toast.info('PDF não disponível para este relatório');
      return;
    }

    const { data, error } = await supabase.storage
      .from('commercial-reports')
      .download(report.pdf_url);

    if (error) {
      console.error('Error downloading report:', error);
      toast.error('Erro ao baixar relatório');
      return;
    }

    // Create download link
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${report.week_start}-${report.week_end}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    loading,
    reports,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    downloadReport,
    isAdmin,
    canGenerateAnticipated,
    generatingAnticipated,
    generateAnticipatedReport,
    refreshReports: fetchReports,
  };
}
