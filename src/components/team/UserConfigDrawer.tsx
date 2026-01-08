import { useState, useEffect } from 'react';
import { Loader2, Shield, ShieldCheck, UserCheck, Eye, Info, ChevronDown, ChevronUp, PenLine, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  role: string;
  connectionCount: number;
  hasRestrictedAccess: boolean;
}

interface Department {
  id: string;
  name: string;
  color: string | null;
  is_default: boolean;
}

interface Connection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
  departments: Department[];
}

interface ConnectionAccess {
  connectionId: string;
  enabled: boolean;
  accessLevel: 'full' | 'assigned_only';
  departmentAccess: 'all' | 'specific' | 'none';
  selectedDepartmentIds: Set<string>;
  crmAccess: boolean; // NEW: CRM access per connection
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

// Helper to serialize ConnectionAccess for comparison
function serializeAccess(access: ConnectionAccess[]): string {
  return JSON.stringify(access.map(a => ({
    ...a,
    selectedDepartmentIds: Array.from(a.selectedDepartmentIds).sort()
  })));
}

// Function to check if current user can manage target user's signature
function canManageSignature(currentUserRole: string | undefined, targetUserRole: string): boolean {
  if (!currentUserRole) return false;
  
  // Agent and viewer cannot manage anyone's signature
  if (currentUserRole === 'agent' || currentUserRole === 'viewer' || currentUserRole === 'supervisor') {
    return false;
  }
  
  // Owner can manage anyone (including themselves)
  if (currentUserRole === 'owner') {
    return true;
  }
  
  // Admin can manage agent, viewer, supervisor and themselves (NOT owner)
  if (currentUserRole === 'admin') {
    if (targetUserRole === 'owner') {
      return false;
    }
    return true;
  }
  
  return false;
}

export function UserConfigDrawer({ open, onClose, member, onSaveSuccess, isOwner }: UserConfigDrawerProps) {
  const { profile, userRole } = useAuth();
  const currentUserRole = userRole?.role;
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  
  // Form state
  const [selectedRole, setSelectedRole] = useState<string>('agent');
  const [connectionAccess, setConnectionAccess] = useState<ConnectionAccess[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Signature state
  const [signature, setSignature] = useState<string>('');
  const [signatureEnabled, setSignatureEnabled] = useState<boolean>(false);
  const [originalSignature, setOriginalSignature] = useState<string>('');
  const [originalSignatureEnabled, setOriginalSignatureEnabled] = useState<boolean>(false);

  // Commercial analysis state
  const [commercialAnalysisEnabled, setCommercialAnalysisEnabled] = useState<boolean>(false);
  const [originalCommercialAnalysisEnabled, setOriginalCommercialAnalysisEnabled] = useState<boolean>(false);

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
    const accessChanged = serializeAccess(connectionAccess) !== serializeAccess(originalAccess);
    const signatureChanged = signature !== originalSignature || signatureEnabled !== originalSignatureEnabled;
    const commercialChanged = commercialAnalysisEnabled !== originalCommercialAnalysisEnabled;
    setHasChanges(roleChanged || accessChanged || signatureChanged || commercialChanged);
  }, [selectedRole, connectionAccess, originalRole, originalAccess, signature, originalSignature, signatureEnabled, originalSignatureEnabled, commercialAnalysisEnabled, originalCommercialAnalysisEnabled]);

  const loadData = async () => {
    if (!member || !profile?.company_id) return;

    setIsLoading(true);
    try {
      // Load connections with their departments
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status')
        .eq('company_id', profile.company_id)
        .eq('active', true)
        .eq('status', 'connected')
        .order('name');

      if (connectionsError) throw connectionsError;

      // Load departments for each connection
      const connectionIds = (connectionsData || []).map(c => c.id);
      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('id, name, color, is_default, whatsapp_connection_id')
        .in('whatsapp_connection_id', connectionIds)
        .eq('active', true)
        .order('name');

      if (departmentsError) throw departmentsError;

      // Map departments to connections
      const connectionsWithDepts: Connection[] = (connectionsData || []).map(conn => ({
        ...conn,
        departments: (departmentsData || []).filter(d => d.whatsapp_connection_id === conn.id)
      }));

      setConnections(connectionsWithDepts);

      // Load user's current role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', member.id)
        .maybeSingle();

      if (roleError) throw roleError;
      const currentRole = roleData?.role || 'agent';
      setSelectedRole(currentRole);

      // Load signature data from profiles table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('signature, signature_enabled, commercial_analysis_enabled')
        .eq('id', member.id)
        .single();

      const currentSignature = profileData?.signature || '';
      const currentSignatureEnabled = profileData?.signature_enabled || false;
      const currentCommercialAnalysisEnabled = (profileData as any)?.commercial_analysis_enabled || false;
      setSignature(currentSignature);
      setSignatureEnabled(currentSignatureEnabled);
      setOriginalSignature(currentSignature);
      setOriginalSignatureEnabled(currentSignatureEnabled);
      setCommercialAnalysisEnabled(currentCommercialAnalysisEnabled);
      setOriginalCommercialAnalysisEnabled(currentCommercialAnalysisEnabled);
      setOriginalRole(currentRole);

      // Load user's connection assignments
      const { data: connectionAssignments, error: connectionAssignmentsError } = await supabase
        .from('connection_users')
        .select('connection_id, access_level, department_access_mode, crm_access')
        .eq('user_id', member.id);

      if (connectionAssignmentsError) throw connectionAssignmentsError;

      // Load user's department assignments
      const { data: departmentAssignments, error: departmentAssignmentsError } = await supabase
        .from('department_users')
        .select('department_id')
        .eq('user_id', member.id);

      if (departmentAssignmentsError) throw departmentAssignmentsError;

      const userDepartmentIds = new Set((departmentAssignments || []).map(da => da.department_id));

      // Build connection access state
      const accessState: ConnectionAccess[] = connectionsWithDepts.map(conn => {
        const assignment = connectionAssignments?.find(a => a.connection_id === conn.id);
        
        // Check if user has any department assignments for this connection
        const connDepartmentIds = conn.departments.map(d => d.id);
        const userDepartmentsInConn = connDepartmentIds.filter(id => userDepartmentIds.has(id));
        
        // Use the stored department_access_mode if available
        const deptAccessMode = (assignment?.department_access_mode as 'all' | 'specific' | 'none') || 'all';
        
        return {
          connectionId: conn.id,
          enabled: !!assignment,
          accessLevel: (assignment?.access_level as 'full' | 'assigned_only') || 'full',
          departmentAccess: deptAccessMode,
          selectedDepartmentIds: new Set(userDepartmentsInConn),
          crmAccess: assignment?.crm_access ?? false,
        };
      });

      setConnectionAccess(accessState);
      setOriginalAccess(accessState.map(a => ({ ...a, selectedDepartmentIds: new Set(a.selectedDepartmentIds) })));
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
          ? { ...ca, enabled, accessLevel: enabled ? ca.accessLevel : 'full', departmentAccess: 'all', selectedDepartmentIds: new Set(), crmAccess: false } 
          : ca
      )
    );
    // Always expand when enabling to show department options
    if (enabled) {
      setExpandedConnections(prev => new Set([...prev, connectionId]));
    } else {
      setExpandedConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
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

  const handleDepartmentAccessChange = (connectionId: string, access: 'all' | 'specific' | 'none') => {
    setConnectionAccess(prev => 
      prev.map(ca => {
        if (ca.connectionId !== connectionId) return ca;
        if (access === 'all' || access === 'none') {
          return { ...ca, departmentAccess: access, selectedDepartmentIds: new Set() };
        }
        return { ...ca, departmentAccess: 'specific' };
      })
    );
  };

  const handleDepartmentToggle = (connectionId: string, departmentId: string, checked: boolean) => {
    setConnectionAccess(prev => 
      prev.map(ca => {
        if (ca.connectionId !== connectionId) return ca;
        const newSet = new Set(ca.selectedDepartmentIds);
        if (checked) {
          newSet.add(departmentId);
        } else {
          newSet.delete(departmentId);
        }
        return { ...ca, selectedDepartmentIds: newSet };
      })
    );
  };

  const handleCrmAccessToggle = (connectionId: string, enabled: boolean) => {
    setConnectionAccess(prev => 
      prev.map(ca => 
        ca.connectionId === connectionId 
          ? { ...ca, crmAccess: enabled } 
          : ca
      )
    );
  };

  const toggleConnectionExpanded = (connectionId: string) => {
    setExpandedConnections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(connectionId)) {
        newSet.delete(connectionId);
      } else {
        newSet.add(connectionId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!member) return;

    setIsSaving(true);
    try {
      // 1. Update role if changed
      if (selectedRole !== originalRole) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', member.id);

        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: member.id, role: selectedRole as 'owner' | 'admin' | 'supervisor' | 'agent' | 'viewer' });

        if (roleError) throw roleError;
      }

      // Update signature settings if changed
      if (signature !== originalSignature || signatureEnabled !== originalSignatureEnabled || commercialAnalysisEnabled !== originalCommercialAnalysisEnabled) {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            signature: signature.trim() || null,
            signature_enabled: signatureEnabled,
            commercial_analysis_enabled: commercialAnalysisEnabled
          })
          .eq('id', member.id);

        if (profileUpdateError) throw profileUpdateError;
      }

      // 2. Update connection access
      if (selectedRole === 'owner' || selectedRole === 'admin') {
        // Clear all assignments for admin/owner
        await supabase.from('connection_users').delete().eq('user_id', member.id);
        await supabase.from('department_users').delete().eq('user_id', member.id);
      } else {
        // Delete all existing connection assignments
        await supabase.from('connection_users').delete().eq('user_id', member.id);
        
        // Delete all existing department assignments
        await supabase.from('department_users').delete().eq('user_id', member.id);

        // Insert new connection assignments
        const connectionAssignmentsToInsert = connectionAccess
          .filter(ca => ca.enabled)
          .map(ca => ({
            connection_id: ca.connectionId,
            user_id: member.id,
            access_level: ca.accessLevel,
            department_access_mode: ca.departmentAccess,
            crm_access: ca.crmAccess,
          }));

        if (connectionAssignmentsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('connection_users')
            .insert(connectionAssignmentsToInsert);

          if (insertError) throw insertError;
        }

        // Insert new department assignments
        const departmentAssignmentsToInsert: { department_id: string; user_id: string }[] = [];
        
        connectionAccess
          .filter(ca => ca.enabled && ca.departmentAccess === 'specific')
          .forEach(ca => {
            ca.selectedDepartmentIds.forEach(deptId => {
              departmentAssignmentsToInsert.push({
                department_id: deptId,
                user_id: member.id,
              });
            });
          });

        if (departmentAssignmentsToInsert.length > 0) {
          const { error: deptInsertError } = await supabase
            .from('department_users')
            .insert(departmentAssignmentsToInsert);

          if (deptInsertError) throw deptInsertError;
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
                <AvatarImage src={member.avatar_url || undefined} className="object-cover object-top" />
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
                    Proprietários e administradores têm acesso automático a todas as conexões e departamentos.
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
                      const isExpanded = expandedConnections.has(conn.id);
                      
                      return (
                        <div
                          key={conn.id}
                          className="border rounded-lg overflow-hidden"
                        >
                          {/* Connection Header */}
                          <div className="p-4 flex items-center justify-between bg-card">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={access?.enabled || false}
                                onCheckedChange={(checked) => handleConnectionToggle(conn.id, checked)}
                              />
                              <div>
                                <p className="font-medium">{conn.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatPhoneNumber(conn.phone_number)}
                                </p>
                              </div>
                            </div>
                            {access?.enabled && (
                              <Badge variant="secondary" className="text-xs">
                                {conn.departments.length} dept{conn.departments.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>

                          {/* Connection Details - always visible when enabled */}
                          {access?.enabled && (
                            <div className="p-4 space-y-4 border-t bg-muted/30">
                                  {/* Access Level */}
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Nível de Acesso às Conversas</Label>
                                    <Select
                                      value={access.accessLevel}
                                      onValueChange={(value) => handleAccessLevelChange(conn.id, value as 'full' | 'assigned_only')}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="full">Acesso completo</SelectItem>
                                        <SelectItem value="assigned_only">Apenas atribuídas</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                      {access.accessLevel === 'full' 
                                        ? 'Vê todas as conversas, pode puxar da fila'
                                        : 'Vê apenas conversas atribuídas a ele'}
                                    </p>
                                  </div>

                                  {/* Department Access */}
                                  {conn.departments.length > 0 && (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Acesso a Departamentos</Label>
                                      <Select
                                        value={access.departmentAccess}
                                        onValueChange={(value) => handleDepartmentAccessChange(conn.id, value as 'all' | 'specific' | 'none')}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="all">Todos os departamentos</SelectItem>
                                          <SelectItem value="specific">Departamentos específicos</SelectItem>
                                          <SelectItem value="none">Nenhum departamento</SelectItem>
                                        </SelectContent>
                                      </Select>

                                      {access.departmentAccess === 'specific' && (
                                        <div className="space-y-2 mt-3 p-3 bg-background rounded-lg border">
                                          <p className="text-xs text-muted-foreground mb-2">
                                            Selecione os departamentos que o usuário pode acessar:
                                          </p>
                                          {conn.departments.map(dept => (
                                            <div key={dept.id} className="flex items-center gap-2">
                                              <Checkbox
                                                id={`dept-${dept.id}`}
                                                checked={access.selectedDepartmentIds.has(dept.id)}
                                                onCheckedChange={(checked) => 
                                                  handleDepartmentToggle(conn.id, dept.id, checked === true)
                                                }
                                              />
                                              <label 
                                                htmlFor={`dept-${dept.id}`}
                                                className="text-sm flex items-center gap-2 cursor-pointer"
                                              >
                                                <span 
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: dept.color || '#3B82F6' }}
                                                />
                                                {dept.name}
                                                {dept.is_default && (
                                                  <Badge variant="secondary" className="text-xs py-0 h-4">
                                                    Padrão
                                                  </Badge>
                                                )}
                                              </label>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* CRM Access */}
                                  <div className="space-y-2 pt-2 border-t">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Acesso ao CRM (Kanban)</Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          Permite visualizar e gerenciar o quadro Kanban desta conexão
                                        </p>
                                      </div>
                                      <Switch
                                        checked={access.crmAccess}
                                        onCheckedChange={(checked) => handleCrmAccessToggle(conn.id, checked)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Commercial Manager Analysis Toggle */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Gerente Comercial</Label>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex-1 space-y-1">
                  <Label className="font-medium">Incluir nas Análises</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, as conversas deste atendente serão incluídas 
                    nas análises e métricas do gerente comercial.
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Desativado = Zero custo de IA para este usuário
                  </p>
                </div>
                <Switch
                  checked={commercialAnalysisEnabled}
                  onCheckedChange={setCommercialAnalysisEnabled}
                />
              </div>
              
              {!commercialAnalysisEnabled && (
                <p className="text-xs text-muted-foreground bg-background p-2 rounded border">
                  ℹ️ Este usuário está excluído das análises do Gerente Comercial.
                  Suas conversas não aparecerão no dashboard nem consumirão recursos de IA.
                </p>
              )}
            </div>

            <Separator />

            {/* Signature Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Configurações de Assinatura</Label>
              </div>
              
              {/* Signature Text Input */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Assinatura Personalizada</Label>
                <Input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Ex: João Silva, Atendente Maria"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  Aparecerá em negrito na primeira linha das mensagens de texto
                </p>
              </div>

              {/* Toggle - only visible if current user can manage */}
              {canManageSignature(currentUserRole, member.role) && (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <Label className="font-medium">Ativar Assinatura Automática</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando ativada, mensagens de texto começarão com a assinatura
                    </p>
                  </div>
                  <Switch
                    checked={signatureEnabled}
                    onCheckedChange={(checked) => {
                      if (checked && !signature?.trim()) {
                        toast.error('Defina uma assinatura antes de ativar');
                        return;
                      }
                      setSignatureEnabled(checked);
                    }}
                    disabled={!signature?.trim() && !signatureEnabled}
                  />
                </div>
              )}

              {/* Warning if no signature defined but trying to enable */}
              {signatureEnabled && !signature?.trim() && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <Info className="h-4 w-4 text-yellow-700" />
                  <AlertDescription className="text-yellow-700">
                    Defina uma assinatura antes de ativar
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview */}
              {signatureEnabled && signature?.trim() && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs font-semibold text-primary mb-2">
                    📱 Preview no WhatsApp:
                  </p>
                  <div className="bg-background p-3 rounded-lg text-sm whitespace-pre-line border">
                    <strong>{signature}</strong>
                    {'\n\n'}
                    Olá, como posso ajudar?
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ℹ️ Assinatura aparece apenas em mensagens de texto
                  </p>
                </div>
              )}

              {/* Status for non-managers */}
              {!canManageSignature(currentUserRole, member.role) && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  {signatureEnabled ? (
                    <span className="text-green-700">✅ Assinatura ativada pelo administrador</span>
                  ) : signature?.trim() ? (
                    <span>ℹ️ Assinatura definida mas não ativada</span>
                  ) : (
                    <span>ℹ️ Nenhuma assinatura definida</span>
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