import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Pencil, UserPlus, Trash2, X, Loader2, Shield, Calendar, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GroupParticipant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
  role: string;
  joinedAt: string;
}

interface GroupRoom {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: GroupRoom | null;
  onGroupUpdated: () => void;
  onGroupDeleted: () => void;
  onAddMembers: () => void;
}

export function GroupInfoModal({ 
  isOpen, 
  onClose, 
  room, 
  onGroupUpdated,
  onGroupDeleted,
  onAddMembers 
}: GroupInfoModalProps) {
  const { profile, userRole } = useAuth();
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load participants
  useEffect(() => {
    if (!isOpen || !room) return;

    const loadParticipants = async () => {
      setIsLoading(true);
      try {
        const { data: participantsData, error: participantsError } = await supabase
          .from('internal_chat_participants')
          .select(`
            user_id,
            created_at,
            profiles:user_id(id, full_name, avatar_url, email)
          `)
          .eq('room_id', room.id);

        if (participantsError) throw participantsError;

        // Get roles
        const userIds = (participantsData || []).map(p => (p.profiles as any)?.id).filter(Boolean);
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        const roleMap: Record<string, string> = {};
        (roles || []).forEach(r => {
          roleMap[r.user_id] = r.role as string;
        });

        const participantsList: GroupParticipant[] = (participantsData || []).map(p => {
          const profile = p.profiles as any;
          return {
            id: profile?.id || '',
            fullName: profile?.full_name || 'Usuário',
            avatarUrl: profile?.avatar_url,
            email: profile?.email || '',
            role: roleMap[profile?.id] || 'agent',
            joinedAt: p.created_at,
          };
        });

        setParticipants(participantsList);
      } catch (error) {
        console.error('Error loading participants:', error);
        toast.error('Erro ao carregar participantes');
      } finally {
        setIsLoading(false);
      }
    };

    loadParticipants();
    setEditName(room.name);
    setEditDescription(room.description || '');
    setIsEditing(false);
  }, [isOpen, room]);

  const adminsAndOwners = useMemo(() => {
    return participants.filter(p => p.role === 'owner' || p.role === 'admin');
  }, [participants]);

  const canRemoveMember = (memberId: string) => {
    const member = participants.find(p => p.id === memberId);
    if (!member) return false;

    // Check if this is the last admin/owner
    if (member.role === 'owner' || member.role === 'admin') {
      return adminsAndOwners.length > 1;
    }
    return true;
  };

  const handleSaveEdit = async () => {
    if (!room || !editName.trim()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('internal_chat_rooms')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);

      if (error) throw error;

      toast.success('Grupo atualizado');
      setIsEditing(false);
      onGroupUpdated();
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Erro ao atualizar grupo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!room) return;

    setIsDeleting(true);
    try {
      // Delete participants first (should cascade, but let's be explicit)
      await supabase
        .from('internal_chat_participants')
        .delete()
        .eq('room_id', room.id);

      // Delete messages
      await supabase
        .from('internal_chat_messages')
        .delete()
        .eq('room_id', room.id);

      // Delete room
      const { error } = await supabase
        .from('internal_chat_rooms')
        .delete()
        .eq('id', room.id);

      if (error) throw error;

      toast.success('Grupo excluído');
      setDeleteConfirmOpen(false);
      onGroupDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Erro ao excluir grupo');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!room || !canRemoveMember(memberId)) return;

    setRemovingMember(memberId);
    try {
      const { error } = await supabase
        .from('internal_chat_participants')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', memberId);

      if (error) throw error;

      setParticipants(prev => prev.filter(p => p.id !== memberId));
      toast.success('Participante removido');
      onGroupUpdated();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erro ao remover participante');
    } finally {
      setRemovingMember(null);
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

  if (!room) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Informações do Grupo
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-hidden">
            {/* Group info */}
            {isEditing ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="editName">Nome do Grupo</Label>
                  <Input
                    id="editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value.slice(0, 100))}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editDescription">Descrição</Label>
                  <Textarea
                    id="editDescription"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value.slice(0, 200))}
                    maxLength={200}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editName.trim() || isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{room.name}</h3>
                    {room.description && (
                      <p className="text-sm text-muted-foreground mt-1">{room.description}</p>
                    )}
                  </div>
                  {isAdminOrOwner && (
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  Criado em {format(new Date(room.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
              </div>
            )}

            <Separator />

            {/* Participants */}
            <div className="space-y-2 flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <Label>{participants.length} Participantes</Label>
                {isAdminOrOwner && (
                  <Button size="sm" variant="outline" onClick={onAddMembers}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[200px] border rounded-md">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {participants.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                      >
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
                        {isAdminOrOwner && member.id !== profile?.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removingMember === member.id || !canRemoveMember(member.id)}
                            title={!canRemoveMember(member.id) ? 'Não é possível remover o último admin/proprietário' : 'Remover do grupo'}
                          >
                            {removingMember === member.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {adminsAndOwners.length === 1 && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                  <Shield className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Este grupo tem apenas um administrador/proprietário que não pode ser removido.
                  </p>
                </div>
              )}
            </div>
          </div>

          {isAdminOrOwner && (
            <DialogFooter className="mt-4">
              <Button
                variant="destructive"
                onClick={() => setDeleteConfirmOpen(true)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Grupo
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este grupo? Todas as mensagens serão perdidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
