import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { CalendarGoogleToken } from '@/types/calendar';

export function useGoogleCalendar() {
  const { profile, userRole } = useAuth();
  const [googleConnection, setGoogleConnection] = useState<CalendarGoogleToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Verificar se é admin/owner
  const canManageConnection = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Carregar status da conexão
  const loadConnection = useCallback(async () => {
    if (!profile?.company_id || !canManageConnection) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('calendar_google_tokens')
        .select('id, company_id, google_email, connected_by, created_at, updated_at')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (error) throw error;
      setGoogleConnection(data);
    } catch (err) {
      console.error('Erro ao verificar conexão Google:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.company_id, canManageConnection]);

  // Iniciar fluxo OAuth
  const connectGoogle = useCallback(async () => {
    if (!canManageConnection) {
      toast.error('Apenas administradores podem conectar o Google Calendar');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'authorize' },
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Abrir popup para autenticação
        window.open(data.authUrl, 'google-auth', 'width=500,height=600');
      }
    } catch (err) {
      console.error('Erro ao iniciar conexão Google:', err);
      toast.error('Erro ao conectar com Google Calendar');
    }
  }, [canManageConnection]);

  // Desconectar Google Calendar
  const disconnectGoogle = useCallback(async () => {
    if (!profile?.company_id || !canManageConnection) {
      toast.error('Apenas administradores podem desconectar o Google Calendar');
      return;
    }

    try {
      const { error } = await supabase
        .from('calendar_google_tokens')
        .delete()
        .eq('company_id', profile.company_id);

      if (error) throw error;

      setGoogleConnection(null);
      toast.success('Google Calendar desconectado');
    } catch (err) {
      console.error('Erro ao desconectar Google:', err);
      toast.error('Erro ao desconectar Google Calendar');
    }
  }, [profile?.company_id, canManageConnection]);

  // Sincronizar eventos manualmente
  const syncEvents = useCallback(async () => {
    if (!googleConnection) {
      toast.error('Google Calendar não está conectado');
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'sync' },
      });

      if (error) throw error;

      toast.success(`Sincronização concluída! ${data?.synced || 0} eventos sincronizados.`);
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
      toast.error('Erro ao sincronizar com Google Calendar');
    } finally {
      setIsSyncing(false);
    }
  }, [googleConnection]);

  // Carregar conexão inicial
  useEffect(() => {
    loadConnection();
  }, [loadConnection]);

  // Listener para mensagens do popup OAuth
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-calendar-connected') {
        loadConnection();
        toast.success('Google Calendar conectado com sucesso!');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadConnection]);

  return {
    googleConnection,
    isConnected: !!googleConnection,
    isLoading,
    isSyncing,
    canManageConnection,
    connectGoogle,
    disconnectGoogle,
    syncEvents,
    refreshConnection: loadConnection,
  };
}
