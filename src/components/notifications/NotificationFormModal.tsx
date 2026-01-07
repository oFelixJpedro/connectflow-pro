import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone } from 'lucide-react';
import type { WhatsAppNotification, NotificationType } from '@/types/notifications';
import { NOTIFICATION_TEMPLATES, NOTIFICATION_PLACEHOLDERS } from '@/types/notifications';
import { formatPhoneForDisplay } from '@/lib/phoneUtils';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  notification_type: z.enum(['contract_sent', 'contract_signed', 'meeting_scheduled', 'custom']),
  message_template: z.string().min(1, 'Mensagem é obrigatória'),
  connection_id: z.string().min(1, 'Selecione uma conexão')
});

type FormData = z.infer<typeof formSchema>;

interface NotificationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: WhatsAppNotification | null;
  templateType: NotificationType | null;
  connections: Array<{ id: string; phone_number: string | null; name: string | null }>;
  onSubmit: (data: FormData) => Promise<void>;
}

export function NotificationFormModal({
  open,
  onOpenChange,
  notification,
  templateType,
  connections,
  onSubmit
}: NotificationFormModalProps) {
  const isEditing = !!notification;
  const template = templateType ? NOTIFICATION_TEMPLATES.find(t => t.type === templateType) : null;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      notification_type: 'custom',
      message_template: '',
      connection_id: ''
    }
  });

  useEffect(() => {
    if (open) {
      if (notification) {
        // Editing existing notification
        form.reset({
          name: notification.name,
          notification_type: notification.notification_type,
          message_template: notification.message_template,
          connection_id: notification.connection_id
        });
      } else if (template) {
        // Creating from template
        form.reset({
          name: template.name,
          notification_type: template.type,
          message_template: template.defaultMessage,
          connection_id: connections[0]?.id || ''
        });
      } else {
        // Creating custom
        form.reset({
          name: '',
          notification_type: 'custom',
          message_template: '',
          connection_id: connections[0]?.id || ''
        });
      }
    }
  }, [open, notification, template, connections, form]);

  const handleSubmit = async (data: FormData) => {
    await onSubmit(data);
    form.reset();
  };

  const insertPlaceholder = (placeholder: string) => {
    const currentValue = form.getValues('message_template');
    form.setValue('message_template', currentValue + placeholder);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Notificação' : 'Configurar Notificação'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Notificação</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Contrato Assinado - Maternidade"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notification_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Evento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="contract_sent">📄 Contrato Enviado</SelectItem>
                      <SelectItem value="contract_signed">✅ Contrato Assinado</SelectItem>
                      <SelectItem value="meeting_scheduled">📅 Reunião Agendada</SelectItem>
                      <SelectItem value="custom">⚙️ Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="connection_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conexão que enviará</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma conexão" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>
                              {conn.phone_number ? formatPhoneForDisplay(conn.phone_number) : 'Sem número'}
                              {conn.name && ` - ${conn.name}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Este número será usado para enviar as notificações
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message_template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template da Mensagem</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Digite a mensagem que será enviada..."
                      className="min-h-[200px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use os placeholders abaixo para personalizar a mensagem
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Placeholders */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Placeholders disponíveis:</p>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_PLACEHOLDERS.map((p) => (
                  <Badge
                    key={p.key}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => insertPlaceholder(p.key)}
                  >
                    {p.key}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em um placeholder para adicioná-lo à mensagem
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {isEditing ? 'Salvar Alterações' : 'Criar Notificação'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
