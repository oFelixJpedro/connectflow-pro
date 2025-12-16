import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NotificationSettings {
  // Sons
  soundEnabled: boolean;
  soundVolume: number;
  whatsappSound: boolean;
  internalChatSound: boolean;
  mentionSound: boolean;
  
  // Visuais
  desktopNotifications: boolean;
  showPreview: boolean;
  
  // Filtros
  notifyOnlyMentions: boolean;
  notifyOnlyAssigned: boolean;
}

const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  soundVolume: 70,
  whatsappSound: true,
  internalChatSound: true,
  mentionSound: true,
  desktopNotifications: false,
  showPreview: true,
  notifyOnlyMentions: false,
  notifyOnlyAssigned: false,
};

interface ProfileMetadata {
  notifications?: NotificationSettings;
  [key: string]: unknown;
}

export function useNotificationSettings() {
  const { profile, updateProfile } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Load settings from profile metadata
  useEffect(() => {
    if (profile?.metadata) {
      const metadata = profile.metadata as ProfileMetadata;
      if (metadata.notifications) {
        setSettings(prev => ({ ...prev, ...metadata.notifications }));
      }
    }
    
    // Check current notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [profile?.metadata]);

  // Request desktop notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Seu navegador não suporta notificações');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        toast.success('Notificações ativadas!');
        setSettings(prev => ({ ...prev, desktopNotifications: true }));
      } else if (permission === 'denied') {
        toast.error('Permissão de notificações negada');
        setSettings(prev => ({ ...prev, desktopNotifications: false }));
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Erro ao solicitar permissão');
    }
  }, []);

  // Save settings to profile metadata
  const saveSettings = useCallback(async (newSettings: NotificationSettings) => {
    if (!profile?.id) return;

    setIsSaving(true);
    try {
      const currentMetadata = (profile.metadata as ProfileMetadata) || {};
      const updatedMetadata: Record<string, unknown> = {
        ...currentMetadata,
        notifications: { ...newSettings },
      };

      const { error } = await supabase
        .from('profiles')
        .update({ metadata: updatedMetadata as any })
        .eq('id', profile.id);

      if (error) throw error;

      setSettings(newSettings);
      toast.success('Configurações de notificação salvas');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  }, [profile?.id, profile?.metadata]);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    settings,
    isSaving,
    notificationPermission,
    updateSetting,
    saveSettings,
    requestNotificationPermission,
    defaultSettings,
  };
}
