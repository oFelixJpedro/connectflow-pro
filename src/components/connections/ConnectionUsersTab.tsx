import { useState, useEffect } from 'react';
import { Users, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ConnectionUsersTabProps {
  connectionId: string;
  onClose?: () => void;
}

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

export function ConnectionUsersTab({ connectionId, onClose }: ConnectionUsersTabProps) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = 
    assignedUserIds.size !== originalAssignedIds.size ||
    [...assignedUserIds].some(id => !originalAssignedIds.has(id)) ||
    [...originalAssignedIds].some(id => !assignedUserIds.has(id));

  useEffect(() => {
    loadData();
  }, [connectionId, profile?.company_id]);

  async function loadData() {
    if (!profile?.company_id) return;

    setIsLoading(true);
    try {
      // Fetch all agents from the company
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('company_id', profile.company_id)
        .eq('active', true)
        .order('full_name');

      if (usersError) throw usersError;

      // Fetch user roles
      const userIds = usersData?.map(u => u.id) || [];
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Create role map
      const roleMap = new Map<string, string>();
      rolesData?.forEach(r => roleMap.set(r.user_id, r.role));

      // Filter only agents (admin/owner always have access, viewers don't need assignment)
      const filteredUsers: UserItem[] = (usersData || [])
        .map(u => ({
          id: u.id,
          fullName: u.full_name,
          email: u.email,
          avatarUrl: u.avatar_url,
          role: roleMap.get(u.id) || 'agent'
        }))
        .filter(u => u.role === 'agent' || u.role === 'admin' || u.role === 'owner')
        .sort((a, b) => {
          // Sort by role first (owner > admin > agent), then by name
          const roleOrder = { owner: 0, admin: 1, agent: 2 };
          const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
          const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.fullName.localeCompare(b.fullName);
        });

      setUsers(filteredUsers);

      // Fetch current assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('connection_users')
        .select('user_id')
        .eq('connection_id', connectionId);

      if (assignmentsError) throw assignmentsError;

      const assignedIds = new Set((assignmentsData || []).map(a => a.user_id));
      setAssignedUserIds(assignedIds);
      setOriginalAssignedIds(new Set(assignedIds));
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggleUser(userId: string) {
    setAssignedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleSave() {
    // Validate at least one agent is selected (only counting agents, not admins)
    const agentIds = users.filter(u => u.role === 'agent').map(u => u.id);
    const selectedAgents = agentIds.filter(id => assignedUserIds.has(id));
    
    // If there are any assignments and none are agents, that's ok (admins always have access)
    // But if we're restricting access, we should have at least one agent or explicit confirmation
    
    setIsSaving(true);
    try {
      // Delete all existing assignments for this connection
      const { error: deleteError } = await supabase
        .from('connection_users')
        .delete()
        .eq('connection_id', connectionId);

      if (deleteError) throw deleteError;

      // Insert new assignments (only for agents, admins don't need explicit assignment)
      const agentAssignments = [...assignedUserIds]
        .filter(userId => {
          const user = users.find(u => u.id === userId);
          return user?.role === 'agent';
        })
        .map(userId => ({
          connection_id: connectionId,
          user_id: userId
        }));

      if (agentAssignments.length > 0) {
        const { error: insertError } = await supabase
          .from('connection_users')
          .insert(agentAssignments);

        if (insertError) throw insertError;
      }

      setOriginalAssignedIds(new Set(assignedUserIds));
      toast.success('Usuários atualizados com sucesso');
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast.error('Erro ao salvar usuários');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setAssignedUserIds(new Set(originalAssignedIds));
    onClose?.();
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function getRoleBadge(role: string) {
    switch (role) {
      case 'owner':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">Proprietário</Badge>;
      case 'admin':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Admin</Badge>;
      case 'agent':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Agente</Badge>;
      default:
        return null;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const agents = users.filter(u => u.role === 'agent');
  const admins = users.filter(u => u.role === 'admin' || u.role === 'owner');

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Usuários com acesso</h3>
        <p className="text-sm text-muted-foreground">
          Selecione quais agentes podem visualizar conversas desta conexão no Inbox.
        </p>
      </div>

      {/* Admin Info */}
      {admins.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-500">Proprietários e administradores</p>
            <p className="text-muted-foreground">
              Sempre têm acesso a todas as conexões, independente desta configuração.
            </p>
          </div>
        </div>
      )}

      {/* Users List */}
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-2">
          {/* Admins/Owners (always have access, shown as disabled) */}
          {admins.map(user => (
            <div
              key={user.id}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 opacity-60"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.fullName} className="object-cover object-top" />
                <AvatarFallback className="text-sm bg-primary/10 text-primary">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              {getRoleBadge(user.role)}
              <Switch checked disabled />
            </div>
          ))}

          {/* Agents (configurable) */}
          {agents.map(user => (
            <div
              key={user.id}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors',
                assignedUserIds.has(user.id) ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 hover:bg-muted/50'
              )}
              onClick={() => handleToggleUser(user.id)}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.fullName} className="object-cover object-top" />
                <AvatarFallback className="text-sm bg-primary/10 text-primary">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              {getRoleBadge(user.role)}
              <Switch
                checked={assignedUserIds.has(user.id)}
                onCheckedChange={() => handleToggleUser(user.id)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum agente encontrado na empresa.</p>
              <p className="text-xs">Adicione agentes para configurar acesso às conexões.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <p className="text-sm text-warning">
          Você tem alterações não salvas.
        </p>
      )}

      {/* Footer Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
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
      </div>
    </div>
  );
}
