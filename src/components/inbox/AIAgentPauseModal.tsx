import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Pause } from 'lucide-react';

interface AIAgentPauseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (durationMinutes: number) => Promise<void>;
  isLoading?: boolean;
}

const QUICK_OPTIONS = [
  { label: '30min', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '4h', value: 240 },
  { label: '8h', value: 480 },
  { label: '24h', value: 1440 },
];

export function AIAgentPauseModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: AIAgentPauseModalProps) {
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<number | null>(60);

  const handleConfirm = async () => {
    const duration = customMinutes ? parseInt(customMinutes, 10) : selectedOption;
    if (duration && duration > 0) {
      await onConfirm(duration);
      onOpenChange(false);
      setCustomMinutes('');
      setSelectedOption(60);
    }
  };

  const handleQuickSelect = (value: number) => {
    setSelectedOption(value);
    setCustomMinutes('');
  };

  const handleCustomChange = (value: string) => {
    setCustomMinutes(value);
    setSelectedOption(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="w-5 h-5 text-yellow-500" />
            Pausar IA Temporariamente
          </DialogTitle>
          <DialogDescription>
            Escolha por quanto tempo a IA deve ficar pausada nesta conversa. 
            Após o período, ela voltará a responder automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick options */}
          <div className="space-y-2">
            <Label>Duração rápida</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedOption === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleQuickSelect(option.value)}
                  disabled={isLoading}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom input */}
          <div className="space-y-2">
            <Label htmlFor="custom-minutes">Ou digite os minutos</Label>
            <Input
              id="custom-minutes"
              type="number"
              min="1"
              max="10080"
              placeholder="Ex: 90"
              value={customMinutes}
              onChange={(e) => handleCustomChange(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (!selectedOption && !customMinutes)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Pausando...
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pausar IA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
