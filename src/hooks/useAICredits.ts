import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AICredits, AITransaction, CreditType, AutoRechargeSettings } from '@/types/ai-credits';

export function useAICredits() {
  const [credits, setCredits] = useState<AICredits | null>(null);
  const [transactions, setTransactions] = useState<AITransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const loadCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('check-ai-credits');
      
      if (error) {
        console.error('Error loading credits:', error);
        toast.error('Erro ao carregar créditos de IA');
        return;
      }

      if (data?.credits) {
        setCredits(data.credits);
      }
      
      if (data?.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Error loading credits:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  const purchaseCredits = async (creditType: CreditType, quantity: number = 1) => {
    try {
      setIsPurchasing(true);
      
      const { data, error } = await supabase.functions.invoke('purchase-ai-credits', {
        body: { creditType, quantity }
      });
      
      if (error) {
        throw new Error(error.message);
      }

      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
        toast.success('Redirecionando para o pagamento...');
      }
    } catch (err) {
      console.error('Error purchasing credits:', err);
      toast.error('Erro ao iniciar compra de créditos');
    } finally {
      setIsPurchasing(false);
    }
  };

  const hasCredits = useCallback((creditType: CreditType): boolean => {
    if (!credits) return false;
    
    switch (creditType) {
      case 'standard_text':
        return credits.standard_text > 0;
      case 'advanced_text':
        return credits.advanced_text > 0;
      case 'standard_audio':
        return credits.standard_audio > 0;
      case 'advanced_audio':
        return credits.advanced_audio > 0;
      default:
        return false;
    }
  }, [credits]);

  const getBalance = useCallback((creditType: CreditType): number => {
    if (!credits) return 0;
    
    switch (creditType) {
      case 'standard_text':
        return credits.standard_text;
      case 'advanced_text':
        return credits.advanced_text;
      case 'standard_audio':
        return credits.standard_audio;
      case 'advanced_audio':
        return credits.advanced_audio;
      default:
        return 0;
    }
  }, [credits]);

  const updateAutoRecharge = async (settings: AutoRechargeSettings) => {
    try {
      const { error } = await supabase
        .from('ai_credits')
        .update({
          auto_recharge_enabled: settings.enabled,
          auto_recharge_threshold: settings.threshold,
          auto_recharge_types: settings.types,
        })
        .eq('company_id', settings.companyId);

      if (error) throw error;
      
      toast.success('Configurações de recarga automática atualizadas');
      await loadCredits();
    } catch (err) {
      console.error('Error updating auto-recharge:', err);
      toast.error('Erro ao atualizar configurações');
    }
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(2)}M`;
    }
    if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const getPercentage = (tokens: number): number => {
    return Math.min(100, (tokens / 1_000_000) * 100);
  };

  return {
    credits,
    transactions,
    isLoading,
    isPurchasing,
    loadCredits,
    purchaseCredits,
    hasCredits,
    getBalance,
    updateAutoRecharge,
    formatTokens,
    getPercentage,
  };
}
