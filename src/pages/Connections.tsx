import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  QrCode,
  Settings,
  Trash2,
  MoreHorizontal,
  Loader2,
  X,
  Users,
  AlertTriangle,
  Upload
} from 'lucide-react';
import { ImportConversationsModal } from '@/components/connections/ImportConversationsModal';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ConnectionLimitReachedModal } from '@/components/subscription/ConnectionLimitReachedModal';
import type { Tables } from '@/integrations/supabase/types';

type WhatsAppConnection = Tables<'whatsapp_connections'>;

type DialogStep = 'name' | 'qr' | 'connecting';

export default function Connections() {
  const { company, session, userRole } = useAuth();

  // Define isAdminOrOwner early but don't return yet (hooks must run first)
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Connection limit state
  const [showLimitModal, setShowLimitModal] = useState(false);
  const maxConnections = (company as any)?.max_connections ?? 1;
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<DialogStep>('name');
  const [connectionName, setConnectionName] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [currentConnectionId, setCurrentConnectionId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Settings dialog state
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [selectedConnectionForSettings, setSelectedConnectionForSettings] = useState<WhatsAppConnection | null>(null);
  
  // Import conversations modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedConnectionForImport, setSelectedConnectionForImport] = useState<WhatsAppConnection | null>(null);
  
  // Archive confirmation dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [connectionToArchive, setConnectionToArchive] = useState<WhatsAppConnection | null>(null);
  
  // Permanent delete confirmation state
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<WhatsAppConnection | null>(null);

  useEffect(() => {
    if (company?.id) {
      loadConnections();
    }
  }, [company?.id]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Check permissions - redirect non-admins (must be after all hooks)
  if (!isAdminOrOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  async function loadConnections() {
    if (!company?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Error loading connections:', error);
      toast.error('Erro ao carregar conexões');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateQR() {
    console.log('🔍 [QR CODE] ========== INICIANDO GERAÇÃO DE QR CODE ==========');
    console.log('🔍 [QR CODE] Company ID:', company?.id);
    console.log('🔍 [QR CODE] Connection Name:', connectionName);
    
    if (!company?.id || !connectionName.trim()) {
      console.log('❌ [QR CODE] Validação falhou - company ou nome vazio');
      toast.error('Digite um nome para a conexão');
      return;
    }

    setIsProcessing(true);
    const sessionId = `${company.id.slice(0, 8)}-${Date.now()}`;
    console.log('🔍 [QR CODE] Session ID gerado:', sessionId);

    try {
      // 1. Create connection record in database
      console.log('📡 [API] Criando registro no banco de dados...');
      const { data: newConnection, error: insertError } = await supabase
        .from('whatsapp_connections')
        .insert({
          company_id: company.id,
          name: connectionName.trim(),
          session_id: sessionId,
          phone_number: 'Aguardando...',
          status: 'connecting'
        })
        .select()
        .single();

      if (insertError) {
        console.log('❌ [API] Erro ao criar registro:', insertError);
        throw insertError;
      }
      console.log('✅ [API] Registro criado:', newConnection);

      setCurrentConnectionId(newConnection.id);
      setCurrentSessionId(sessionId);

      // 2. Call edge function to init instance
      console.log('📡 [API] Chamando edge function whatsapp-instance com action: init');
      console.log('📡 [API] Payload:', { action: 'init', instanceName: sessionId });
      
      const { data: initData, error: initError } = await supabase.functions.invoke('whatsapp-instance', {
        body: {
          action: 'init',
          instanceName: sessionId
        }
      });

      console.log('📡 [API] Response completo:', initData);
      console.log('📡 [API] Error:', initError);

      if (initError) {
        console.log('❌ [API] Erro na edge function:', initError);
        throw initError;
      }

      console.log('🔍 [QR CODE] QR Code recebido?', !!initData?.qrCode);
      console.log('🔍 [QR CODE] QR Code (primeiros 100 chars):', initData?.qrCode?.substring(0, 100));

      if (initData.qrCode) {
        // Update connection with QR code
        console.log('📡 [API] Atualizando conexão com QR code...');
        await supabase
          .from('whatsapp_connections')
          .update({ 
            qr_code: initData.qrCode,
            status: 'qr_ready' 
          })
          .eq('id', newConnection.id);

        console.log('✅ [QR CODE] QR Code salvo no state');
        setQrCode(initData.qrCode);
        setDialogStep('qr');
        console.log('✅ [QR CODE] Dialog step alterado para: qr');
        console.log('⏱️ [POLLING] Iniciando polling...');
        startPolling(newConnection.id, sessionId);
      } else {
        console.log('❌ [QR CODE] QR code não recebido na resposta');
        throw new Error('QR code não recebido');
      }

    } catch (error: any) {
      console.error('❌ [QR CODE] Erro geral:', error);
      toast.error(error.message || 'Erro ao gerar QR Code');
      
      // Cleanup on error
      if (currentConnectionId) {
        await supabase
          .from('whatsapp_connections')
          .delete()
          .eq('id', currentConnectionId);
      }
    } finally {
      setIsProcessing(false);
      console.log('🔍 [QR CODE] ========== FIM DA GERAÇÃO ==========');
    }
  }

  function startPolling(connectionId: string, sessionId: string) {
    console.log('⏱️ [POLLING] ========== INICIANDO POLLING ==========');
    console.log('⏱️ [POLLING] Connection ID:', connectionId);
    console.log('⏱️ [POLLING] Session ID:', sessionId);
    console.log('⏱️ [POLLING] Intervalo: 3 segundos');
    
    // Clear any existing polling
    if (pollIntervalRef.current) {
      console.log('⏱️ [POLLING] Limpando polling anterior');
      clearInterval(pollIntervalRef.current);
    }
    if (timeoutRef.current) {
      console.log('⏱️ [POLLING] Limpando timeout anterior');
      clearTimeout(timeoutRef.current);
    }

    let pollCount = 0;

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      pollCount++;
      console.log(`⏱️ [POLLING] ===== Poll #${pollCount} =====`);
      console.log('⏱️ [POLLING] Timestamp:', new Date().toISOString());
      
      try {
        // Check status via edge function
        console.log('📡 [API] Chamando status check...');
        console.log('📡 [API] Payload:', { action: 'status', instanceName: sessionId });
        
        const { data: statusData, error: statusError } = await supabase.functions.invoke('whatsapp-instance', {
          body: {
            action: 'status',
            instanceName: sessionId
          }
        });

        console.log('📡 [API] Status Response COMPLETO:', JSON.stringify(statusData, null, 2));
        console.log('📡 [API] Status Error:', statusError);
        
        if (statusData) {
          console.log('🔍 [STATUS CHECK] Analisando resposta...');
          console.log('🔍 [STATUS CHECK] statusData.status:', statusData.status);
          console.log('🔍 [STATUS CHECK] statusData.connected:', statusData.connected);
          console.log('🔍 [STATUS CHECK] statusData.phoneNumber:', statusData.phoneNumber);
          console.log('🔍 [STATUS CHECK] statusData.instance:', statusData.instance);
          console.log('🔍 [STATUS CHECK] Todas as chaves:', Object.keys(statusData));
          
          const isConnected = statusData?.status === 'open' || statusData?.status === 'connected';
          console.log('🔍 [STATUS CHECK] Condição: status === "open" || status === "connected"');
          console.log('🔍 [STATUS CHECK] Resultado isConnected:', isConnected);
          
          if (isConnected) {
            console.log('✅ [STATUS CHECK] CONEXÃO DETECTADA!');
            console.log('⚠️ [QR CODE] Vai esconder QR Code!');
            console.log('⚠️ [QR CODE] Motivo: Status indica conexão estabelecida');
            console.log('⚠️ [QR CODE] Status que causou:', statusData.status);
            
            // Connected! Update database
            console.log('📡 [API] Atualizando banco de dados...');
            const connectedPhoneNumber = statusData.phoneNumber || 'Conectado';
            const normalizedNewPhone = connectedPhoneNumber.replace(/\D/g, '');
            
            await supabase
              .from('whatsapp_connections')
              .update({ 
                status: 'connected',
                phone_number: connectedPhoneNumber,
                qr_code: null,
                last_connected_at: new Date().toISOString(),
                original_phone_normalized: normalizedNewPhone
              })
              .eq('id', connectionId);

            console.log('✅ [API] Banco atualizado');
            
            // ═══════════════════════════════════════════════════════════════
            // 🔄 AUTO-MIGRATE: Check if same number was previously archived
            // ═══════════════════════════════════════════════════════════════
            if (normalizedNewPhone && normalizedNewPhone.length >= 10 && company?.id) {
              console.log('🔍 [AUTO-MIGRATE] Verificando se há conexão arquivada com mesmo número:', normalizedNewPhone);
              
              const { data: archivedConnection } = await supabase
                .from('whatsapp_connections')
                .select('id, name')
                .eq('company_id', company.id)
                .eq('original_phone_normalized', normalizedNewPhone)
                .not('archived_at', 'is', null)
                .neq('id', connectionId)
                .limit(1)
                .maybeSingle();
              
              if (archivedConnection) {
                console.log('🔄 [AUTO-MIGRATE] Conexão arquivada encontrada:', archivedConnection.name);
                console.log('🔄 [AUTO-MIGRATE] Migrando todas as conversas...');
                
                // Count conversations to migrate
                const { count: conversationsCount } = await supabase
                  .from('conversations')
                  .select('*', { count: 'exact', head: true })
                  .eq('whatsapp_connection_id', archivedConnection.id);
                
                // Migrate all conversations to new connection
                const { error: migrateError } = await supabase
                  .from('conversations')
                  .update({ whatsapp_connection_id: connectionId })
                  .eq('whatsapp_connection_id', archivedConnection.id);
                
                if (migrateError) {
                  console.error('❌ [AUTO-MIGRATE] Erro ao migrar conversas:', migrateError);
                } else {
                  console.log('✅ [AUTO-MIGRATE] Conversas migradas com sucesso!');
                  
                  // Record migration
                  await supabase
                    .from('connection_migrations')
                    .insert({
                      company_id: company.id,
                      source_connection_id: archivedConnection.id,
                      target_connection_id: connectionId,
                      migration_type: 'auto_same_number',
                      migrated_conversations_count: conversationsCount || 0,
                      migrated_by: session?.user?.id
                    });
                  
                  // Mark old connection as migrated
                  await supabase
                    .from('whatsapp_connections')
                    .update({ archived_reason: 'migrated' })
                    .eq('id', archivedConnection.id);
                  
                  toast.success(`${conversationsCount || 0} conversas migradas automaticamente da conexão anterior!`);
                }
              } else {
                console.log('ℹ️ [AUTO-MIGRATE] Nenhuma conexão arquivada encontrada com mesmo número');
              }
            }
            
            // Create default department if connection doesn't have any
            console.log('📁 [DEPARTMENT] Verificando departamentos da conexão...');
            const { count: deptCount } = await supabase
              .from('departments')
              .select('*', { count: 'exact', head: true })
              .eq('whatsapp_connection_id', connectionId);
            
            if (!deptCount || deptCount === 0) {
              console.log('📁 [DEPARTMENT] Nenhum departamento encontrado, criando "Geral"...');
              const { data: newDept, error: deptError } = await supabase
                .from('departments')
                .insert({
                  name: 'Geral',
                  description: 'Departamento padrão criado automaticamente',
                  whatsapp_connection_id: connectionId,
                  is_default: true,
                  active: true,
                  color: '#3B82F6'
                })
                .select()
                .single();
              
              if (deptError) {
                console.error('❌ [DEPARTMENT] Erro ao criar departamento:', deptError);
              } else {
                console.log('✅ [DEPARTMENT] Departamento "Geral" criado com sucesso!', newDept?.id);
              }
            } else {
              console.log('📁 [DEPARTMENT] Conexão já possui', deptCount, 'departamento(s)');
            }
            
            console.log('⏱️ [POLLING] Parando polling...');
            stopPolling();
            console.log('🔍 [QR CODE] Fechando dialog...');
            setIsDialogOpen(false);
            resetDialogState();
            toast.success('WhatsApp conectado com sucesso!');
            loadConnections();
          } else {
            console.log('🔄 [STATUS CHECK] Ainda não conectado, continuando polling...');
            console.log('🔄 [STATUS CHECK] QR Code ainda deve estar visível');
          }
        } else {
          console.log('⚠️ [STATUS CHECK] statusData é null/undefined');
        }
      } catch (error) {
        console.error('❌ [POLLING] Erro no polling:', error);
      }
    }, 3000);

    // Timeout after 5 minutes
    console.log('⏱️ [POLLING] Timeout configurado para 5 minutos');
    timeoutRef.current = setTimeout(() => {
      console.log('⏱️ [POLLING] TIMEOUT ATINGIDO - 5 minutos');
      stopPolling();
      toast.error('Tempo limite excedido. Tente novamente.');
      handleCancelConnection();
    }, 300000);
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  async function handleCancelConnection() {
    stopPolling();
    
    if (currentConnectionId) {
      try {
        // Delete from uazapi
        if (currentSessionId) {
          await supabase.functions.invoke('whatsapp-instance', {
            body: {
              action: 'delete',
              instanceName: currentSessionId
            }
          });
        }
        
        // Delete from database
        await supabase
          .from('whatsapp_connections')
          .delete()
          .eq('id', currentConnectionId);
      } catch (error) {
        console.error('Error canceling connection:', error);
      }
    }

    setIsDialogOpen(false);
    resetDialogState();
    loadConnections();
  }

  function resetDialogState() {
    setDialogStep('name');
    setConnectionName('');
    setQrCode(null);
    setCurrentConnectionId(null);
    setCurrentSessionId(null);
    setIsProcessing(false);
  }

  async function handleDisconnect(connection: WhatsAppConnection) {
    try {
      // 1. Logout from uazapi
      await supabase.functions.invoke('whatsapp-instance', {
        body: {
          action: 'logout',
          instanceName: connection.session_id
        }
      });

      // 2. Update database
      await supabase
        .from('whatsapp_connections')
        .update({ 
          status: 'disconnected',
          qr_code: null 
        })
        .eq('id', connection.id);

      toast.success('WhatsApp desconectado');
      loadConnections();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    }
  }

  async function handleReconnect(connection: WhatsAppConnection) {
    console.log('🔍 [RECONNECT] ========== INICIANDO RECONEXÃO ==========');
    console.log('🔍 [RECONNECT] Connection:', connection);
    
    setCurrentConnectionId(connection.id);
    setCurrentSessionId(connection.session_id);
    setConnectionName(connection.name);
    setIsDialogOpen(true);
    setDialogStep('qr');
    setIsProcessing(true);

    try {
      // Usar 'reconnect' para reutilizar instância existente
      console.log('📡 [API] Chamando edge function com action: reconnect');
      console.log('📡 [API] Payload:', { action: 'reconnect', instanceName: connection.session_id });
      
      const { data: reconnectData, error: reconnectError } = await supabase.functions.invoke('whatsapp-instance', {
        body: {
          action: 'reconnect',
          instanceName: connection.session_id
        }
      });

      console.log('📡 [API] Response completo:', reconnectData);
      console.log('📡 [API] Error:', reconnectError);

      if (reconnectError) {
        console.log('❌ [API] Erro na reconexão:', reconnectError);
        throw reconnectError;
      }

      console.log('🔍 [QR CODE] QR Code recebido?', !!reconnectData?.qrCode);
      console.log('🔍 [QR CODE] QR Code (primeiros 100 chars):', reconnectData?.qrCode?.substring(0, 100));

      if (reconnectData.qrCode) {
        console.log('📡 [API] Atualizando conexão com QR code...');
        await supabase
          .from('whatsapp_connections')
          .update({ 
            qr_code: reconnectData.qrCode,
            status: 'qr_ready' 
          })
          .eq('id', connection.id);

        console.log('✅ [QR CODE] QR Code salvo no state');
        setQrCode(reconnectData.qrCode);
        console.log('⏱️ [POLLING] Iniciando polling...');
        startPolling(connection.id, connection.session_id);
      } else {
        console.log('❌ [QR CODE] QR code não recebido na resposta');
        throw new Error('QR code não recebido');
      }
    } catch (error: any) {
      console.error('❌ [RECONNECT] Erro geral:', error);
      toast.error(error.message || 'Erro ao reconectar');
      setIsDialogOpen(false);
      resetDialogState();
    } finally {
      setIsProcessing(false);
      console.log('🔍 [RECONNECT] ========== FIM DA RECONEXÃO ==========');
    }
  }

  // Archive connection instead of deleting (preserves history)
  async function handleArchiveConnection(connection: WhatsAppConnection) {
    setConnectionToArchive(connection);
    setArchiveDialogOpen(true);
  }

  async function confirmArchiveConnection() {
    if (!connectionToArchive) return;
    
    try {
      // 1. Logout from uazapi if connected
      if (connectionToArchive.status === 'connected') {
        await supabase.functions.invoke('whatsapp-instance', {
          body: {
            action: 'logout',
            instanceName: connectionToArchive.session_id
          }
        });
      }

      // 2. Delete instance from uazapi
      await supabase.functions.invoke('whatsapp-instance', {
        body: {
          action: 'delete',
          instanceName: connectionToArchive.session_id
        }
      });

      // 3. Archive in database (preserve history)
      await supabase
        .from('whatsapp_connections')
        .update({ 
          status: 'disconnected',
          archived_at: new Date().toISOString(),
          archived_reason: 'user_archived',
          qr_code: null,
          active: false
        })
        .eq('id', connectionToArchive.id);

      toast.success('Conexão arquivada. O histórico de conversas foi preservado.');
      setArchiveDialogOpen(false);
      setConnectionToArchive(null);
      loadConnections();
    } catch (error) {
      console.error('Error archiving connection:', error);
      toast.error('Erro ao arquivar conexão');
    }
  }

  // Open import modal for a connection
  function handleOpenImportModal(connection: WhatsAppConnection) {
    setSelectedConnectionForImport(connection);
    setIsImportModalOpen(true);
  }

  const statusConfig = {
    connected: {
      label: 'Conectado',
      icon: Wifi,
      className: 'bg-success/10 text-success border-success/20',
    },
    disconnected: {
      label: 'Desconectado',
      icon: WifiOff,
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
    qr_ready: {
      label: 'Aguardando QR',
      icon: QrCode,
      className: 'bg-warning/10 text-warning border-warning/20',
    },
    connecting: {
      label: 'Conectando...',
      icon: RefreshCw,
      className: 'bg-info/10 text-info border-info/20',
    },
    error: {
      label: 'Erro',
      icon: WifiOff,
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check connection limit before opening dialog (only count active connections)
  const activeConnections = connections.filter(c => !c.archived_at);
  const archivedConnections = connections.filter(c => c.archived_at);
  
  const handleAddConnection = () => {
    const currentCount = activeConnections.length;
    if (currentCount >= maxConnections) {
      setShowLimitModal(true);
      return;
    }
    resetDialogState();
    setIsDialogOpen(true);
  };

  function handleOpenPermanentDeleteDialog(connection: WhatsAppConnection) {
    setConnectionToDelete(connection);
    setPermanentDeleteDialogOpen(true);
  }
    setConnectionToDelete(connection);
    setPermanentDeleteDialogOpen(true);
  }

  async function confirmPermanentDelete() {
    if (!connectionToDelete) return;
    
    try {
      await supabase
        .from('whatsapp_connections')
        .delete()
        .eq('id', connectionToDelete.id);

      toast.success('Backup excluído permanentemente');
      setPermanentDeleteDialogOpen(false);
      setConnectionToDelete(null);
      loadConnections();
    } catch (error) {
      console.error('Error permanently deleting connection:', error);
      toast.error('Erro ao excluir backup');
    }
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Connection Limit Modal */}
      <ConnectionLimitReachedModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        currentConnections={activeConnections.length}
        maxConnections={maxConnections}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Conexões WhatsApp</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Conecte números do WhatsApp para atender seus clientes
          </p>
          {maxConnections < 999 && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">{activeConnections.length}</span> de <span className="font-medium">{maxConnections}</span> conexões utilizadas
            </p>
          )}
        </div>
        <Button onClick={handleAddConnection} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Conectar WhatsApp
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Wifi className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm md:text-base">Como funciona?</h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Conecte seu WhatsApp escaneando o QR Code. Uma vez conectado, todas as mensagens 
                serão sincronizadas automaticamente com a plataforma.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Connections - Cards on mobile, Table on desktop */}
      {activeConnections.length > 0 ? (
        <>
          {/* Mobile: Cards */}
          <div className="grid gap-3 md:hidden">
            {activeConnections.map((connection) => {
              const status = statusConfig[connection.status || 'disconnected'];
              const StatusIcon = status.icon;
              
              return (
                <Card key={connection.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                          connection.status === 'connected' ? 'bg-success/10' : 'bg-muted'
                        )}>
                          <Wifi className={cn(
                            'w-5 h-5',
                            connection.status === 'connected' ? 'text-success' : 'text-muted-foreground'
                          )} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{connection.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{connection.phone_number}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => {
                            setSelectedConnectionForSettings(connection);
                            setIsSettingsDialogOpen(true);
                          }}>
                            <Settings className="w-4 h-4 mr-2" />
                            Configurações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenImportModal(connection)}>
                            <Upload className="w-4 h-4 mr-2" />
                            Importar Conversas
                          </DropdownMenuItem>
                          {connection.status === 'connected' && (
                            <DropdownMenuItem onClick={() => handleDisconnect(connection)}>
                              <WifiOff className="w-4 h-4 mr-2" />
                              Desconectar
                            </DropdownMenuItem>
                          )}
                          {(connection.status === 'disconnected' || connection.status === 'error') && (
                            <DropdownMenuItem onClick={() => handleReconnect(connection)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Reconectar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleArchiveConnection(connection)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-3">
                      <Badge variant="outline" className={status.className}>
                        <StatusIcon className={cn(
                          'w-3 h-3 mr-1',
                          connection.status === 'connecting' && 'animate-spin'
                        )} />
                        {status.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeConnections.map((connection) => {
                  const status = statusConfig[connection.status || 'disconnected'];
                  const StatusIcon = status.icon;
                  
                  return (
                    <TableRow key={connection.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            connection.status === 'connected' ? 'bg-success/10' : 'bg-muted'
                          )}>
                            <Wifi className={cn(
                              'w-5 h-5',
                              connection.status === 'connected' ? 'text-success' : 'text-muted-foreground'
                            )} />
                          </div>
                          {connection.name}
                        </div>
                      </TableCell>
                      <TableCell>{connection.phone_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          <StatusIcon className={cn(
                            'w-3 h-3 mr-1',
                            connection.status === 'connecting' && 'animate-spin'
                          )} />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => {
                              setSelectedConnectionForSettings(connection);
                              setIsSettingsDialogOpen(true);
                            }}>
                              <Settings className="w-4 h-4 mr-2" />
                              Configurações
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenImportModal(connection)}>
                              <Upload className="w-4 h-4 mr-2" />
                              Importar Conversas
                            </DropdownMenuItem>
                            {connection.status === 'connected' && (
                              <DropdownMenuItem onClick={() => handleDisconnect(connection)}>
                                <WifiOff className="w-4 h-4 mr-2" />
                                Desconectar
                              </DropdownMenuItem>
                            )}
                            {(connection.status === 'disconnected' || connection.status === 'error') && (
                              <DropdownMenuItem onClick={() => handleReconnect(connection)}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reconectar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleArchiveConnection(connection)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Deletar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 md:py-12 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Wifi className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Nenhuma conexão ativa</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Conecte seu primeiro WhatsApp para começar a atender
            </p>
            <Button onClick={() => { resetDialogState(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Conectar WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Archived/Deleted Connections Section */}
      {archivedConnections.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">
              Conexões Excluídas ({archivedConnections.length})
            </h2>
          </div>
          
          {/* Mobile: Cards - Grayscale */}
          <div className="grid gap-3 md:hidden">
            {archivedConnections.map((connection) => (
              <Card key={connection.id} className="opacity-60 grayscale">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-muted">
                        <WifiOff className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate line-through text-muted-foreground">{connection.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{connection.phone_number}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleOpenPermanentDeleteDialog(connection)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir Backup
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3">
                    <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted">
                      <WifiOff className="w-3 h-3 mr-1" />
                      Excluída
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: Table - Grayscale */}
          <Card className="hidden md:block opacity-60 grayscale">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedConnections.map((connection) => (
                  <TableRow key={connection.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted">
                          <WifiOff className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <span className="line-through text-muted-foreground">{connection.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{connection.phone_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted">
                        <WifiOff className="w-3 h-3 mr-1" />
                        Excluída
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleOpenPermanentDeleteDialog(connection)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir Backup
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Connection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open && dialogStep === 'qr') {
          handleCancelConnection();
        } else if (!open) {
          resetDialogState();
          setIsDialogOpen(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogStep === 'name' ? 'Conectar WhatsApp' : 'Escaneie o QR Code'}
            </DialogTitle>
            <DialogDescription>
              {dialogStep === 'name' 
                ? 'Dê um nome para identificar esta conexão'
                : 'Use seu WhatsApp para escanear o código abaixo'
              }
            </DialogDescription>
          </DialogHeader>
          
          {dialogStep === 'name' ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="connection-name">Nome da Conexão</Label>
                <Input
                  id="connection-name"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder="Ex: WhatsApp Vendas"
                  disabled={isProcessing}
                />
              </div>
            </div>
          ) : (
            <div className="py-6">
              <div className="flex flex-col items-center">
                {/* QR Code */}
                <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center border overflow-hidden">
                  {qrCode ? (
                    <img 
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  )}
                </div>

                {/* Instructions */}
                <div className="mt-6 text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">Instruções:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abra o WhatsApp no seu celular</li>
                    <li>Toque em Menu (⋮) ou Configurações</li>
                    <li>Toque em "Aparelhos conectados"</li>
                    <li>Toque em "Conectar aparelho"</li>
                    <li>Aponte para este QR Code</li>
                  </ol>
                </div>

                {/* Status indicator */}
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                  <span className="text-muted-foreground">Aguardando conexão...</span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            {dialogStep === 'name' ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isProcessing}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleGenerateQR}
                  disabled={isProcessing || !connectionName.trim()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    'Gerar QR Code'
                  )}
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                onClick={handleCancelConnection}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <ConnectionSettingsDialog
        connection={selectedConnectionForSettings}
        isOpen={isSettingsDialogOpen}
        onClose={() => {
          setIsSettingsDialogOpen(false);
          setSelectedConnectionForSettings(null);
        }}
        onUpdate={(updatedConnection) => {
          setConnections(prev => prev.map(c => 
            c.id === updatedConnection.id ? { ...c, ...updatedConnection } : c
          ));
        }}
      />

      {/* Delete Connection Confirmation Dialog (archives but preserves history) */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Deletar Conexão
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Ao deletar esta conexão, ela será desconectada do WhatsApp, mas <strong>todo o histórico de conversas será preservado</strong>.
              </p>
              <p className="text-muted-foreground">
                As conversas poderão ser visualizadas através do filtro "Desconectadas" no inbox.
              </p>
              <p className="text-muted-foreground">
                Você poderá importar essas conversas para uma nova conexão a qualquer momento.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmArchiveConnection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar Conexão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Backup Confirmation Dialog */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Excluir Backup Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-destructive">
                ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!
              </p>
              <p>
                Ao excluir o backup desta conexão, você perderá:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Todo o histórico de conversas</li>
                <li>Todas as mensagens enviadas e recebidas</li>
                <li>Todos os arquivos de mídia compartilhados</li>
              </ul>
              <p className="text-sm text-muted-foreground border-t pt-3">
                Esta ação <strong>NÃO</strong> pode ser desfeita.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmPermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Conversations Modal */}
      <ImportConversationsModal
        open={isImportModalOpen}
        onOpenChange={(open) => {
          setIsImportModalOpen(open);
          if (!open) setSelectedConnectionForImport(null);
        }}
        targetConnectionId={selectedConnectionForImport?.id || ''}
        targetConnectionName={selectedConnectionForImport?.name || ''}
        companyId={company?.id || ''}
        onSuccess={loadConnections}
      />
    </div>
  );
}

// Connection Settings Dialog Component
function ConnectionSettingsDialog({ 
  connection, 
  isOpen, 
  onClose, 
  onUpdate 
}: { 
  connection: WhatsAppConnection | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (connection: Partial<WhatsAppConnection>) => void;
}) {
  const [receiveGroupMessages, setReceiveGroupMessages] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load initial state when connection changes
  useEffect(() => {
    if (connection) {
      setReceiveGroupMessages(connection.receive_group_messages ?? false);
    }
  }, [connection]);

  const handleToggleGroupMessages = async (checked: boolean) => {
    if (!connection) return;
    
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
        body: {
          action: 'update_webhook',
          connectionId: connection.id,
          receiveGroupMessages: checked
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setReceiveGroupMessages(checked);
      onUpdate({ id: connection.id, receive_group_messages: checked });
      toast.success(checked 
        ? 'Mensagens de grupos ativadas' 
        : 'Mensagens de grupos desativadas'
      );
    } catch (error) {
      console.error('Error updating group messages setting:', error);
      toast.error('Erro ao atualizar configuração');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Configurações: {connection?.name}
          </DialogTitle>
          <DialogDescription>
            Gerencie as configurações desta conexão WhatsApp
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Group Messages Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="group-messages" className="font-medium">
                  Receber mensagens de grupos
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permite processar mensagens enviadas em grupos do WhatsApp
                </p>
              </div>
            </div>
            <Switch
              id="group-messages"
              checked={receiveGroupMessages}
              onCheckedChange={handleToggleGroupMessages}
              disabled={isUpdating}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
