import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ArrowDownLeft, ArrowUpRight, RefreshCw, Undo2 } from 'lucide-react';
import { AI_CREDIT_TYPES, type AITransaction, type TransactionType } from '@/types/ai-credits';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransactionHistoryProps {
  transactions: AITransaction[];
  formatTokens: (tokens: number) => string;
}

const getTransactionIcon = (type: TransactionType) => {
  switch (type) {
    case 'purchase':
      return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
    case 'usage':
      return <ArrowUpRight className="w-4 h-4 text-red-500" />;
    case 'auto_recharge':
      return <RefreshCw className="w-4 h-4 text-blue-500" />;
    case 'refund':
      return <Undo2 className="w-4 h-4 text-yellow-500" />;
    default:
      return null;
  }
};

const getTransactionLabel = (type: TransactionType) => {
  switch (type) {
    case 'purchase':
      return 'Recarga';
    case 'usage':
      return 'Uso';
    case 'auto_recharge':
      return 'Recarga Automática';
    case 'refund':
      return 'Reembolso';
    default:
      return type;
  }
};

const getTransactionBadgeVariant = (type: TransactionType) => {
  switch (type) {
    case 'purchase':
    case 'auto_recharge':
    case 'refund':
      return 'default' as const;
    case 'usage':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
};

export function TransactionHistory({ transactions, formatTokens }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-5 h-5" />
            Histórico de Transações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma transação registrada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-5 h-5" />
          Histórico de Transações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div 
                key={tx.id} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getTransactionIcon(tx.transaction_type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {getTransactionLabel(tx.transaction_type)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {AI_CREDIT_TYPES[tx.credit_type]?.label || tx.credit_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tx.function_name && `${tx.function_name} • `}
                      {format(new Date(tx.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-mono font-medium ${tx.tokens_amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {tx.tokens_amount > 0 ? '+' : ''}{formatTokens(tx.tokens_amount)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Saldo: {formatTokens(tx.tokens_balance_after)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
