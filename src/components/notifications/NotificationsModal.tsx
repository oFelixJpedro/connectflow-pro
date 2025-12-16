import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Smartphone, CheckCheck, Bell } from 'lucide-react';
import { NotificationItem, NotificationData } from './NotificationItem';
import { NoAccessModal, AccessDeniedReason } from './NoAccessModal';
import { ConversationPreviewModal } from '@/components/crm/ConversationPreviewModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  internalNotifications: NotificationData[];
  whatsappNotifications: NotificationData[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: (source: 'internal' | 'whatsapp') => void;
}

export function NotificationsModal({
  isOpen,
  onClose,
  internalNotifications,
  whatsappNotifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationsModalProps) {
  const navigate = useNavigate();
  const { profile, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'internal' | 'whatsapp'>('whatsapp');
  const [noAccessModal, setNoAccessModal] = useState<{
    open: boolean;
    reason: AccessDeniedReason;
  }>({ open: false, reason: 'no_connection' });
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    contactId: string;
    contactName?: string;
    contactPhone?: string;
    contactAvatarUrl?: string;
  } | null>(null);

  const internalUnread = internalNotifications.filter(n => !n.isRead).length;
  const whatsappUnread = whatsappNotifications.filter(n => !n.isRead).length;


  const handleNotificationClick = useCallback(async (notification: NotificationData) => {
    // Mark as read
    onMarkAsRead(notification.id);

    // If internal chat, redirect directly
    if (notification.source === 'internal') {
      onClose();
      if (notification.roomId) {
        navigate(`/internal-chat?room=${notification.roomId}${notification.messageId ? `&message=${notification.messageId}` : ''}`);
      }
      return;
    }

    // If WhatsApp notification (mention or message), open preview modal instead of navigating
    if (notification.source === 'whatsapp' && notification.conversationId) {
      try {
        // Fetch contact data from conversation
        const { data: convData, error } = await supabase
          .from('conversations')
          .select('contact_id, contacts(id, name, phone_number, avatar_url)')
          .eq('id', notification.conversationId)
          .single();

        if (error || !convData?.contacts) {
          console.error('Error fetching conversation for preview:', error);
          return;
        }

        const contact = convData.contacts as { id: string; name: string | null; phone_number: string; avatar_url: string | null };
        
        setPreviewModal({
          open: true,
          contactId: contact.id,
          contactName: contact.name || undefined,
          contactPhone: contact.phone_number,
          contactAvatarUrl: contact.avatar_url || undefined,
        });
      } catch (err) {
        console.error('Error opening preview modal:', err);
      }
    }
  }, [navigate, onClose, onMarkAsRead]);

  const currentNotifications = activeTab === 'internal' ? internalNotifications : whatsappNotifications;
  const currentUnread = activeTab === 'internal' ? internalUnread : whatsappUnread;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificações
            </DialogTitle>
          </DialogHeader>

          <Tabs 
            value={activeTab} 
            onValueChange={(v) => setActiveTab(v as 'internal' | 'whatsapp')}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="whatsapp" className="gap-2">
                <Smartphone className="w-4 h-4" />
                WhatsApp
                {whatsappUnread > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs min-w-5">
                    {whatsappUnread > 99 ? '99+' : whatsappUnread}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="internal" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Interno
                {internalUnread > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs min-w-5">
                    {internalUnread > 99 ? '99+' : internalUnread}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0 mt-4">
              <TabsContent value="whatsapp" className="h-full mt-0">
                <NotificationList
                  notifications={whatsappNotifications}
                  onNotificationClick={handleNotificationClick}
                  onMarkAllAsRead={() => onMarkAllAsRead('whatsapp')}
                  unreadCount={whatsappUnread}
                  emptyMessage="Nenhuma notificação de WhatsApp"
                />
              </TabsContent>
              <TabsContent value="internal" className="h-full mt-0">
                <NotificationList
                  notifications={internalNotifications}
                  onNotificationClick={handleNotificationClick}
                  onMarkAllAsRead={() => onMarkAllAsRead('internal')}
                  unreadCount={internalUnread}
                  emptyMessage="Nenhuma notificação do chat interno"
                />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <NoAccessModal
        isOpen={noAccessModal.open}
        onClose={() => setNoAccessModal({ open: false, reason: 'no_connection' })}
        reason={noAccessModal.reason}
      />

      {previewModal && (
        <ConversationPreviewModal
          open={previewModal.open}
          onOpenChange={(open) => !open && setPreviewModal(null)}
          contactId={previewModal.contactId}
          contactName={previewModal.contactName}
          contactPhone={previewModal.contactPhone}
          contactAvatarUrl={previewModal.contactAvatarUrl}
          currentUserId={profile?.id}
          userRole={userRole?.role}
        />
      )}
    </>
  );
}

interface NotificationListProps {
  notifications: NotificationData[];
  onNotificationClick: (notification: NotificationData) => void;
  onMarkAllAsRead: () => void;
  unreadCount: number;
  emptyMessage: string;
}

function NotificationList({
  notifications,
  onNotificationClick,
  onMarkAllAsRead,
  unreadCount,
  emptyMessage,
}: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Bell className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {unreadCount > 0 && (
        <div className="flex justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="text-xs gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar todas como lidas
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1 max-h-[50vh]">
        <div className="space-y-1 pr-4">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={onNotificationClick}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
