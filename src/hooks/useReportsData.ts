import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CommercialReport {
  id: string;
  report_date: string;
  week_start: string;
  week_end: string;
  average_score: number;
  classification: 'EXCEPCIONAL' | 'BOM' | 'REGULAR' | 'RUIM' | 'CRÍTICO';
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
}

export function useReportsData() {
  const { profile, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<CommercialReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const isAdmin = userRole?.role === 'owner' || userRole?.role === 'admin';

  useEffect(() => {
    if (!profile?.company_id || !isAdmin) {
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
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
        })));
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [profile?.company_id, isAdmin, selectedYear, selectedMonth]);

  const downloadReport = async (report: CommercialReport) => {
    if (!report.pdf_url) {
      // If no PDF URL, generate one on the fly (future implementation)
      console.log('PDF not available for this report');
      return;
    }

    const { data, error } = await supabase.storage
      .from('commercial-reports')
      .download(report.pdf_url);

    if (error) {
      console.error('Error downloading report:', error);
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
  };
}
