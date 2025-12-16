import { useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileMetadata {
  notifications?: {
    soundEnabled?: boolean;
    soundVolume?: number;
    whatsappSound?: boolean;
    internalChatSound?: boolean;
    mentionSound?: boolean;
    desktopNotifications?: boolean;
    showPreview?: boolean;
  };
  [key: string]: unknown;
}

const defaultSettings = {
  soundEnabled: true,
  soundVolume: 70,
  whatsappSound: true,
  internalChatSound: true,
  mentionSound: true,
};

export function useNotificationSound() {
  const { profile } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load settings from profile metadata
  const settings = useMemo(() => {
    if (!profile?.metadata) return defaultSettings;
    
    const metadata = profile.metadata as ProfileMetadata;
    return {
      ...defaultSettings,
      ...metadata.notifications,
    };
  }, [profile?.metadata]);

  const playSound = useCallback((type: 'whatsapp' | 'internal' | 'mention') => {
    if (!settings.soundEnabled) return;

    // Check if this specific sound type is enabled
    const soundMap: Record<typeof type, boolean> = {
      whatsapp: settings.whatsappSound ?? true,
      internal: settings.internalChatSound ?? true,
      mention: settings.mentionSound ?? true,
    };

    if (!soundMap[type]) return;

    try {
      // Create audio element if needed
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/notification.mp3');
      }

      // Set volume (0-1 range)
      audioRef.current.volume = (settings.soundVolume ?? 70) / 100;
      
      // Reset and play
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        // Browser may block autoplay
        console.warn('Could not play notification sound:', error);
      });
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [settings]);

  // Show desktop notification
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
    playSound,
    showDesktopNotification,
    settings,
  };
}
