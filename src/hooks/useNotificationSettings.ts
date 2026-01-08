import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  WhatsAppNotification,
  WhatsAppNotificationRecipient,
  CreateNotificationData,
  UpdateNotificationData
} from '@/types/notifications';

interface Connection {
  id: string;
  phone_number: string | null;
  name: string | null;
}

export function useNotificationSettings() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setIsLoading(true);

      // Load notifications with recipients
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('whatsapp_notifications')
        .select(`
          *,
          whatsapp_notification_recipients (*)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      // Load connections for each notification
      const connectionIds = [...new Set(notificationsData?.map(n => n.connection_id) || [])];
      
      let connectionsMap: Record<string, Connection> = {};
      if (connectionIds.length > 0) {
        const { data: connectionsData } = await supabase
          .from('whatsapp_connections')
          .select('id, phone_number, name')
          .in('id', connectionIds);
        
        if (connectionsData) {
          connectionsMap = connectionsData.reduce((acc, conn) => {
            acc[conn.id] = conn;
            return acc;
          }, {} as Record<string, Connection>);
        }
      }

      // Map notifications with their connections and recipients
      const mappedNotifications: WhatsAppNotification[] = (notificationsData || []).map(n => ({
        ...n,
        notification_type: n.notification_type as WhatsAppNotification['notification_type'],
        recipients: n.whatsapp_notification_recipients || [],
        connection: connectionsMap[n.connection_id] || undefined
      }));

      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Erro ao carregar notificações');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.company_id]);

  const loadConnections = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, phone_number, name')
        .eq('company_id', profile.company_id)
        .eq('status', 'connected');

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  }, [profile?.company_id]);

  const createNotification = async (data: CreateNotificationData): Promise<WhatsAppNotification | null> => {
    if (!profile?.company_id || !profile?.id) {
      toast.error('Usuário não autenticado');
      return null;
    }

    try {
      const { data: newNotification, error } = await supabase
        .from('whatsapp_notifications')
        .insert({
          company_id: profile.company_id,
          name: data.name,
          notification_type: data.notification_type,
          message_template: data.message_template,
          connection_id: data.connection_id,
          created_by: profile.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Notificação criada com sucesso!');
      await loadNotifications();
      return newNotification as WhatsAppNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      toast.error('Erro ao criar notificação');
      return null;
    }
  };

  const updateNotification = async (id: string, data: UpdateNotificationData): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('whatsapp_notifications')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Notificação atualizada com sucesso!');
      await loadNotifications();
      return true;
    } catch (error) {
      console.error('Error updating notification:', error);
      toast.error('Erro ao atualizar notificação');
      return false;
    }
  };

  const deleteNotification = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('whatsapp_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Notificação excluída com sucesso!');
      await loadNotifications();
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Erro ao excluir notificação');
      return false;
    }
  };

  const toggleNotificationStatus = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateNotification(id, { is_active: isActive });
  };

  // Recipient management
  const addRecipient = async (
    notificationId: string,
    phoneNumber: string,
    name?: string
  ): Promise<WhatsAppNotificationRecipient | null> => {
    try {
      // Format phone number
      const formattedPhone = phoneNumber.replace(/\D/g, '');
      
      const { data, error } = await supabase
        .from('whatsapp_notification_recipients')
        .insert({
          notification_id: notificationId,
          phone_number: formattedPhone,
          name: name || null
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Destinatário adicionado!');
      await loadNotifications();
      return data;
    } catch (error) {
      console.error('Error adding recipient:', error);
      toast.error('Erro ao adicionar destinatário');
      return null;
    }
  };

  const updateRecipient = async (
    id: string,
    data: { phone_number?: string; name?: string; is_active?: boolean }
  ): Promise<boolean> => {
    try {
      const updateData = { ...data };
      if (data.phone_number) {
        updateData.phone_number = data.phone_number.replace(/\D/g, '');
      }

      const { error } = await supabase
        .from('whatsapp_notification_recipients')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Destinatário atualizado!');
      await loadNotifications();
      return true;
    } catch (error) {
      console.error('Error updating recipient:', error);
      toast.error('Erro ao atualizar destinatário');
      return false;
    }
  };

  const removeRecipient = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('whatsapp_notification_recipients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Destinatário removido!');
      await loadNotifications();
      return true;
    } catch (error) {
      console.error('Error removing recipient:', error);
      toast.error('Erro ao remover destinatário');
      return false;
    }
  };

  useEffect(() => {
    loadNotifications();
    loadConnections();
  }, [loadNotifications, loadConnections]);

  return {
    notifications,
    connections,
    isLoading,
    refresh: loadNotifications,
    createNotification,
    updateNotification,
    deleteNotification,
    toggleNotificationStatus,
    addRecipient,
    updateRecipient,
    removeRecipient
  };
}
