import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AIUsageByFunction {
  function_name: string;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
}

interface AIUsageByCompany {
  company_id: string;
  company_name: string;
  total_calls: number;
  total_tokens: number;
  total_cost: number;
}

interface DailyUsage {
  date: string;
  total_calls: number;
  total_cost: number;
}

interface UsageStats {
  totalAICalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalAICost: number;
  totalMessages: number;
  totalConversations: number;
  totalContacts: number;
  totalStorageFiles: number;
  usageByFunction: AIUsageByFunction[];
  usageByCompany: AIUsageByCompany[];
  dailyUsage: DailyUsage[];
}

export function useDeveloperUsage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });

  const fetchUsageStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const startDate = dateRange.start.toISOString();
      const endDate = dateRange.end.toISOString();

      // Fetch AI usage logs
      const { data: aiLogs, error: aiError } = await supabase
        .from('ai_usage_log')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (aiError) throw aiError;

      // Fetch companies for mapping
      const { data: companies, error: compError } = await supabase
        .from('companies')
        .select('id, name');

      if (compError) throw compError;

      const companyMap = new Map(companies?.map(c => [c.id, c.name]) || []);

      // Aggregate by function
      const functionMap = new Map<string, AIUsageByFunction>();
      const companyUsageMap = new Map<string, AIUsageByCompany>();
      const dailyMap = new Map<string, DailyUsage>();

      let totalCalls = 0;
      let totalInput = 0;
      let totalOutput = 0;
      let totalCost = 0;

      for (const log of aiLogs || []) {
        totalCalls++;
        totalInput += log.input_tokens || 0;
        totalOutput += log.output_tokens || 0;
        totalCost += Number(log.estimated_cost) || 0;

        // By function
        const fn = log.function_name;
        const existing = functionMap.get(fn) || {
          function_name: fn,
          total_calls: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_cost: 0
        };
        existing.total_calls++;
        existing.total_input_tokens += log.input_tokens || 0;
        existing.total_output_tokens += log.output_tokens || 0;
        existing.total_cost += Number(log.estimated_cost) || 0;
        functionMap.set(fn, existing);

        // By company
        if (log.company_id) {
          const compExisting = companyUsageMap.get(log.company_id) || {
            company_id: log.company_id,
            company_name: companyMap.get(log.company_id) || 'Desconhecida',
            total_calls: 0,
            total_tokens: 0,
            total_cost: 0
          };
          compExisting.total_calls++;
          compExisting.total_tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
          compExisting.total_cost += Number(log.estimated_cost) || 0;
          companyUsageMap.set(log.company_id, compExisting);
        }

        // By day
        const day = new Date(log.created_at).toISOString().split('T')[0];
        const dayExisting = dailyMap.get(day) || {
          date: day,
          total_calls: 0,
          total_cost: 0
        };
        dayExisting.total_calls++;
        dayExisting.total_cost += Number(log.estimated_cost) || 0;
        dailyMap.set(day, dayExisting);
      }

      // Fetch database stats
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      const { count: conversationsCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      const { count: contactsCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

      // Sort results
      const usageByFunction = Array.from(functionMap.values())
        .sort((a, b) => b.total_cost - a.total_cost);
      
      const usageByCompany = Array.from(companyUsageMap.values())
        .sort((a, b) => b.total_cost - a.total_cost)
        .slice(0, 10);

      const dailyUsage = Array.from(dailyMap.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      setStats({
        totalAICalls: totalCalls,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        totalAICost: totalCost,
        totalMessages: messagesCount || 0,
        totalConversations: conversationsCount || 0,
        totalContacts: contactsCount || 0,
        totalStorageFiles: 0, // Would need storage API
        usageByFunction,
        usageByCompany,
        dailyUsage
      });

    } catch (e) {
      console.error('Error fetching usage stats:', e);
      setError(e instanceof Error ? e.message : 'Erro ao carregar estatísticas');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchUsageStats();
  }, [fetchUsageStats]);

  return {
    stats,
    isLoading,
    error,
    dateRange,
    setDateRange,
    refetch: fetchUsageStats
  };
}
