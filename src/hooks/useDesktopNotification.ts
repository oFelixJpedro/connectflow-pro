import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileMetadata {
  notifications?: {
    desktopNotifications?: boolean;
    showPreview?: boolean;
  };
  [key: string]: unknown;
}

export function useDesktopNotification() {
  const { profile } = useAuth();

  const showDesktopNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const metadata = profile?.metadata as ProfileMetadata | undefined;
    if (!metadata?.notifications?.desktopNotifications) return;

    try {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    } catch (error) {
      console.error('Error showing desktop notification:', error);
    }
  }, [profile?.metadata]);

  return {
    showDesktopNotification,
  };
}
