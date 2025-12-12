import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Settings2, Loader2, Shield, ShieldCheck, UserCheck, Eye, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserConfigDrawer } from '@/components/team/UserConfigDrawer';
import { InviteUserModal } from '@/components/team/InviteUserModal';
import type { Tables } from '@/integrations/supabase/types';

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

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  owner: { label: 'Proprietário', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', icon: ShieldCheck },
  admin: { label: 'Administrador', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Shield },
  supervisor: { label: 'Supervisor', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: Shield },
  agent: { label: 'Atendente', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: UserCheck },
  viewer: { label: 'Visualizador', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', icon: Eye },
};

export default function Team() {
  const { profile, userRole, teamProfiles } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const isOwner = userRole?.role === 'owner';
  const isAdmin = userRole?.role === 'admin';
  const canManageTeam = isOwner || isAdmin;

  useEffect(() => {
    if (!canManageTeam) {
      navigate('/inbox');
      return;
    }
    loadMembers();
  }, [canManageTeam, navigate]);

  // Update member statuses in real-time from teamProfiles
  useEffect(() => {
    if (teamProfiles.length > 0 && members.length > 0) {
      setMembers((prev) =>
        prev.map((member) => {
          const updatedProfile = teamProfiles.find((p) => p.id === member.id);
          if (updatedProfile && updatedProfile.status !== member.status) {
            return { ...member, status: updatedProfile.status || 'offline' };
          }
          return member;
        })
      );
    }
  }, [teamProfiles]);

  const loadMembers = async () => {
    if (!profile?.company_id) return;

    setIsLoading(true);
    try {
      // Get all profiles from company
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('full_name');

      if (profilesError) throw profilesError;

      // Get roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get connection assignments for all users
      const { data: assignments, error: assignmentsError } = await supabase
        .from('connection_users')
        .select('user_id, access_level');

      if (assignmentsError) throw assignmentsError;

      // Build team members with additional info
      const teamMembers: TeamMember[] = (profiles || []).map(p => {
        const userRole = roles?.find(r => r.user_id === p.id);
        const userAssignments = assignments?.filter(a => a.user_id === p.id) || [];
        const hasRestrictedAccess = userAssignments.some(a => a.access_level === 'assigned_only');

        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          status: p.status || 'offline',
          active: p.active ?? true,
          created_at: p.created_at || '',
          role: userRole?.role || 'agent',
          connectionCount: userAssignments.length,
          hasRestrictedAccess,
        };
      });

      // Sort by role priority, then name
      const rolePriority: Record<string, number> = { owner: 0, admin: 1, supervisor: 2, agent: 3, viewer: 4 };
      teamMembers.sort((a, b) => {
        const priorityDiff = (rolePriority[a.role] ?? 5) - (rolePriority[b.role] ?? 5);
        if (priorityDiff !== 0) return priorityDiff;
        return a.full_name.localeCompare(b.full_name);
      });

      // Filter out owner if current user is admin (not owner)
      const filteredMembers = isOwner 
        ? teamMembers 
        : teamMembers.filter(m => m.role !== 'owner');

      setMembers(filteredMembers);
    } catch (error) {
      console.error('[Team] Erro ao carregar membros:', error);
      toast.error('Erro ao carregar equipe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigMember = (member: TeamMember) => {
    // Admin can't edit other admins or owner
    if (!isOwner && (member.role === 'owner' || member.role === 'admin')) {
      toast.error('Você não tem permissão para editar este usuário');
      return;
    }
    setSelectedMember(member);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedMember(null);
  };

  const handleSaveSuccess = () => {
    loadMembers();
    handleDrawerClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canEditMember = (member: TeamMember) => {
    if (isOwner) return member.role !== 'owner' || member.id === profile?.id;
    if (isAdmin) return member.role !== 'owner' && member.role !== 'admin';
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Gestão de Equipe
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie permissões e acesso dos membros da sua equipe
          </p>
        </div>
        
        <Button onClick={() => setIsInviteModalOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Convidar membro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'membro' : 'membros'} na equipe
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {members.map(member => {
              const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.agent;
              const RoleIcon = roleConfig.icon;
              const isEditableByCurrentUser = canEditMember(member);

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.avatar_url || undefined} className="object-cover object-top" />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                          member.status === 'online' ? 'bg-green-500' :
                          member.status === 'away' ? 'bg-yellow-500' :
                          member.status === 'busy' ? 'bg-red-500' : 'bg-gray-400'
                        }`}
                      />
                    </div>

                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role badge */}
                    <Badge variant="secondary" className={`${roleConfig.color} gap-1`}>
                      <RoleIcon className="w-3 h-3" />
                      {roleConfig.label}
                    </Badge>

                    {/* Connection access badge */}
                    {member.role !== 'owner' && member.role !== 'admin' && (
                      <Badge 
                        variant="outline" 
                        className={
                          member.connectionCount === 0 
                            ? 'text-red-600 border-red-300' 
                            : member.hasRestrictedAccess 
                            ? 'text-amber-600 border-amber-300' 
                            : 'text-green-600 border-green-300'
                        }
                      >
                        {member.connectionCount === 0 
                          ? 'Sem acesso' 
                          : member.connectionCount === 1 
                          ? '1 conexão' 
                          : `${member.connectionCount} conexões`}
                      </Badge>
                    )}

                    {member.role === 'owner' || member.role === 'admin' ? (
                      <Badge variant="outline" className="text-blue-600 border-blue-300">
                        Todas as conexões
                      </Badge>
                    ) : null}

                    {/* Active/Inactive badge */}
                    {!member.active && (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                        Inativo
                      </Badge>
                    )}

                    {/* Config button */}
                    {isEditableByCurrentUser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleConfigMember(member)}
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* User Config Drawer */}
      <UserConfigDrawer
        open={isDrawerOpen}
        onClose={handleDrawerClose}
        member={selectedMember}
        onSaveSuccess={handleSaveSuccess}
        isOwner={isOwner}
      />

      {/* Invite User Modal */}
      <InviteUserModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        onSuccess={loadMembers}
      />
    </div>
  );
}
