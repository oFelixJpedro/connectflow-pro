import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronDown, Wifi, WifiOff, Loader2, Layers, Archive, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export const ALL_CONNECTIONS_ID = 'all';
export const ARCHIVED_CONNECTIONS_ID = 'archived';

export interface WhatsAppConnectionItem {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'connecting' | 'error' | 'archived';
  archivedAt?: string | null;
  archivedReason?: string | null;
}

interface ConnectionSelectorProps {
  selectedConnectionId: string | null;
  onConnectionChange: (connectionId: string) => void;
  onNoConnections?: () => void;
  /** If provided, uses these connections instead of loading from database */
  overrideConnections?: WhatsAppConnectionItem[];
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
  overrideConnections,
}: ConnectionSelectorProps) {
  console.log('🔵 ConnectionSelector - MONTOU');
  
  const { profile } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnectionItem[]>([]);
  const [archivedConnections, setArchivedConnections] = useState<WhatsAppConnectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(!overrideConnections);
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  // Memoized load function
  const loadConnections = useCallback(async (showLoading = true) => {
    if (!profile?.company_id || !profile?.id) {
      console.log('🔵 ConnectionSelector - Sem company_id ou profile_id, abortando');
      setIsLoading(false);
      return;
    }

    console.log('🔵 ConnectionSelector - Buscando conexões...');
    if (showLoading && !hasLoadedOnce.current) {
      setIsLoading(true);
    }
    
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
      let archivedData: any[] | null = null;

      // Owner and admin see all connections
      if (role === 'owner' || role === 'admin') {
        // Active connections
        const { data: connectionsData, error } = await supabase
          .from('whatsapp_connections')
          .select('id, name, phone_number, status, archived_at, archived_reason')
          .eq('company_id', profile.company_id)
          .eq('status', 'connected')
          .is('archived_at', null)
          .order('name');

        if (error) {
          console.error('🔵 ConnectionSelector - ERRO na query:', error);
          return;
        }
        data = connectionsData;
        
        // Archived connections (for owners/admins only)
        const { data: archived } = await supabase
          .from('whatsapp_connections')
          .select('id, name, phone_number, status, archived_at, archived_reason')
          .eq('company_id', profile.company_id)
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false });
        
        archivedData = archived;
      } else {
        // Agents and viewers: only show connections where they have explicit access
        const { data: userAssignments, error: assignmentsError } = await supabase
          .from('connection_users')
          .select('connection_id')
          .eq('user_id', profile.id);

        if (assignmentsError) {
          console.error('🔵 ConnectionSelector - ERRO ao buscar atribuições:', assignmentsError);
        }

        console.log('🔵 ConnectionSelector - Atribuições do usuário:', userAssignments);

        // If user has no assignments, they have no access
        if (!userAssignments || userAssignments.length === 0) {
          console.log('🔵 ConnectionSelector - Usuário sem atribuições, sem conexões disponíveis');
          data = [];
        } else {
          // Get only connections the user has explicit access to
          const connectionIds = userAssignments.map(a => a.connection_id);
          
          const { data: connectionsData, error: connectionsError } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number, status')
            .eq('company_id', profile.company_id)
            .eq('status', 'connected')
            .is('archived_at', null)
            .in('id', connectionIds)
            .order('name');

          if (connectionsError) {
            console.error('🔵 ConnectionSelector - ERRO na query:', connectionsError);
            return;
          }

          data = connectionsData;
        }

        // Clean up localStorage if non-admin has archived/all selection saved
        const savedId = localStorage.getItem('selectedConnectionId');
        if (savedId === ARCHIVED_CONNECTIONS_ID || savedId === ALL_CONNECTIONS_ID) {
          // Check if they have archived connections access (they don't if not admin)
          localStorage.removeItem('selectedConnectionId');
          console.log('🔵 ConnectionSelector - Limpando seleção inválida do localStorage');
        }

        console.log('🔵 ConnectionSelector - Conexões disponíveis para o usuário:', data?.length || 0);
      }

      console.log('🔵 ConnectionSelector - Query executada:', { data });

      const transformed: WhatsAppConnectionItem[] = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phone_number,
        status: c.status as WhatsAppConnectionItem['status'],
      }));

      const archivedTransformed: WhatsAppConnectionItem[] = (archivedData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phone_number,
        status: 'archived' as const,
        archivedAt: c.archived_at,
        archivedReason: c.archived_reason,
      }));

      console.log('🔵 ConnectionSelector - Conexões encontradas:', transformed.length);
      console.log('🔵 ConnectionSelector - Conexões arquivadas:', archivedTransformed.length);
      console.log('🔵 ConnectionSelector - selectedConnectionId atual:', selectedConnectionId);

      setConnections(transformed);
      setArchivedConnections(archivedTransformed);
      hasLoadedOnce.current = true;

      if (transformed.length === 0 && archivedTransformed.length === 0) {
        console.log('🔵 ConnectionSelector - Nenhuma conexão, chamando onNoConnections');
        onNoConnections?.();
        return;
      }

      const currentConnectionExists = selectedConnectionId && 
        (transformed.find(c => c.id === selectedConnectionId) || 
         archivedTransformed.find(c => c.id === selectedConnectionId) ||
         selectedConnectionId === ALL_CONNECTIONS_ID ||
         selectedConnectionId === ARCHIVED_CONNECTIONS_ID);
      
      if (!currentConnectionExists && transformed.length > 0) {
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
  }, [profile?.company_id, profile?.id, selectedConnectionId, onConnectionChange, onNoConnections]);

  // If overrideConnections is provided, use it instead of loading
  useEffect(() => {
    if (overrideConnections) {
      setConnections(overrideConnections);
      setIsLoading(false);
      
      if (overrideConnections.length === 0) {
        onNoConnections?.();
        return;
      }

      const currentConnectionExists = selectedConnectionId && 
        overrideConnections.find(c => c.id === selectedConnectionId);
      
      if (!currentConnectionExists && overrideConnections.length > 0) {
        onConnectionChange(overrideConnections[0].id);
      }
    }
  }, [overrideConnections, selectedConnectionId, onConnectionChange, onNoConnections]);

  // Initial load
  useEffect(() => {
    if (overrideConnections) return;
    console.log('🔵 ConnectionSelector - useEffect EXECUTANDO', { 
      companyId: profile?.company_id,
      selectedConnectionId 
    });
    loadConnections();
  }, [profile?.company_id, profile?.id]);

  // Realtime subscription to auto-update when connections change
  useEffect(() => {
    if (overrideConnections || !profile?.company_id) return;

    console.log('🔵 ConnectionSelector - Configurando realtime subscription');
    
    const channel = supabase
      .channel('connection-selector-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_connections',
          filter: `company_id=eq.${profile.company_id}`
        },
        (payload) => {
          console.log('🔵 ConnectionSelector - Realtime update recebido:', payload.eventType);
          // Reload connections without showing loading spinner
          loadConnections(false);
        }
      )
      .subscribe();

    return () => {
      console.log('🔵 ConnectionSelector - Removendo realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, overrideConnections, loadConnections]);

  // Refetch on dropdown open (fallback)
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open && !overrideConnections && hasLoadedOnce.current) {
      // Reload without loading spinner when opening dropdown
      loadConnections(false);
    }
  }, [overrideConnections, loadConnections]);

  const selectedConnection = selectedConnectionId === ALL_CONNECTIONS_ID || selectedConnectionId === ARCHIVED_CONNECTIONS_ID
    ? null 
    : connections.find(c => c.id === selectedConnectionId) || archivedConnections.find(c => c.id === selectedConnectionId);
  const isAllSelected = selectedConnectionId === ALL_CONNECTIONS_ID;
  const isArchivedSelected = selectedConnectionId === ARCHIVED_CONNECTIONS_ID;
  const selectedArchivedConnection = archivedConnections.find(c => c.id === selectedConnectionId);

  console.log('🔵 ConnectionSelector - RENDER', { isLoading, connectionsCount: connections.length, selectedConnection: selectedConnection?.name, isAllSelected });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (connections.length === 0 && archivedConnections.length === 0) {
    console.log('🔵 ConnectionSelector - Sem conexões disponíveis');
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
        <WifiOff className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Sem conexão disponível</span>
      </div>
    );
  }

  // Só mostra opção "Todas" se houver mais de 1 conexão ativa
  const showAllOption = connections.length > 1;
  const showArchivedOption = archivedConnections.length > 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 h-auto py-2 px-3 bg-card border-border"
        >
          <div className="flex items-center gap-2 min-w-0">
            {isAllSelected ? (
              <Layers className="w-4 h-4 text-primary shrink-0" />
            ) : isArchivedSelected ? (
              <Archive className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : selectedArchivedConnection ? (
              <div className="relative">
                <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
              </div>
            ) : selectedConnection?.status === 'connected' ? (
              <Wifi className="w-4 h-4 text-success shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <div className="text-left min-w-0">
              <p className={cn(
                "text-sm font-medium truncate",
                selectedArchivedConnection && "line-through text-muted-foreground"
              )}>
                {isAllSelected ? 'Todas as conexões' : isArchivedSelected ? 'Desconectadas' : selectedConnection?.name || 'Selecione uma conexão'}
              </p>
              {isAllSelected ? (
                <p className="text-xs text-muted-foreground truncate">
                  {connections.length} conexões disponíveis
                </p>
              ) : isArchivedSelected ? (
                <p className="text-xs text-muted-foreground truncate">
                  {archivedConnections.length} conexões arquivadas
                </p>
              ) : selectedConnection && (
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
        {showAllOption && (
          <>
            <DropdownMenuItem
              onClick={() => {
                onConnectionChange(ALL_CONNECTIONS_ID);
                localStorage.setItem('selectedConnectionId', ALL_CONNECTIONS_ID);
                setIsOpen(false);
              }}
              className={cn(
                'flex items-center gap-3 py-3 px-3 cursor-pointer',
                isAllSelected && 'bg-muted'
              )}
            >
              <Layers className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Todas as conexões</p>
                <p className="text-xs text-muted-foreground truncate">
                  Ver todas as conversas
                </p>
              </div>
              {isAllSelected && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
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
        
        {/* Archived connections section - Using submenu */}
        {showArchivedOption && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger 
                className={cn(
                  'flex items-center gap-3 py-3 px-3 cursor-pointer',
                  (isArchivedSelected || selectedArchivedConnection) && 'bg-muted'
                )}
              >
                <Archive className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-muted-foreground">
                    Desconectadas ({archivedConnections.length})
                  </p>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent 
                className="w-[260px] max-h-[300px] overflow-y-auto bg-popover border-border"
                sideOffset={4}
              >
                {/* Option to see all archived */}
                <DropdownMenuItem
                  onClick={() => {
                    onConnectionChange(ARCHIVED_CONNECTIONS_ID);
                    localStorage.setItem('selectedConnectionId', ARCHIVED_CONNECTIONS_ID);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-3 py-2 px-3 cursor-pointer',
                    isArchivedSelected && 'bg-muted'
                  )}
                >
                  <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-muted-foreground">
                      Todas as desconectadas
                    </p>
                  </div>
                  {isArchivedSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* Individual archived connections */}
                {archivedConnections.map((connection) => (
                  <DropdownMenuItem
                    key={connection.id}
                    onClick={() => {
                      onConnectionChange(connection.id);
                      localStorage.setItem('selectedConnectionId', connection.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-3 py-2 px-3 cursor-pointer',
                      connection.id === selectedConnectionId && 'bg-muted'
                    )}
                  >
                    <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate line-through text-muted-foreground">
                        {connection.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {connection.phoneNumber === 'Aguardando...' ? 'Arquivada' : formatPhoneNumber(connection.phoneNumber)}
                      </p>
                    </div>
                    {connection.id === selectedConnectionId && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
