import { useState, useEffect } from 'react';
import { CreditCard, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AI_CREDIT_TYPES, type CreditType } from '@/types/ai-credits';

interface AutoRechargeSettingsProps {
  companyId: string;
  credits: {
    auto_recharge_enabled: boolean;
    auto_recharge_threshold: number;
    auto_recharge_types?: string[];
  } | null;
  onUpdate: () => void;
}

export function AutoRechargeSettings({ companyId, credits, onUpdate }: AutoRechargeSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(50000);
  const [selectedTypes, setSelectedTypes] = useState<CreditType[]>([]);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(true);

  useEffect(() => {
    if (credits) {
      setEnabled(credits.auto_recharge_enabled);
      setThreshold(credits.auto_recharge_threshold || 50000);
      setSelectedTypes((credits.auto_recharge_types || []) as CreditType[]);
    }
  }, [credits]);

  useEffect(() => {
    checkPaymentMethod();
  }, [companyId]);

  const checkPaymentMethod = async () => {
    try {
      setIsCheckingPayment(true);
      const { data } = await supabase
        .from('ai_credits')
        .select('stripe_payment_method_id')
        .eq('company_id', companyId)
        .single();
      
      setHasPaymentMethod(!!data?.stripe_payment_method_id);
    } catch (error) {
      console.error('Error checking payment method:', error);
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handleTypeToggle = (type: CreditType) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from('ai_credits')
        .update({
          auto_recharge_enabled: enabled,
          auto_recharge_threshold: threshold,
          auto_recharge_types: selectedTypes,
        })
        .eq('company_id', companyId);

      if (error) throw error;
      
      toast.success('Configurações de recarga automática salvas');
      onUpdate();
    } catch (error) {
      console.error('Error saving auto-recharge settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Erro ao abrir portal de pagamentos');
    }
  };

  const formatThreshold = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <CardTitle className="text-lg">Recarga Automática</CardTitle>
        </div>
        <CardDescription>
          Recarregue créditos automaticamente quando o saldo estiver baixo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Method Warning */}
        {!hasPaymentMethod && !isCheckingPayment && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-500">
                Método de pagamento necessário
              </p>
              <p className="text-sm text-muted-foreground">
                Configure um método de pagamento para usar a recarga automática.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={openCustomerPortal}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Configurar Pagamento
              </Button>
            </div>
          </div>
        )}

        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-recharge">Ativar recarga automática</Label>
            <p className="text-sm text-muted-foreground">
              Recarregar automaticamente quando os créditos estiverem abaixo do limite
            </p>
          </div>
          <Switch
            id="auto-recharge"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!hasPaymentMethod}
          />
        </div>

        {enabled && (
          <>
            {/* Threshold Setting */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Limite para recarga</Label>
                <span className="text-sm font-medium">
                  {formatThreshold(threshold)} tokens
                </span>
              </div>
              <Slider
                value={[threshold]}
                onValueChange={(value) => setThreshold(value[0])}
                min={10000}
                max={500000}
                step={10000}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Quando o saldo ficar abaixo de {formatThreshold(threshold)} tokens, uma recarga será feita automaticamente.
              </p>
            </div>

            {/* Credit Types Selection */}
            <div className="space-y-3">
              <Label>Tipos de crédito para recarga automática</Label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(AI_CREDIT_TYPES) as CreditType[]).map((type) => (
                  <div 
                    key={type}
                    className="flex items-center space-x-2 p-3 rounded-lg border"
                  >
                    <Checkbox
                      id={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={() => handleTypeToggle(type)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={type} className="text-sm font-medium cursor-pointer">
                        {AI_CREDIT_TYPES[type].label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {AI_CREDIT_TYPES[type].price}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !hasPaymentMethod}
          className="w-full"
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </CardContent>
    </Card>
  );
}
