import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Users, AlertCircle, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TeamMemberWithRole {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
  role: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
}

export function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const { profile, company } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Load team members with roles
  useEffect(() => {
    if (!isOpen || !company?.id) return;

    const loadTeamMembers = async () => {
      setIsLoading(true);
      try {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .eq('company_id', company.id)
          .eq('active', true);

        if (profilesError) throw profilesError;

        // Get roles for all users
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', (profiles || []).map(p => p.id));

        if (rolesError) throw rolesError;

        const roleMap: Record<string, string> = {};
        (roles || []).forEach(r => {
          roleMap[r.user_id] = r.role;
        });

        const membersWithRoles: TeamMemberWithRole[] = (profiles || []).map(p => ({
          id: p.id,
          fullName: p.full_name,
          avatarUrl: p.avatar_url,
          email: p.email,
          role: roleMap[p.id] || 'agent',
        }));

        setTeamMembers(membersWithRoles);
      } catch (error) {
        console.error('Error loading team members:', error);
        toast.error('Erro ao carregar membros da equipe');
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamMembers();
  }, [isOpen, company?.id]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setGroupName('');
      setDescription('');
      setSelectedMembers([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return teamMembers;
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(m => 
      m.fullName.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );
  }, [teamMembers, searchQuery]);

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Check if at least one admin/owner is selected
  const hasAdminOrOwner = useMemo(() => {
    return selectedMembers.some(memberId => {
      const member = teamMembers.find(m => m.id === memberId);
      return member && (member.role === 'owner' || member.role === 'admin');
    });
  }, [selectedMembers, teamMembers]);

  const isValid = groupName.trim().length > 0 && selectedMembers.length > 0 && hasAdminOrOwner;

  const handleCreate = async () => {
    if (!isValid || !company?.id || !profile?.id) return;

    setIsCreating(true);
    try {
      // Create the group room using RPC (bypasses RLS)
      const { data: roomId, error: roomError } = await supabase
        .rpc('create_internal_chat_room', {
          p_type: 'group',
          p_name: groupName.trim(),
          p_description: description.trim() || null
        });

      if (roomError) throw roomError;
      
      const room = { id: roomId };

      // Add participants
      const participants = selectedMembers.map(userId => ({
        room_id: room.id,
        user_id: userId,
      }));

      const { error: participantsError } = await supabase
        .from('internal_chat_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      toast.success('Grupo criado com sucesso!');
      onGroupCreated();
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Erro ao criar grupo');
    } finally {
      setIsCreating(false);
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default" className="bg-amber-500 text-white text-[10px] px-1.5">Proprietário</Badge>;
      case 'admin':
        return <Badge variant="default" className="bg-purple-500 text-white text-[10px] px-1.5">Admin</Badge>;
      case 'supervisor':
        return <Badge variant="secondary" className="text-[10px] px-1.5">Supervisor</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] px-1.5">Atendente</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Criar Grupo
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 min-h-0">
          <div className="space-y-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="groupName">Nome do Grupo *</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value.slice(0, 100))}
              placeholder="Digite o nome do grupo"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground text-right">
              {groupName.length}/100
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="Adicione uma descrição"
              maxLength={200}
              rows={2}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/200
            </p>
          </div>

          {/* Participants */}
          <div className="space-y-2 flex-1 min-h-0">
            <Label>Participantes *</Label>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar membros..."
                className="pl-9"
              />
            </div>

            {/* Members list */}
            <ScrollArea className="h-[200px] border rounded-md">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nenhum membro encontrado
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        selectedMembers.includes(member.id)
                          ? 'bg-emerald-50 dark:bg-emerald-950/30'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                          {getInitials(member.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {member.fullName}
                            {member.id === profile?.id && ' (você)'}
                          </span>
                          {getRoleBadge(member.role)}
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">
                          {member.email}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              {selectedMembers.length} selecionado(s)
            </p>
          </div>

          {/* Validation warning */}
          {selectedMembers.length > 0 && !hasAdminOrOwner && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <Shield className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                O grupo precisa ter pelo menos um <strong>Proprietário</strong> ou <strong>Administrador</strong>.
              </p>
            </div>
          )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!isValid || isCreating}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Grupo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
