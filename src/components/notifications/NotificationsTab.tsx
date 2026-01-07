import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Bell, BellOff } from 'lucide-react';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { NotificationCard } from './NotificationCard';
import { CreateNotificationModal } from './CreateNotificationModal';
import { NotificationFormModal } from './NotificationFormModal';
import { RecipientsModal } from './RecipientsModal';
import type { WhatsAppNotification, NotificationType } from '@/types/notifications';

export function NotificationsTab() {
  const {
    notifications,
    connections,
    isLoading,
    createNotification,
    updateNotification,
    deleteNotification,
    toggleNotificationStatus,
    addRecipient,
    removeRecipient
  } = useNotificationSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<WhatsAppNotification | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<NotificationType | null>(null);

  const filteredNotifications = notifications.filter(n =>
    n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.notification_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeNotifications = filteredNotifications.filter(n => n.is_active);
  const inactiveNotifications = filteredNotifications.filter(n => !n.is_active);

  const handleTemplateSelect = (type: NotificationType | 'custom') => {
    setShowCreateModal(false);
    if (type === 'custom') {
      setSelectedTemplateType(null);
    } else {
      setSelectedTemplateType(type);
    }
    setSelectedNotification(null);
    setShowFormModal(true);
  };

  const handleEditNotification = (notification: WhatsAppNotification) => {
    setSelectedNotification(notification);
    setSelectedTemplateType(null);
    setShowFormModal(true);
  };

  const handleManageRecipients = (notification: WhatsAppNotification) => {
    setSelectedNotification(notification);
    setShowRecipientsModal(true);
  };

  const handleFormSubmit = async (data: {
    name: string;
    notification_type: NotificationType;
    message_template: string;
    connection_id: string;
  }) => {
    if (selectedNotification) {
      await updateNotification(selectedNotification.id, data);
    } else {
      await createNotification(data);
    }
    setShowFormModal(false);
    setSelectedNotification(null);
    setSelectedTemplateType(null);
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    await toggleNotificationStatus(id, isActive);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Notificações WhatsApp</h2>
            <p className="text-muted-foreground">
              Configure notificações automáticas para eventos importantes
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Notificação
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notificações..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhuma notificação configurada</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Configure notificações para receber alertas quando eventos importantes acontecerem,
              como contratos enviados, assinados ou reuniões agendadas.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira notificação
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active notifications */}
            {activeNotifications.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Notificações Ativas ({activeNotifications.length})</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeNotifications.map(notification => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onEdit={() => handleEditNotification(notification)}
                      onDelete={() => handleDelete(notification.id)}
                      onToggleStatus={() => handleToggleStatus(notification.id, !notification.is_active)}
                      onManageRecipients={() => handleManageRecipients(notification)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive notifications */}
            {inactiveNotifications.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-muted-foreground">
                    Notificações Inativas ({inactiveNotifications.length})
                  </h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {inactiveNotifications.map(notification => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onEdit={() => handleEditNotification(notification)}
                      onDelete={() => handleDelete(notification.id)}
                      onToggleStatus={() => handleToggleStatus(notification.id, !notification.is_active)}
                      onManageRecipients={() => handleManageRecipients(notification)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Modals */}
      <CreateNotificationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSelectTemplate={handleTemplateSelect}
      />

      <NotificationFormModal
        open={showFormModal}
        onOpenChange={setShowFormModal}
        notification={selectedNotification}
        templateType={selectedTemplateType}
        connections={connections}
        onSubmit={handleFormSubmit}
      />

      <RecipientsModal
        open={showRecipientsModal}
        onOpenChange={setShowRecipientsModal}
        notification={selectedNotification}
        onAddRecipient={addRecipient}
        onRemoveRecipient={removeRecipient}
      />
    </div>
  );
}
