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
  console.log('🔵 ConnectionSelector - MONTOU');
  
  const { profile } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔵 ConnectionSelector - useEffect EXECUTANDO', { 
      companyId: profile?.company_id,
      selectedConnectionId 
    });

    async function loadConnections() {
      if (!profile?.company_id || !profile?.id) {
        console.log('🔵 ConnectionSelector - Sem company_id ou profile_id, abortando');
        setIsLoading(false);
        return;
      }

      console.log('🔵 ConnectionSelector - Buscando conexões...');
      setIsLoading(true);
      
      try {
        // First, get the user's role
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id)
          .single();

        if (roleError) {
          console.error('🔵 ConnectionSelector - ERRO ao buscar role:', roleError);
        }

        const role = roleData?.role || 'agent';
        setUserRole(role);
        console.log('🔵 ConnectionSelector - Role do usuário:', role);

        let data: any[] | null = null;

        // Owner and admin see all connections
        if (role === 'owner' || role === 'admin') {
          const { data: connectionsData, error } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number, status')
            .eq('company_id', profile.company_id)
            .eq('status', 'connected')
            .order('name');

          if (error) {
            console.error('🔵 ConnectionSelector - ERRO na query:', error);
            return;
          }
          data = connectionsData;
        } else {
          // Agents and viewers: check for explicit assignments first
          const { data: assignmentsData, error: assignmentsError } = await supabase
            .from('connection_users')
            .select('connection_id')
            .eq('user_id', profile.id);

          if (assignmentsError) {
            console.error('🔵 ConnectionSelector - ERRO ao buscar atribuições:', assignmentsError);
          }

          console.log('🔵 ConnectionSelector - Atribuições do usuário:', assignmentsData);

          if (assignmentsData && assignmentsData.length > 0) {
            // User has explicit assignments - only show those connections
            const connectionIds = assignmentsData.map(a => a.connection_id);
            
            const { data: connectionsData, error } = await supabase
              .from('whatsapp_connections')
              .select('id, name, phone_number, status')
              .eq('company_id', profile.company_id)
              .eq('status', 'connected')
              .in('id', connectionIds)
              .order('name');

            if (error) {
              console.error('🔵 ConnectionSelector - ERRO na query:', error);
              return;
            }
            data = connectionsData;
          } else {
            // User has no explicit assignments
            // For each connection, check if that specific connection has any assignments
            // If a connection has assignments and user is not in them, hide it
            // If a connection has no assignments, show it (legacy behavior per connection)
            
            console.log('🔵 ConnectionSelector - Usuário sem atribuições, verificando por conexão');
            
            // Get all connected connections
            const { data: allConnections, error: allConnectionsError } = await supabase
              .from('whatsapp_connections')
              .select('id, name, phone_number, status')
              .eq('company_id', profile.company_id)
              .eq('status', 'connected')
              .order('name');

            if (allConnectionsError) {
              console.error('🔵 ConnectionSelector - ERRO na query:', allConnectionsError);
              return;
            }

            // Get all connection_users to check which connections have assignments
            const { data: allAssignments, error: allAssignmentsError } = await supabase
              .from('connection_users')
              .select('connection_id');

            if (allAssignmentsError) {
              console.error('🔵 ConnectionSelector - ERRO ao buscar atribuições:', allAssignmentsError);
            }

            // Create set of connection IDs that have assignments
            const connectionsWithAssignments = new Set(
              (allAssignments || []).map(a => a.connection_id)
            );

            // Filter: show connections that have NO assignments (legacy behavior)
            data = (allConnections || []).filter(conn => !connectionsWithAssignments.has(conn.id));
            
            console.log('🔵 ConnectionSelector - Conexões com atribuições:', connectionsWithAssignments.size);
            console.log('🔵 ConnectionSelector - Conexões disponíveis (sem atribuições):', data.length);
          }
        }

        console.log('🔵 ConnectionSelector - Query executada:', { data });

        const transformed: WhatsAppConnectionItem[] = (data || []).map((c) => ({
          id: c.id,
          name: c.name,
          phoneNumber: c.phone_number,
          status: c.status as WhatsAppConnectionItem['status'],
        }));

        console.log('🔵 ConnectionSelector - Conexões encontradas:', transformed.length);
        console.log('🔵 ConnectionSelector - selectedConnectionId atual:', selectedConnectionId);

        setConnections(transformed);

        if (transformed.length === 0) {
          console.log('🔵 ConnectionSelector - Nenhuma conexão, chamando onNoConnections');
          onNoConnections?.();
          return;
        }

        const currentConnectionExists = selectedConnectionId && transformed.find(c => c.id === selectedConnectionId);
        
        if (!currentConnectionExists) {
          const savedId = localStorage.getItem('selectedConnectionId');
          const savedConnection = savedId ? transformed.find(c => c.id === savedId) : null;
          
          if (savedConnection) {
            console.log('🔵 ConnectionSelector - SETANDO do localStorage:', savedConnection.id);
            onConnectionChange(savedConnection.id);
          } else {
            console.log('🔵 ConnectionSelector - SETANDO primeira conexão:', transformed[0].id);
            onConnectionChange(transformed[0].id);
          }
        } else {
          console.log('🔵 ConnectionSelector - Conexão atual válida:', selectedConnectionId);
        }
      } catch (err) {
        console.error('🔵 ConnectionSelector - Erro inesperado:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadConnections();
  }, [profile?.company_id, profile?.id, onConnectionChange, onNoConnections]);

  const selectedConnection = connections.find(c => c.id === selectedConnectionId);

  console.log('🔵 ConnectionSelector - RENDER', { isLoading, connectionsCount: connections.length, selectedConnection: selectedConnection?.name });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (connections.length === 0) {
    console.log('🔵 ConnectionSelector - Retornando NULL (sem conexões)');
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
