import { useState } from 'react';
import { CreditCard, Info, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CreditBalanceCard } from './CreditBalanceCard';
import { AICreditsInfoModal } from './AICreditsInfoModal';
import { TransactionHistory } from './TransactionHistory';
import { AutoRechargeSettings } from './AutoRechargeSettings';
import { useAICredits } from '@/hooks/useAICredits';
import { useAuth } from '@/contexts/AuthContext';
import { AI_CREDIT_TYPES, type CreditType } from '@/types/ai-credits';

export function AICreditsTab() {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const { profile } = useAuth();
  const { 
    credits, 
    transactions, 
    isLoading, 
    isPurchasing, 
    loadCredits, 
    purchaseCredits,
    formatTokens,
    getPercentage,
  } = useAICredits();

  const companyId = profile?.company_id;

  const textCredits: CreditType[] = ['standard_text', 'advanced_text'];
  const audioCredits: CreditType[] = ['standard_audio', 'advanced_audio'];

  const handlePurchase = (type: CreditType) => {
    purchaseCredits(type, 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Créditos de IA</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie seus créditos para usar as funcionalidades de IA
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowInfoModal(true)}
            title="Informações sobre os tipos de IA"
          >
            <Info className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadCredits}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Warning if no credits */}
      {credits && credits.standard_text === 0 && credits.advanced_text === 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500">Sem créditos de IA</p>
                <p className="text-sm text-muted-foreground">
                  Você precisa recarregar créditos para usar as funcionalidades de IA.
                  Sem créditos, nenhuma função de IA estará disponível.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Text AI Credits */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">IA de Texto</h3>
          <Badge variant="outline">Todas as funções de IA</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {textCredits.map((type) => (
            <CreditBalanceCard
              key={type}
              config={AI_CREDIT_TYPES[type]}
              balance={credits?.[type.replace('_text', '_text') as keyof typeof credits] as number ?? 0}
              onPurchase={() => handlePurchase(type)}
              isPurchasing={isPurchasing}
              formatTokens={formatTokens}
              getPercentage={getPercentage}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Audio AI Credits */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">IA de Áudio (TTS)</h3>
          <Badge variant="outline">Respostas por áudio do agente</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {audioCredits.map((type) => (
            <CreditBalanceCard
              key={type}
              config={AI_CREDIT_TYPES[type]}
              balance={credits?.[type.replace('_audio', '_audio') as keyof typeof credits] as number ?? 0}
              onPurchase={() => handlePurchase(type)}
              isPurchasing={isPurchasing}
              formatTokens={formatTokens}
              getPercentage={getPercentage}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Auto Recharge Settings */}
      {companyId && (
        <AutoRechargeSettings 
          companyId={companyId} 
          credits={credits} 
          onUpdate={loadCredits}
        />
      )}

      <Separator />

      {/* Transaction History */}
      <TransactionHistory transactions={transactions} formatTokens={formatTokens} />

      {/* Info Modal */}
      <AICreditsInfoModal 
        open={showInfoModal} 
        onOpenChange={setShowInfoModal} 
      />
    </div>
  );
}
