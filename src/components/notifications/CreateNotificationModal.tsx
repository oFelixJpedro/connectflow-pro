import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, FileText, CheckCircle, Calendar } from 'lucide-react';
import { useState } from 'react';
import type { NotificationType } from '@/types/notifications';
import { NOTIFICATION_TEMPLATES } from '@/types/notifications';

interface CreateNotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (type: NotificationType | 'custom') => void;
}

const ICONS = {
  contract_sent: FileText,
  contract_signed: CheckCircle,
  meeting_scheduled: Calendar
};

export function CreateNotificationModal({
  open,
  onOpenChange,
  onSelectTemplate
}: CreateNotificationModalProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<NotificationType>>(new Set());

  const toggleType = (type: NotificationType) => {
    const newSet = new Set(selectedTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setSelectedTypes(newSet);
  };

  const handleCreate = () => {
    if (selectedTypes.size === 1) {
      onSelectTemplate([...selectedTypes][0]);
    } else if (selectedTypes.size > 1) {
      // For multiple, open the first one (user can create others after)
      onSelectTemplate([...selectedTypes][0]);
    }
    setSelectedTypes(new Set());
  };

  const handleCustom = () => {
    onSelectTemplate('custom');
    setSelectedTypes(new Set());
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedTypes(new Set());
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Notificações</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Custom option */}
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={handleCustom}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Criar Notificação Personalizada</h4>
                <p className="text-sm text-muted-foreground">
                  Crie uma notificação customizada do zero
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            ou escolha modelos prontos
          </div>

          {/* Template options */}
          <div className="space-y-3">
            {NOTIFICATION_TEMPLATES.map((template) => {
              const Icon = ICONS[template.type];
              const isSelected = selectedTypes.has(template.type);

              return (
                <Card
                  key={template.type}
                  className={`cursor-pointer transition-all ${
                    isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => toggleType(template.type)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleType(template.type)}
                    />
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{template.icon} {template.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={selectedTypes.size === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar notificações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
