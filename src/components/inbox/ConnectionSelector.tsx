import { useState, useEffect } from 'react';
import { Check, ChevronDown, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export interface WhatsAppConnectionItem {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'connecting' | 'error';
}

interface ConnectionSelectorProps {
  selectedConnectionId: string | null;
  onConnectionChange: (connectionId: string) => void;
  onNoConnections?: () => void;
}

function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Format: +55 17 98130-2530
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 12) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  return phone;
}

export function ConnectionSelector({
  selectedConnectionId,
  onConnectionChange,
  onNoConnections,
}: ConnectionSelectorProps) {
  const { profile } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function loadConnections() {
      if (!profile?.company_id) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('whatsapp_connections')
          .select('id, name, phone_number, status')
          .eq('company_id', profile.company_id)
          .eq('status', 'connected')
          .order('name');

        if (error) {
          console.error('[ConnectionSelector] Erro ao carregar conexões:', error);
          return;
        }

        const transformed: WhatsAppConnectionItem[] = (data || []).map((c) => ({
          id: c.id,
          name: c.name,
          phoneNumber: c.phone_number,
          status: c.status as WhatsAppConnectionItem['status'],
        }));

        console.log('[ConnectionSelector] Conexões encontradas:', transformed.length);
        console.log('[ConnectionSelector] selectedConnectionId atual:', selectedConnectionId);

        setConnections(transformed);

        // Se não há conexões, notificar
        if (transformed.length === 0) {
          console.log('[ConnectionSelector] Nenhuma conexão encontrada, notificando...');
          onNoConnections?.();
          return;
        }

        // Se não há conexão selecionada ou a selecionada não existe mais
        const currentConnectionExists = selectedConnectionId && transformed.find(c => c.id === selectedConnectionId);
        
        if (!currentConnectionExists) {
          // Tentar recuperar do localStorage
          const savedId = localStorage.getItem('selectedConnectionId');
          const savedConnection = savedId ? transformed.find(c => c.id === savedId) : null;
          
          if (savedConnection) {
            console.log('[ConnectionSelector] Restaurando conexão do localStorage:', savedConnection.id);
            onConnectionChange(savedConnection.id);
          } else {
            // Selecionar primeira conexão disponível
            const firstConnection = transformed[0];
            console.log('[ConnectionSelector] Setando primeira conexão automaticamente:', firstConnection.id);
            onConnectionChange(firstConnection.id);
          }
        } else {
          console.log('[ConnectionSelector] Conexão atual válida:', selectedConnectionId);
        }
      } catch (err) {
        console.error('[ConnectionSelector] Erro inesperado:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadConnections();
  }, [profile?.company_id]);

  const selectedConnection = connections.find(c => c.id === selectedConnectionId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (connections.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 h-auto py-2 px-3 bg-card border-border"
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectedConnection?.status === 'connected' ? (
              <Wifi className="w-4 h-4 text-success shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <div className="text-left min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedConnection?.name || 'Selecione uma conexão'}
              </p>
              {selectedConnection && (
                <p className="text-xs text-muted-foreground truncate">
                  {formatPhoneNumber(selectedConnection.phoneNumber)}
                </p>
              )}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-[280px] bg-popover border-border"
        sideOffset={4}
      >
        {connections.map((connection) => (
          <DropdownMenuItem
            key={connection.id}
            onClick={() => {
              onConnectionChange(connection.id);
              localStorage.setItem('selectedConnectionId', connection.id);
              setIsOpen(false);
            }}
            className={cn(
              'flex items-center gap-3 py-3 px-3 cursor-pointer',
              connection.id === selectedConnectionId && 'bg-muted'
            )}
          >
            {connection.status === 'connected' ? (
              <Wifi className="w-4 h-4 text-success shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{connection.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {formatPhoneNumber(connection.phoneNumber)}
              </p>
            </div>
            {connection.id === selectedConnectionId && (
              <Check className="w-4 h-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
