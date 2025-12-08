import { useState, useEffect } from 'react';
import { Loader2, Shield, ShieldCheck, UserCheck, Eye, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  status: string;
  active: boolean;
  created_at: string;
  role: string;
  connectionCount: number;
  hasRestrictedAccess: boolean;
}

interface Connection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

interface ConnectionAccess {
  connectionId: string;
  enabled: boolean;
  accessLevel: 'full' | 'assigned_only';
}

interface UserConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  member: TeamMember | null;
  onSaveSuccess: () => void;
  isOwner: boolean;
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Proprietário', description: 'Acesso total ao sistema. Apenas um por empresa.', icon: ShieldCheck, disabled: true },
  { value: 'admin', label: 'Administrador', description: 'Pode gerenciar equipe, conexões, departamentos e atender conversas.', icon: Shield },
  { value: 'agent', label: 'Atendente', description: 'Pode atender conversas das conexões atribuídas.', icon: UserCheck },
  { value: 'viewer', label: 'Visualizador', description: 'Pode visualizar conversas mas não pode responder.', icon: Eye },
];

export function UserConfigDrawer({ open, onClose, member, onSaveSuccess, isOwner }: UserConfigDrawerProps) {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  
  // Form state
  const [selectedRole, setSelectedRole] = useState<string>('agent');
  const [connectionAccess, setConnectionAccess] = useState<ConnectionAccess[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Original state for comparison
  const [originalRole, setOriginalRole] = useState<string>('agent');
  const [originalAccess, setOriginalAccess] = useState<ConnectionAccess[]>([]);

  useEffect(() => {
    if (open && member) {
      loadData();
    }
  }, [open, member]);

  useEffect(() => {
    // Check for changes
    const roleChanged = selectedRole !== originalRole;
    const accessChanged = JSON.stringify(connectionAccess) !== JSON.stringify(originalAccess);
    setHasChanges(roleChanged || accessChanged);
  }, [selectedRole, connectionAccess, originalRole, originalAccess]);

  const loadData = async () => {
    if (!member || !profile?.company_id) return;

    setIsLoading(true);
    try {
      // Load connections
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status')
        .eq('company_id', profile.company_id)
        .eq('status', 'connected')
        .order('name');

      if (connectionsError) throw connectionsError;
      setConnections(connectionsData || []);

      // Load user's current role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', member.id)
        .maybeSingle();

      if (roleError) throw roleError;
      const currentRole = roleData?.role || 'agent';
      setSelectedRole(currentRole);
      setOriginalRole(currentRole);

      // Load user's connection assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('connection_users')
        .select('connection_id, access_level')
        .eq('user_id', member.id);

      if (assignmentsError) throw assignmentsError;

      // Build connection access state
      const accessState: ConnectionAccess[] = (connectionsData || []).map(conn => {
        const assignment = assignmentsData?.find(a => a.connection_id === conn.id);
        return {
          connectionId: conn.id,
          enabled: !!assignment,
          accessLevel: (assignment?.access_level as 'full' | 'assigned_only') || 'full',
        };
      });

      setConnectionAccess(accessState);
      setOriginalAccess(JSON.parse(JSON.stringify(accessState)));
    } catch (error) {
      console.error('[UserConfigDrawer] Erro ao carregar dados:', error);
      toast.error('Erro ao carregar configurações do usuário');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectionToggle = (connectionId: string, enabled: boolean) => {
    setConnectionAccess(prev => 
      prev.map(ca => 
        ca.connectionId === connectionId 
          ? { ...ca, enabled, accessLevel: enabled ? ca.accessLevel : 'full' } 
          : ca
      )
    );
  };

  const handleAccessLevelChange = (connectionId: string, level: 'full' | 'assigned_only') => {
    setConnectionAccess(prev => 
      prev.map(ca => 
        ca.connectionId === connectionId 
          ? { ...ca, accessLevel: level } 
          : ca
      )
    );
  };

  const handleSave = async () => {
    if (!member) return;

    // Validate at least one connection if agent/viewer
    if (selectedRole === 'agent' || selectedRole === 'viewer') {
      const hasAnyConnection = connectionAccess.some(ca => ca.enabled);
      if (!hasAnyConnection) {
        toast.error('Configure pelo menos uma conexão para este usuário');
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Update role if changed
      if (selectedRole !== originalRole) {
        // Delete old role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', member.id);

        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: member.id, role: selectedRole as 'owner' | 'admin' | 'supervisor' | 'agent' | 'viewer' });

        if (roleError) throw roleError;
      }

      // 2. Update connection access
      // If role is owner/admin, clear all assignments (they have auto access)
      if (selectedRole === 'owner' || selectedRole === 'admin') {
        await supabase
          .from('connection_users')
          .delete()
          .eq('user_id', member.id);
      } else {
        // Delete all existing assignments
        await supabase
          .from('connection_users')
          .delete()
          .eq('user_id', member.id);

        // Insert new assignments
        const assignmentsToInsert = connectionAccess
          .filter(ca => ca.enabled)
          .map(ca => ({
            connection_id: ca.connectionId,
            user_id: member.id,
            access_level: ca.accessLevel,
          }));

        if (assignmentsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('connection_users')
            .insert(assignmentsToInsert);

          if (insertError) throw insertError;
        }
      }

      toast.success('Configurações do usuário atualizadas com sucesso');
      onSaveSuccess();
    } catch (error) {
      console.error('[UserConfigDrawer] Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const isAdminOrOwnerRole = selectedRole === 'admin' || selectedRole === 'owner';

  if (!member) return null;

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurar Usuário</SheetTitle>
          <SheetDescription>
            Gerencie as permissões e acesso às conexões
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-6">
            {/* User Info */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <Avatar className="w-12 h-12">
                <AvatarImage src={member.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(member.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{member.full_name}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
                {member.created_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Entrou em {format(new Date(member.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Role Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Nível de Permissão</Label>
              <Select 
                value={selectedRole} 
                onValueChange={setSelectedRole}
                disabled={member.role === 'owner'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(option => {
                    const Icon = option.icon;
                    const isDisabled = option.value === 'owner' || 
                      (!isOwner && option.value === 'admin');
                    
                    return (
                      <SelectItem 
                        key={option.value} 
                        value={option.value}
                        disabled={isDisabled}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {/* Role description */}
              <p className="text-sm text-muted-foreground">
                {ROLE_OPTIONS.find(r => r.value === selectedRole)?.description}
              </p>

              {selectedRole === 'viewer' && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Visualizadores não podem responder conversas, apenas visualizar.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Connection Access */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Acesso a Conexões WhatsApp</Label>
              
              {isAdminOrOwnerRole ? (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertDescription>
                    Proprietários e administradores têm acesso automático a todas as conexões.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {connections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma conexão ativa encontrada.
                    </p>
                  ) : (
                    connections.map(conn => {
                      const access = connectionAccess.find(ca => ca.connectionId === conn.id);
                      
                      return (
                        <div
                          key={conn.id}
                          className="p-4 border rounded-lg space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{conn.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatPhoneNumber(conn.phone_number)}
                              </p>
                            </div>
                            <Switch
                              checked={access?.enabled || false}
                              onCheckedChange={(checked) => handleConnectionToggle(conn.id, checked)}
                            />
                          </div>

                          {access?.enabled && (
                            <div className="space-y-2 pl-4 border-l-2 border-muted">
                              <Label className="text-xs text-muted-foreground">Nível de Acesso</Label>
                              <Select
                                value={access.accessLevel}
                                onValueChange={(value) => handleAccessLevelChange(conn.id, value as 'full' | 'assigned_only')}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full">
                                    <div className="flex flex-col items-start">
                                      <span>Acesso completo</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="assigned_only">
                                    <div className="flex flex-col items-start">
                                      <span>Apenas atribuídas</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {access.accessLevel === 'full' 
                                  ? 'Vê todas as conversas, pode puxar da fila'
                                  : 'Vê apenas conversas atribuídas a ele'}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <SheetFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving || isLoading}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar alterações'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
