import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Loader2 } from 'lucide-react';
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

interface AddGroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
  onMembersAdded: () => void;
}

export function AddGroupMembersModal({ isOpen, onClose, roomId, onMembersAdded }: AddGroupMembersModalProps) {
  const { company } = useAuth();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [availableMembers, setAvailableMembers] = useState<TeamMemberWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Load available members (not in group yet)
  useEffect(() => {
    if (!isOpen || !roomId || !company?.id) return;

    const loadAvailableMembers = async () => {
      setIsLoading(true);
      try {
        // Get current participants
        const { data: currentParticipants } = await supabase
          .from('internal_chat_participants')
          .select('user_id')
          .eq('room_id', roomId);

        const currentIds = (currentParticipants || []).map(p => p.user_id);

        // Get all team members
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .eq('company_id', company.id)
          .eq('active', true);

        if (profilesError) throw profilesError;

        // Filter out current participants
        const availableProfiles = (profiles || []).filter(p => !currentIds.includes(p.id));

        // Get roles
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', availableProfiles.map(p => p.id));

        const roleMap: Record<string, string> = {};
        (roles || []).forEach(r => {
          roleMap[r.user_id] = r.role;
        });

        const membersWithRoles: TeamMemberWithRole[] = availableProfiles.map(p => ({
          id: p.id,
          fullName: p.full_name,
          avatarUrl: p.avatar_url,
          email: p.email,
          role: roleMap[p.id] || 'agent',
        }));

        setAvailableMembers(membersWithRoles);
      } catch (error) {
        console.error('Error loading available members:', error);
        toast.error('Erro ao carregar membros disponíveis');
      } finally {
        setIsLoading(false);
      }
    };

    loadAvailableMembers();
    setSelectedMembers([]);
    setSearchQuery('');
  }, [isOpen, roomId, company?.id]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return availableMembers;
    const query = searchQuery.toLowerCase();
    return availableMembers.filter(m => 
      m.fullName.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );
  }, [availableMembers, searchQuery]);

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAdd = async () => {
    if (!roomId || selectedMembers.length === 0) return;

    setIsAdding(true);
    try {
      const participants = selectedMembers.map(userId => ({
        room_id: roomId,
        user_id: userId,
      }));

      const { error } = await supabase
        .from('internal_chat_participants')
        .insert(participants);

      if (error) throw error;

      toast.success(`${selectedMembers.length} participante(s) adicionado(s)`);
      onMembersAdded();
      onClose();
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error('Erro ao adicionar participantes');
    } finally {
      setIsAdding(false);
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
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Adicionar Participantes
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
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
          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4">
                {availableMembers.length === 0 ? (
                  <>
                    <UserPlus className="w-8 h-8 mb-2 opacity-50" />
                    <p>Todos os membros já estão no grupo</p>
                  </>
                ) : (
                  <p>Nenhum membro encontrado</p>
                )}
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
                      <AvatarImage 
                        src={member.avatarUrl || undefined} 
                        className="object-cover object-top"
                      />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                        {getInitials(member.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{member.fullName}</span>
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

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isAdding}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={selectedMembers.length === 0 || isAdding}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adicionando...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar ({selectedMembers.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
