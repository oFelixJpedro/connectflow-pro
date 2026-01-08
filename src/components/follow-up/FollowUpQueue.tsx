import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Clock, User, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactAvatar } from '@/components/ui/contact-avatar';
import type { FollowUpQueueItem } from '@/types/follow-up';

export function FollowUpQueue() {
  const { profile } = useAuth();
  const [queueItems, setQueueItems] = useState<FollowUpQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQueue = async () => {
    if (!profile?.company_id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('follow_up_queue')
        .select(`
          *,
          contact:contacts(id, name, phone_number, avatar_url),
          sequence:follow_up_sequences(id, name, follow_up_type)
        `)
        .eq('company_id', profile.company_id)
        .in('status', ['pending', 'processing'])
        .order('scheduled_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setQueueItems(data as FollowUpQueueItem[]);
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [profile?.company_id]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('followup-queue-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_queue',
          filter: `company_id=eq.${profile.company_id}`
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Aguardando</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Processando</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fila de Follow-ups</h2>
          <p className="text-sm text-muted-foreground">
            {queueItems.length} follow-ups aguardando envio
          </p>
        </div>
        <Button variant="outline" onClick={fetchQueue}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Queue List */}
      {queueItems.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum follow-up na fila</p>
            <p className="text-sm text-muted-foreground mt-1">
              Os follow-ups programados aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queueItems.map((item) => (
            <Card key={item.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <ContactAvatar
                    name={item.contact?.name || 'Contato'}
                    imageUrl={item.contact?.avatar_url}
                    size="md"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground truncate">
                        {item.contact?.name || item.contact?.phone_number || 'Contato'}
                      </h4>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {(item.sequence as any)?.name || 'Sequência'}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {formatDistanceToNow(new Date(item.scheduled_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(item.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
