import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { CreditTypeConfig } from '@/types/ai-credits';

interface CreditBalanceCardProps {
  config: CreditTypeConfig;
  balance: number;
  onPurchase: () => void;
  isPurchasing: boolean;
  formatTokens: (tokens: number) => string;
  getPercentage: (tokens: number) => number;
}

export function CreditBalanceCard({
  config,
  balance,
  onPurchase,
  isPurchasing,
  formatTokens,
  getPercentage,
}: CreditBalanceCardProps) {
  const percentage = getPercentage(balance);
  const isEmpty = balance === 0;
  const isLow = percentage < 10 && percentage > 0;

  return (
    <Card className={`relative ${isEmpty ? 'border-destructive/50' : isLow ? 'border-yellow-500/50' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{config.label}</CardTitle>
          {isEmpty && <Badge variant="destructive">Sem créditos</Badge>}
          {isLow && !isEmpty && <Badge variant="outline" className="text-yellow-500 border-yellow-500">Baixo</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Saldo:</span>
            <span className="font-mono font-semibold">
              {formatTokens(balance)} tokens
            </span>
          </div>
          <Progress 
            value={percentage} 
            className={`h-2 ${isEmpty ? '[&>div]:bg-destructive' : isLow ? '[&>div]:bg-yellow-500' : ''}`}
          />
          <p className="text-xs text-muted-foreground text-right">
            {percentage.toFixed(1)}% de 1M tokens
          </p>
        </div>

        {/* Purchase button */}
        <Button 
          onClick={onPurchase} 
          disabled={isPurchasing}
          className="w-full"
          variant={isEmpty ? "default" : "outline"}
        >
          {isPurchasing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>Recarregar {config.price}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
